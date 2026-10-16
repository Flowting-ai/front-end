"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getAuth0AccessToken,
  clearInMemoryAccessToken,
  setInMemoryAccessToken,
  isTokenExpiringSoon,
  msUntilTokenRefresh,
  decodeJwtSub,
  getInMemoryAccessToken,
} from "@/lib/jwt-utils";
import type {
  UserInvoice,
  UserPaymentMethod,
  UserProfile,
  UserUpcomingInvoice,
  UserUsage,
} from "@/lib/api/user";
import { currentUser } from "@/lib/api/current-user";
import { formatCredits } from "@/lib/plan-config";
import { creditsFromUsage, creditsFromBilling } from "@/lib/credits";
import { normalizePct } from "@/lib/utils/format-utils";
import { AUTH_LOGIN_ROUTE, AUTH_LOGOUT_ROUTE } from "@/lib/routes";
import { isLoggingOut, markLoggingOut } from "@/lib/auth/logout-state";
import { clearOrgIdCache, clearSearchRecents, clearSessionTiming } from "@/lib/storage-keys";
import { getQueryClient } from "@/lib/query-client";
import { clearUserScopedCache } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";
import { trackBrowserEvent } from "@/lib/analytics/events";
import { clearSelection } from "@/lib/models/model-selection-store";

export interface AuthUser {
  id?: string | number | null;
  /** Auth0 subject claim (the `sub`). Stable primary identity across every surface —
   *  used as the Mixpanel distinct_id (never email; see docs/analytics/mixpanel-backend-contract.md). */
  auth0Id?: string | null;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  phoneNumber?: string | null;
  profilePicture?: string | null;
  onboardingCompleted?: boolean | null;
  /** True when the user is on an active free trial grant (1 000 credits). */
  isTrial?: boolean;
  onboardingRole?: string | null;
  onboardingTone?: string | null;
  /** Backend onboarding `role_fit`: just_me | small_team | large_team. The
   *  authoritative signal for whether this account is a team (organization). */
  roleFit?: string | null;
  planType?: "starter" | "pro" | "power" | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  paymentMethods?: UserPaymentMethod[];
  defaultPaymentMethod?: UserPaymentMethod | null;
  invoices?: UserInvoice[];
  upcomingInvoice?: UserUpcomingInvoice | null;
  usage?: UserUsage | null;
  billingPortalUrl?: string | null;
  budget?: string | null;
  budgetUsed?: string | null;
  budgetRemaining?: string | null;
  budgetConsumedPercent?: number | null;
  dailyQuotaEnabled?: boolean | null;
  dailyBudgetUsed?: string | null;
  dailyBudgetLimit?: string | null;
  dailyBudgetAvailable?: string | null;
  nextBillingDate?: string | null;
  active?: boolean | null;
  creditsTotal?: number | null;
  creditsUsed?: number | null;
  creditsRemaining?: number | null;
  creditsDisplay?: string | null;
  creditsRemainingDisplay?: string | null;
  /** Non-null when the user belongs to a teams / enterprise organisation. */
  orgId?: string | null;
  /** Org role (owner | admin | member) when orgId is set. */
  role?: string | null;
  /** An org invite waiting on someone who has no org yet (e.g. they signed up
   *  from Slack's Connect link but never finished). Accepting it comes first. */
  pendingInviteId?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  jwtToken: string | null;
  isHydrated: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setJwtToken: (token: string | null) => void;
  clearAuth: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

function mapProfileToUser(profile: UserProfile, jwtToken: string | null): AuthUser {
  // Auth0 sometimes defaults first_name to the user's email on new signups.
  // Treat any name value that looks like an email as absent, consistent with
  // the hello-page pre-fill filter (hello/page.tsx).
  const rawFirstName = profile.first_name?.trim() ?? "";
  const firstNameIsEmail = rawFirstName.includes("@");

  // If the backend returns a combined `name` field (e.g. from Auth0) but
  // no separate first_name, parse first_name from the combined name.
  const rawProfileName = profile.name?.trim() ?? "";
  const profileNameIsEmail = rawProfileName.includes("@");
  const firstName =
    (!firstNameIsEmail ? rawFirstName : "") ||
    (!profileNameIsEmail ? rawProfileName.split(" ")[0]?.trim() ?? "" : "") ||
    "";
  const rawLast = profile.last_name?.trim() || "";
  const lastName = rawLast.toLowerCase() === "user" ? "" : rawLast;
  const paymentMethods = profile.payment_methods ?? [];
  const defaultPaymentMethod =
    paymentMethods.find((m) => m.is_default) ?? paymentMethods[0] ?? null;
  const monthlyPctFromApi = normalizePct(profile.usage?.monthly_used_pct);

  // ── Personal (individual) credit balance ──────────────────────────────────
  // Trial + paid are the SAME environment, derived in lib/credits.ts with the
  // correct backend semantics (total_credits/usage.credits is the REMAINING
  // balance, not the allowance; allowance = remaining + used). The ORGANIZATION
  // pool is a separate environment (org-context / getOrgPlan), and org users are
  // excluded from individual credit gating in useCreditStatus.
  // /users/me carries the balance under `usage`; the top-level `credits` object
  // is only populated by /stripe/billing — prefer usage, fall back to credits.
  const balance = profile.usage
    ? creditsFromUsage(profile.usage)
    : creditsFromBilling(profile.credits);
  const hasCredits = balance.isTrial || balance.total > 0 || balance.remaining > 0;
  const creditsTotal: number | null = hasCredits ? balance.total : null;
  const creditsUsed: number | null = hasCredits ? balance.used : null;
  const creditsRemaining: number | null = hasCredits ? balance.remaining : null;
  const creditsDisplay: string | null = hasCredits ? formatCredits(balance.total) : null;
  const creditsRemainingDisplay: string | null = hasCredits
    ? formatCredits(balance.remaining)
    : null;

  return {
    // GET /users/me's response (UserResponse/UserAccountResponse, back-end
    // services/users/schemas.py) has no auth0_id field at all — profile.auth0_id
    // is always empty. The JWT's own `sub` claim is the real, reliable source
    // (same workaround MixpanelProvider already applied locally for itself);
    // doing it here instead means every consumer of user.auth0Id gets a real
    // value, not just Mixpanel. This was silently breaking every
    // `ownerUserId === currentUserId` ownership check app-wide (e.g. a
    // project's own owner never satisfied `canEdit`, hidden only where an
    // unrelated fallback — like the org-admin bypass on delete — masked it).
    auth0Id: profile.auth0_id || decodeJwtSub(jwtToken) || null,
    email: profile.email,
    firstName,
    lastName,
    nickname: profile.nickname ?? null,
    name:
      [firstName, lastName].filter(Boolean).join(" ") ||
      (!profileNameIsEmail ? rawProfileName : null) ||
      // Auth0 sets profile.name to the email for new signups; don't expose the
      // full address as a display name — use only the local part before '@'.
      (profile.email ? profile.email.split("@")[0] : null) ||
      null,
    phoneNumber: profile.phone_number ?? null,
    profilePicture: profile.profile_picture ?? null,
    onboardingCompleted: profile.onboarding?.completed ?? null,
    isTrial: balance.isTrial,
    onboardingRole: profile.onboarding?.user_role ?? null,
    onboardingTone: profile.onboarding?.ai_tone ?? null,
    roleFit: profile.onboarding?.role_fit ?? null,
    planType: profile.plan_type ?? null,
    planName: profile.plan_type ? profile.plan_type.toUpperCase() : "NONE",
    subscriptionStatus: profile.subscription_status ?? null,
    currentPeriodEnd: profile.current_period_end ?? null,
    nextBillingDate:
      profile.next_billing_date ??
      profile.current_period_end ??
      profile.upcoming_invoice?.next_payment_date ??
      null,
    cancelAtPeriodEnd: profile.cancel_at_period_end ?? false,
    paymentMethods,
    defaultPaymentMethod,
    invoices: profile.invoices ?? [],
    upcomingInvoice: profile.upcoming_invoice ?? null,
    usage: profile.usage ?? null,
    billingPortalUrl: profile.billing_portal_url ?? null,
    budget: profile.usage ? String(profile.usage.monthly_limit) : null,
    budgetUsed: profile.usage ? String(profile.usage.monthly_used) : null,
    budgetRemaining: profile.usage ? String(profile.usage.monthly_remaining) : null,
    budgetConsumedPercent:
      monthlyPctFromApi !== null
        ? monthlyPctFromApi
        : profile.usage && profile.usage.monthly_limit > 0
          ? Math.min(
              (profile.usage.monthly_used / profile.usage.monthly_limit) * 100,
              100,
            )
          : 0,
    dailyBudgetUsed: profile.usage ? String(profile.usage.daily_used) : null,
    dailyBudgetLimit: profile.usage ? String(profile.usage.daily_limit) : null,
    dailyBudgetAvailable: profile.usage ? String(profile.usage.daily_remaining) : null,
    active: profile.active,
    creditsTotal,
    creditsUsed,
    creditsRemaining,
    creditsDisplay,
    creditsRemainingDisplay,
    orgId: profile.org_id ?? null,
    role: profile.role ?? null,
    pendingInviteId: profile.pending_invite_id ?? null,
  };
}

const AUTH_CHANNEL = "souvenir-auth";

function broadcastLogout(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(AUTH_CHANNEL);
  channel.postMessage({ type: "logout" });
  channel.close();
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jwtToken, setJwtTokenState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const setJwtToken = (token: string | null) => {
    setInMemoryAccessToken(token);
    setJwtTokenState(token);
  };

  // Hydrate token on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;

    const hydrate = async () => {
      try {
        const token = await getAuth0AccessToken();
        if (mounted) setJwtToken(token);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to hydrate auth state", error);
        }
      } finally {
        if (mounted) setIsHydrated(true);
      }
    };

    void hydrate();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactive refresh: one timer set for when the token enters its expiry
  // buffer, re-armed by each new token. Background tabs throttle timers, so a
  // tab coming back into view also checks. Requests still refresh on demand
  // through ensureFreshToken.
  useEffect(() => {
    if (typeof window === "undefined" || !jwtToken) return;
    const refresh = async () => {
      if (isTokenExpiringSoon()) setJwtToken(await getAuth0AccessToken());
    };
    const timer = setTimeout(refresh, msUntilTokenRefresh());
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jwtToken]);

  const clearAuth = () => {
    setUser(null);
    setJwtTokenState(null);
    clearInMemoryAccessToken();
    currentUser.clear();
    clearOrgIdCache();
    clearSearchRecents();
    clearSessionTiming();
    clearSelection();
    clearUserScopedCache(getQueryClient());
  };

  // Stable reference across renders — setUser (from useState) and the module-level
  // currentUser/mapProfileToUser never change, so empty deps are correct.
  // Without useCallback every AuthProvider render creates a new function reference,
  // which destabilises any useCallback/useEffect that lists refreshUser as a dep
  // (e.g. billing page's `reload`), causing those effects to re-run on every render
  // and creating an infinite API-call loop when the Stripe return timers are active.
  const refreshUser = useCallback(async () => {
    try {
      const profile = await currentUser.refresh();
      // Reads the module-level in-memory token, not the closed-over `jwtToken`
      // state — this callback has an empty dep array (see the comment above),
      // so `jwtToken` here would be frozen at whatever it was on first render.
      if (profile) setUser(mapProfileToUser(profile, getInMemoryAccessToken()));
    } catch (error) {
      console.error("Failed to refresh user profile", error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    // Only the first call navigates. A second one (a session-expired event fired by
    // the 401s this logout causes) would restart the redirect and abort the first.
    if (isLoggingOut()) return;
    markLoggingOut();
    // Other tabs share the cleared session cookie but still hold a token in
    // memory, so tell them to sign out too.
    broadcastLogout();
    // Pass an explicit, slash-free returnTo. The Auth0 SDK (v4) catch-all at
    // /auth/logout otherwise defaults post_logout_redirect_uri to APP_BASE_URL,
    // which carries a trailing slash ("http://localhost:3000/") that Auth0
    // rejects as a non-allowlisted logout URL — so the IdP logout silently fails
    // and the browser bounces back with the session intact. Targeting
    // /auth/login (an allowlisted logout URL) makes logout reliable everywhere.
    const returnTo = `${window.location.origin}${AUTH_LOGIN_ROUTE}`;
    // Cancel this page's in-flight requests: each carries the old session cookie,
    // and a response landing after /auth/logout would re-set it.
    window.stop();
    window.location.href = AUTH_LOGOUT_ROUTE(returnTo);
  };

  // Listen for session-expired events
  useEffect(() => {
    const handleExpired = () => {
      if (isLoggingOut()) return;
      trackBrowserEvent("auth_session_expired", {});
      void logout();
    };
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A logout in another tab: drop this tab's token and go to login. Not
  // logout() again: the IdP session is already gone.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type !== "logout") return;
      // BroadcastChannel also delivers to this tab's own listener. If this tab sent
      // it, logout() is already on its way to Auth0; going to login here would
      // abort that navigation and leave the Auth0 session signed in.
      if (isLoggingOut()) return;
      // Mark this tab as logging out too, so the 401s its own requests now get do
      // not fire session-expired and start a second logout (which, with no session
      // left, stops on Auth0's "confirm logout" page instead of the login page).
      markLoggingOut();
      clearAuth();
      window.stop();
      // The other tab posts this just before it starts ending the Auth0 session.
      // Going to /auth/login now would find Auth0 still signed in and sign this
      // tab straight back in. Wait for that tab's /auth/logout to clear the shared
      // session cookie (the access-token route then answers 401), then give its
      // Auth0 hop a moment, and only then go to login.
      void (async () => {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const res = await fetch("/auth/access-token", { cache: "no-store" }).catch(() => null);
          if (res?.status === 401) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = AUTH_LOGIN_ROUTE;
      })();
    };
    return () => channel.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the ["me"] query: any successful profile fetch — refreshUser(), a
  // credits invalidation after a top-up (here or in another tab), the settings
  // save — updates the signed-in user app-wide (chat gate, banners, sidebar)
  // with no manual page reload.
  useEffect(() => {
    const meKey = JSON.stringify(queryKeys.me());
    return getQueryClient().getQueryCache().subscribe(event => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      if (JSON.stringify(event.query.queryKey) !== meKey) return;
      const profile = event.query.state.data as UserProfile | null | undefined;
      if (profile) setUser(mapProfileToUser(profile, getInMemoryAccessToken()));
    });
  }, []);

  // Fetch user profile once after hydration.
  //
  // Deps: [isHydrated] only — jwtToken is intentionally NOT a dep.
  // Including jwtToken would re-fire this on every token refresh, sending
  // a GET /users/me each time.  isHydrated flips exactly once (false →
  // true) and jwtToken is already set in the same React batch (see hydrate()),
  // so the token is always available when this effect runs.
  // Explicit re-fetches go through refreshUser().
  useEffect(() => {
    if (!isHydrated || !jwtToken) return;
    let mounted = true;

    currentUser.load()
      .then((profile) => {
        if (mounted && profile) setUser(mapProfileToUser(profile, getInMemoryAccessToken()));
      })
      .catch((error) => {
        console.error("Failed to load user profile", error);
      });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- jwtToken intentionally omitted; see comment above
  }, [isHydrated]);

  const isAuthenticated = isHydrated && jwtToken !== null;

  const value: AuthContextValue = {
    user,
    jwtToken,
    isHydrated,
    isAuthenticated,
    setUser,
    setJwtToken,
    clearAuth,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Auth is settled enough to fetch: hydrated and holding an access token.
 * Gate authenticated requests (and show a skeleton until then) with this
 * instead of re-deriving `isHydrated && !!jwtToken` per page.
 */
export function useAuthReady(): boolean {
  const { isHydrated, jwtToken } = useAuth();
  return isHydrated && !!jwtToken;
}
