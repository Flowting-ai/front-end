"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
import { usageToCredits, formatCredits } from "@/lib/plan-config";
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
  creditsTotal?: number | null;
  creditsUsed?: number | null;
  creditsRemaining?: number | null;
  creditsDisplay?: string | null;
  creditsRemainingDisplay?: string | null;
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
  const firstName = profile.first_name?.trim() || "";
  const rawLast = profile.last_name?.trim() || "";
  const lastName = rawLast.toLowerCase() === "user" ? "" : rawLast;
  const paymentMethods = profile.payment_methods ?? [];
  const defaultPaymentMethod =
    paymentMethods.find((m) => m.is_default) ?? paymentMethods[0] ?? null;
  const monthlyPctFromApi = normalizePct(profile.usage?.monthly_used_pct);

  const plan = profile.plan_type;
  let creditsTotal: number | null = null;
  let creditsUsed: number | null = null;
  let creditsRemaining: number | null = null;
  let creditsDisplay: string | null = null;
  let creditsRemainingDisplay: string | null = null;

  if (plan && profile.usage) {
    const c = usageToCredits(plan, profile.usage.monthly_used);
    creditsTotal = c.total;
    creditsUsed = c.used;
    creditsRemaining = c.remaining;
    creditsDisplay = formatCredits(c.total);
    creditsRemainingDisplay = formatCredits(c.remaining);
  }

  return {
    email: profile.email,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || profile.email || null,
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
    dailyBudgetAvailable: profile.usage ? String(profile.usage.daily_remaining) : null,
    active: profile.active,
    creditsTotal,
    creditsUsed,
    creditsRemaining,
    creditsDisplay,
    creditsRemainingDisplay,
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
    clearAuth();
    if (typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.origin + "/auth/login");
      window.location.href = `/auth/logout?returnTo=${returnTo}`;
    }
  };

  // Listen for session-expired events
  useEffect(() => {
    const handleExpired = () => void logout();
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile once after hydration
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
  }, [isHydrated, jwtToken]);

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
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
