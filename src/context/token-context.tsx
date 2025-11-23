"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchTokenStats, type TokenStats } from "@/lib/api/tokens";
import { useAuth } from "@/context/auth-context";

const MAX_TOKEN_BUDGET = 2_000_000;

interface TokenContextValue {
  usagePercent: number;
  isLoading: boolean;
  stats: TokenStats;
}

const TokenContext = createContext<TokenContextValue | undefined>(undefined);

export function TokenProvider({ children }: { children: ReactNode }) {
  const { csrfToken } = useAuth();
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
        const data = await fetchTokenStats(csrfToken);
        if (isMounted) {
          setStats(data);
        }
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
  }, [csrfToken]);

  const computedUsagePercent = Math.min(
    100,
    Math.round((stats.totalTokensUsed / MAX_TOKEN_BUDGET) * 100)
  );

  const usagePercent = Math.max(85, computedUsagePercent); // Temporary floor to surface upgrade CTA during layout review.

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
