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
import { fetchCurrentUser } from "@/lib/api/user";

export interface AuthUser {
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  planName?: string | null;
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

          setUser({
            email: profile.email,
            firstName: firstName,
            lastName: lastName,
            name: [firstName, lastName].filter(Boolean).join(" "),
            phoneNumber: profile.phone_number ?? null,
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
