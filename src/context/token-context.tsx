"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTokenStats, type TokenStats } from "@/lib/api/tokens";
import { fetchCurrentUser } from "@/lib/api/user";
import { useAuth } from "@/context/auth-context";

interface TokenContextValue {
  usagePercent: number;
  isLoading: boolean;
  stats: TokenStats;
}

const TokenContext = createContext<TokenContextValue | undefined>(undefined);

export function TokenProvider({ children }: { children: ReactNode }) {
  const { csrfToken, user, setUser } = useAuth();
  const [stats, setStats] = useState<TokenStats>({
    availableTokens: 0,
    totalTokensUsed: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      setIsLoading(true);
      try {
        // Prefer /user/ because it returns both profile + token info.
        const profile = await fetchCurrentUser(csrfToken);
        if (isMounted && profile) {
          setStats({
            availableTokens: Number(profile.availableTokens ?? 0),
            totalTokensUsed: Number(profile.totalTokensUsed ?? 0),
          });
          // Hydrate missing profile fields into auth context if we don't have them.
          if (user === null || Object.keys(user).length === 0) {
            setUser(profile as unknown as Parameters<typeof setUser>[0]);
          }
          return;
        }
        // Fallback to /tokens/ if /user/ is unavailable.
        const data = await fetchTokenStats(csrfToken);
        if (isMounted) setStats(data);
      } catch (error) {
        console.error("Failed to load token stats", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [csrfToken, setUser, user]);

  // Compute percent based on used vs available from /user/.
  const totalBudget = stats.totalTokensUsed + stats.availableTokens;
  const usagePercent =
    totalBudget > 0
      ? Math.min(100, Math.round((stats.totalTokensUsed / totalBudget) * 100))
      : 0;

  return (
    <TokenContext.Provider value={{ usagePercent, isLoading, stats }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokenUsage() {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error("useTokenUsage must be used within a TokenProvider");
  }
  return context;
}
