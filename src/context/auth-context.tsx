"use client";

import { createContext, use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getAuth0AccessToken,
  clearInMemoryAccessToken,
  setInMemoryAccessToken,
  isTokenExpiringSoon,
} from "@/lib/jwt-utils";
import type {
  UserInvoice,
  UserPaymentMethod,
  UserProfile,
  UserUpcomingInvoice,
  UserUsage,
} from "@/lib/api/user";
import { fetchCurrentUser } from "@/lib/api/user";
import { formatCredits } from "@/lib/plan-config";
import { creditsFromUsage, creditsFromBilling } from "@/lib/credits";
import { normalizePct } from "@/lib/utils/format-utils";

export interface AuthUser {
  id?: string | number | null;
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

function mapProfileToUser(profile: UserProfile): AuthUser {
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
  };
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

  // Proactive token refresh every 30s
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setInterval(async () => {
      if (isTokenExpiringSoon()) {
        const token = await getAuth0AccessToken();
        setJwtToken(token);
      }
    }, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAuth = () => {
    setUser(null);
    setJwtTokenState(null);
    clearInMemoryAccessToken();
  };

  const refreshUser = async () => {
    try {
      const profile = await fetchCurrentUser();
      if (profile) setUser(mapProfileToUser(profile));
    } catch (error) {
      console.error("Failed to refresh user profile", error);
    }
  };

  const logout = async () => {
    // Pass an explicit, slash-free returnTo. The Auth0 SDK (v4) catch-all at
    // /auth/logout otherwise defaults post_logout_redirect_uri to APP_BASE_URL,
    // which carries a trailing slash ("http://localhost:3000/") that Auth0
    // rejects as a non-allowlisted logout URL — so the IdP logout silently fails
    // and the browser bounces back with the session intact. Targeting
    // /auth/login (an allowlisted logout URL) makes logout reliable everywhere.
    const returnTo = `${window.location.origin}/auth/login`;
    window.location.href = `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
  };

  // Listen for session-expired events
  useEffect(() => {
    const handleExpired = () => void logout();
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the profile whenever the credit balance changes (e.g. after a
  // topup). Lets balances update app-wide — chat gate, banners, sidebar — with
  // no manual page reload. Event name kept in sync with use-credit-status.ts.
  useEffect(() => {
    const handleCreditsUpdated = () => void refreshUser();
    window.addEventListener("credits:updated", handleCreditsUpdated);
    return () => window.removeEventListener("credits:updated", handleCreditsUpdated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile once after hydration.
  //
  // Deps: [isHydrated] only — jwtToken is intentionally NOT a dep.
  // Including jwtToken would re-fire this on every 30 s token refresh, sending
  // a GET /users/me every half-minute.  isHydrated flips exactly once (false →
  // true) and jwtToken is already set in the same React batch (see hydrate()),
  // so the token is always available when this effect runs.
  // Explicit re-fetches go through refreshUser().
  useEffect(() => {
    if (!isHydrated || !jwtToken) return;
    let mounted = true;

    fetchCurrentUser()
      .then((profile) => {
        if (mounted && profile) setUser(mapProfileToUser(profile));
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
