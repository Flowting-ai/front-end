"use client";

/**
 * Auth context — Auth0-ready stub.
 *
 * TODO: When @auth0/nextjs-auth0 is installed:
 *   1. Wrap the app with `<UserProvider>` from @auth0/nextjs-auth0/client in layout.tsx.
 *   2. Replace `useAuth()` with `useUser()` from @auth0/nextjs-auth0/client.
 *   3. Map the Auth0 `User` object to `AuthUser` as needed.
 *   4. Implement `logout()` by redirecting to `/api/auth/logout`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

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
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    // TODO: Replace with Auth0 logout redirect:
    //   router.push("/api/auth/logout");
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isHydrated, setUser, clearAuth, logout }),
    [user, isHydrated, clearAuth, logout]
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
