"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { usageToCredits, formatCredits, getPlanCredits } from "@/lib/plan-config";
import { normalizePct } from "@/lib/utils/format-utils";

export interface AuthUser {
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
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
  /** Total monthly credits for the plan (e.g. 12000 for Pro) */
  creditsTotal?: number | null;
  /** Credits consumed this billing cycle */
  creditsUsed?: number | null;
  /** Credits remaining this billing cycle */
  creditsRemaining?: number | null;
  /** Pre-formatted display string for total credits */
  creditsDisplay?: string | null;
  /** Pre-formatted display string for remaining credits */
  creditsRemainingDisplay?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  jwtToken: string | null;
  isHydrated: boolean;
  /** True as soon as we have a valid Auth0 token — no backend round-trip needed */
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setJwtToken: (token: string | null) => void;
  clearAuth: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

function mapProfileToUser(profile: UserProfile): AuthUser {
  const firstName = profile.first_name?.trim() || "";
  const rawLast = profile.last_name?.trim() || "";
  const lastName = rawLast.toLowerCase() === "user" ? "" : rawLast;
  const paymentMethods = profile.payment_methods ?? [];
  const defaultPaymentMethod =
    paymentMethods.find((method) => method.is_default) ??
    paymentMethods[0] ??
    null;
  const monthlyPctFromApi = normalizePct(profile.usage?.monthly_used_pct);

  return {
    email: profile.email,
    firstName,
    lastName,
    name:
      [firstName, lastName].filter(Boolean).join(" ") ||
      profile.email ||
      null,
    phoneNumber: profile.phone_number ?? null,
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
    dailyBudgetAvailable: profile.usage
      ? String(profile.usage.daily_remaining)
      : null,
    active: profile.active,
    ...(() => {
      const plan = profile.plan_type;
      if (!plan || !profile.usage) return { creditsTotal: null, creditsUsed: null, creditsRemaining: null, creditsDisplay: null, creditsRemainingDisplay: null };
      const c = usageToCredits(plan, profile.usage.monthly_used);
      return {
        creditsTotal: c.total,
        creditsUsed: c.used,
        creditsRemaining: c.remaining,
        creditsDisplay: formatCredits(c.total),
        creditsRemainingDisplay: formatCredits(c.remaining),
      };
    })(),
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jwtToken, setJwtTokenState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const setJwtToken = useCallback((token: string | null) => {
    setInMemoryAccessToken(token);
    setJwtTokenState(token);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;

    const hydrate = async () => {
      try {
        const token = await getAuth0AccessToken();
        if (mounted) {
          setJwtToken(token);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to hydrate auth state", error);
        }
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  // Proactive token refresh — check every 30s and refresh if close to expiry
  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = setInterval(async () => {
      if (isTokenExpiringSoon()) {
        const token = await getAuth0AccessToken();
        setJwtToken(token);
      }
    }, 30_000);

    return () => clearInterval(timer);
  }, [setJwtToken]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setJwtTokenState(null);
    clearInMemoryAccessToken();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await fetchCurrentUser();
      if (profile) {
        setUser(mapProfileToUser(profile));
      }
    } catch (error) {
      console.error("Failed to refresh user profile", error);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    if (typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.origin + "/auth/login");
      window.location.href = `/auth/logout?returnTo=${returnTo}`;
    }
  }, [clearAuth]);

  useEffect(() => {
    const handleExpired = () => logout();
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  }, [logout]);

  // Fetch user profile once after hydration
  useEffect(() => {
    if (!isHydrated || !jwtToken) return;
    let mounted = true;

    fetchCurrentUser()
      .then((profile) => {
        if (mounted && profile) {
          setUser(mapProfileToUser(profile));
        }
      })
      .catch((error) => {
        console.error("Failed to load user profile", error);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, jwtToken]);

  const isAuthenticated = isHydrated && jwtToken !== null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      jwtToken,
      isHydrated,
      isAuthenticated,
      setUser,
      setJwtToken,
      clearAuth,
      logout,
      refreshUser,
    }),
    [
      user,
      jwtToken,
      isHydrated,
      isAuthenticated,
      setJwtToken,
      clearAuth,
      logout,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
