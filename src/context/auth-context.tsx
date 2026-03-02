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
import { TOKEN_REFRESH_ENDPOINT, LOGOUT_ENDPOINT } from "@/lib/config";
import {
  getJwtToken,
  setJwtCookie,
  removeJwtCookie,
  getRefreshToken,
  setRefreshToken as storeRefreshToken,
  removeRefreshToken,
} from "@/lib/jwt-utils";

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
  csrfToken: string | null;
  jwtToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (token: string | null) => void;
  setJwtToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  clearAuth: () => void;
  logout: () => void;
}

const USER_STORAGE_KEY = "auth:user";
const CSRF_STORAGE_KEY = "auth:csrftoken";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [jwtToken, setJwtTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wrapper: syncs access token to cookie
  const setJwtToken = useCallback((token: string | null) => {
    if (token) {
      setJwtCookie(token);
    } else {
      removeJwtCookie();
    }
    setJwtTokenState(token);
  }, []);

  // Wrapper: syncs refresh token to localStorage
  const setRefreshToken = useCallback((token: string | null) => {
    if (token) {
      storeRefreshToken(token);
    } else {
      removeRefreshToken();
    }
    setRefreshTokenState(token);
  }, []);

  // Hydrate auth state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedJwt = getJwtToken();
      const storedRefresh = getRefreshToken();

      // Migrate any old localStorage JWT to cookie
      const legacyJwt = localStorage.getItem("token");
      if (legacyJwt && !storedJwt) {
        setJwtCookie(legacyJwt);
        setJwtTokenState(legacyJwt);
        localStorage.removeItem("token");
      } else if (storedJwt) {
        setJwtTokenState(storedJwt);
      }
      if (storedJwt && legacyJwt) {
        localStorage.removeItem("token");
      }

      if (storedRefresh) setRefreshTokenState(storedRefresh);
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to hydrate auth state", error);
      }
    }
    setIsHydrated(true);
  }, []);

  // Startup refresh: if JWT cookie expired but refresh token exists, get a new access token
  useEffect(() => {
    if (!isHydrated) return;
    if (getJwtToken()) return; // Access token still in cookie

    const storedRefresh = getRefreshToken();
    if (!storedRefresh) return;

    fetch(TOKEN_REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefresh }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.token) setJwtToken(data.token);
        if (data?.refreshToken) setRefreshToken(data.refreshToken);
        if (!data) {
          removeRefreshToken();
          setRefreshTokenState(null);
        }
      })
      .catch(() => {
        removeRefreshToken();
        setRefreshTokenState(null);
      });
  }, [isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync user to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user, isHydrated]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    setJwtTokenState(null);
    setRefreshTokenState(null);
    removeJwtCookie();
    removeRefreshToken();
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem("token");
      localStorage.removeItem("isLoggedIn");
    }
  }, []);

  // Server-side logout: invalidates the refresh token in the DB
  const logout = useCallback(() => {
    const currentRefreshToken = getRefreshToken();
    clearAuth(); // Clear state immediately for instant UI response
    if (currentRefreshToken) {
      fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      }).catch(() => {});
    }
  }, [clearAuth]);

  // Listen for session-expired events from the API client (failed token refresh on 401)
  useEffect(() => {
    const handleExpired = () => clearAuth();
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      jwtToken,
      refreshToken,
      isHydrated,
      setUser,
      setCsrfToken,
      setJwtToken,
      setRefreshToken,
      clearAuth,
      logout,
    }),
    [user, csrfToken, jwtToken, refreshToken, isHydrated, setJwtToken, setRefreshToken, clearAuth, logout]
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
