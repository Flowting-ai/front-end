"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser } from "@/lib/api/user";
import { useAuth } from "@/context/auth-context";

interface TokenContextValue {
  usagePercent: number;
  isLoading: boolean;
}

const TokenContext = createContext<TokenContextValue | undefined>(undefined);

export function TokenProvider({ children }: { children: ReactNode }) {
  const { csrfToken, jwtToken, isHydrated, user, setUser } = useAuth();
  const [usagePercent, setUsagePercent] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated || !jwtToken) return;

    let isMounted = true;
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const profile = await fetchCurrentUser(csrfToken);
        if (isMounted && profile) {
          setUsagePercent(Math.min(100, Math.round(profile.budgetConsumedPercent ?? 0)));
          if (user === null || Object.keys(user).length === 0) {
            setUser(profile as unknown as Parameters<typeof setUser>[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load token stats", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isHydrated, jwtToken, csrfToken, setUser, user]);

  return (
    <TokenContext.Provider value={{ usagePercent, isLoading }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokenUsage(): TokenContextValue {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error("useTokenUsage must be used within a TokenProvider");
  }
  return context;
}
