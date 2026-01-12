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

export interface AuthUser {
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: AuthUser | null;
  csrfToken: string | null;
  setUser: (user: AuthUser | null) => void;
  setCsrfToken: (token: string | null) => void;
  clearAuth: () => void;
}

const USER_STORAGE_KEY = "auth:user";
const CSRF_STORAGE_KEY = "auth:csrftoken";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedToken = localStorage.getItem(CSRF_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedToken) {
        setCsrfToken(storedToken);
      }
    } catch (error) {
      console.error("Failed to hydrate auth state", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (csrfToken) {
      localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
      try {
        // Mirror token into a cookie so Django's CSRF check sees both header + cookie in cross-site calls.
        document.cookie = `csrftoken=${encodeURIComponent(
          csrfToken
        )}; path=/; SameSite=None; Secure`;
      } catch (error) {
        console.warn("Failed to set CSRF cookie", error);
      }
    } else {
      localStorage.removeItem(CSRF_STORAGE_KEY);
      try {
        document.cookie = "csrftoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
      } catch (error) {
        console.warn("Failed to clear CSRF cookie", error);
      }
    }
  }, [csrfToken]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setCsrfToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem("isLoggedIn");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      setUser,
      setCsrfToken,
      clearAuth,
    }),
    [user, csrfToken, clearAuth]
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
