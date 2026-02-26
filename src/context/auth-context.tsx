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
import { CSRF_INIT_ENDPOINT } from "@/lib/config";
import { getJwtToken, setJwtCookie, removeJwtCookie } from "@/lib/jwt-utils";

export interface AuthUser {
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  planName?: string | null;
  availableTokens?: number | null;
  totalTokensUsed?: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  csrfToken: string | null;
  jwtToken: string | null;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (token: string | null) => void;
  setJwtToken: (token: string | null) => void;
  clearAuth: () => void;
}

const USER_STORAGE_KEY = "auth:user";
const CSRF_STORAGE_KEY = "auth:csrftoken";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [jwtToken, setJwtTokenState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wrapper that syncs JWT to cookie whenever it changes
  const setJwtToken = useCallback((token: string | null) => {
    if (token) {
      setJwtCookie(token);
    } else {
      removeJwtCookie();
    }
    setJwtTokenState(token);
  }, []);

  // Hydrate auth state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedCsrf =
        sessionStorage.getItem(CSRF_STORAGE_KEY) ||
        localStorage.getItem(CSRF_STORAGE_KEY);
      // JWT is read from cookie — survives refresh, new tabs, no race conditions
      const storedJwt = getJwtToken();

      // Migrate any old localStorage JWT to cookie
      const legacyJwt = localStorage.getItem("token");
      if (legacyJwt && !storedJwt) {
        setJwtCookie(legacyJwt);
        setJwtTokenState(legacyJwt);
        localStorage.removeItem("token");
      } else if (storedJwt) {
        setJwtTokenState(storedJwt);
      }
      // Clean up legacy localStorage token if cookie exists
      if (storedJwt && legacyJwt) {
        localStorage.removeItem("token");
      }

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedCsrf) {
        setCsrfToken(storedCsrf);
        if (localStorage.getItem(CSRF_STORAGE_KEY)) {
          localStorage.removeItem(CSRF_STORAGE_KEY);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to hydrate auth state", error);
      }
    }
    setIsHydrated(true);
  }, []);

  // Re-fetch CSRF token on mount if we have a JWT but no CSRF token
  useEffect(() => {
    if (!isHydrated) return;
    if (jwtToken && !csrfToken) {
      fetch(CSRF_INIT_ENDPOINT, { credentials: "include" })
        .then(() => {
          const cookie = readCookie("csrftoken");
          if (cookie) {
            setCsrfToken(cookie);
          }
        })
        .catch(() => {});
    }
  }, [isHydrated, jwtToken, csrfToken]);

  // Sync user to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user, isHydrated]);

  // Sync CSRF token to sessionStorage + cookie
  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;
    if (csrfToken) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
      try {
        document.cookie = `csrftoken=${encodeURIComponent(
          csrfToken
        )}; path=/; SameSite=None; Secure`;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to set CSRF cookie", error);
        }
      }
    } else {
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      try {
        document.cookie =
          "csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to clear CSRF cookie", error);
        }
      }
    }
  }, [csrfToken, isHydrated]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    setJwtTokenState(null);
    removeJwtCookie();
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem("token"); // clean up legacy
      localStorage.removeItem("isLoggedIn");

      try {
        document.cookie =
          "csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
      } catch {
        // Silently fail
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      jwtToken,
      isHydrated,
      setUser,
      setCsrfToken,
      setJwtToken,
      clearAuth,
    }),
    [user, csrfToken, jwtToken, isHydrated, setJwtToken, clearAuth]
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
