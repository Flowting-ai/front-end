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
} from "@/lib/jwt-utils";
import type {
  UserInvoice,
  UserPaymentMethod,
  UserUpcomingInvoice,
  UserUsage,
} from "@/lib/api/user";
import { fetchCurrentUser } from "@/lib/api/user";

export interface AuthUser {
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  planType?: "standard" | "pro" | "power" | null;
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

  const clearAuth = useCallback(() => {
    setUser(null);
    setJwtTokenState(null);
    clearInMemoryAccessToken();
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
          const firstName = profile.first_name?.trim() || "";
          // Filter out placeholder last names set by Auth0 defaults
          const rawLast = profile.last_name?.trim() || "";
          const lastName = rawLast.toLowerCase() === "user" ? "" : rawLast;
          const paymentMethods = profile.payment_methods ?? [];
          const defaultPaymentMethod =
            paymentMethods.find((method) => method.is_default) ??
            paymentMethods[0] ??
            null;
          const normalizePct = (value: number | undefined) => {
            if (typeof value !== "number" || Number.isNaN(value)) return null;
            const pct = value <= 1 ? value * 100 : value;
            return Math.max(0, Math.min(pct, 100));
          };
          const monthlyPctFromApi = normalizePct(profile.usage?.monthly_used_pct);

          setUser({
            email: profile.email,
            firstName: firstName,
            lastName: lastName,
            name:
              [firstName, lastName].filter(Boolean).join(" ") ||
              profile.email ||
              null,
            phoneNumber: profile.phone_number ?? null,
            planType: profile.plan_type ?? null,
            planName: profile.plan_type ? profile.plan_type.toUpperCase() : "NONE",
            subscriptionStatus: profile.subscription_status ?? null,
            currentPeriodEnd: profile.current_period_end ?? null,
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
          });
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
    }),
    [
      user,
      jwtToken,
      isHydrated,
      isAuthenticated,
      setJwtToken,
      clearAuth,
      logout,
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
