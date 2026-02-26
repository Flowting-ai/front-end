"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CSRF_INIT_ENDPOINT } from "@/lib/config";

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
const JWT_STORAGE_KEY = "token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrated = useRef(false);

  // Hydrate auth state from storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedToken =
        sessionStorage.getItem(CSRF_STORAGE_KEY) ||
        localStorage.getItem(CSRF_STORAGE_KEY);
      const storedJwt = localStorage.getItem(JWT_STORAGE_KEY);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedToken) {
        setCsrfToken(storedToken);
        if (localStorage.getItem(CSRF_STORAGE_KEY)) {
          localStorage.removeItem(CSRF_STORAGE_KEY);
        }
      }
      if (storedJwt) {
        setJwtToken(storedJwt);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to hydrate auth state", error);
      }
    }
    hydrated.current = true;
    setIsHydrated(true);
  }, []);

  // Re-fetch CSRF token on mount if we have a JWT but no CSRF token
  // This handles page refresh / new tab scenarios
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
        .catch(() => {
          // CSRF init failed, will retry on next mutating request
        });
    }
  }, [isHydrated, jwtToken, csrfToken]);

  // Sync user to localStorage — skip before hydration to avoid clearing stored values
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  // Sync CSRF token to sessionStorage + cookie — skip before hydration
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
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
  }, [csrfToken]);

  // Sync JWT to localStorage — skip before hydration to avoid clearing stored values
  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    if (jwtToken) {
      localStorage.setItem(JWT_STORAGE_KEY, jwtToken);
    } else {
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  }, [jwtToken]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    setJwtToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem(JWT_STORAGE_KEY);
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
    [user, csrfToken, jwtToken, isHydrated, clearAuth]
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
