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
  const { isHydrated, user, setUser } = useAuth();
  const [usagePercent, setUsagePercent] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    let isMounted = true;
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const profile = await fetchCurrentUser();
        if (isMounted && profile) {
          setUsagePercent(0);
          if (user === null || Object.keys(user).length === 0) {
            setUser({
              email: profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name,
              name: `${profile.first_name} ${profile.last_name}`.trim(),
              phoneNumber: profile.phone_number ?? null,
            });
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
  }, [isHydrated, setUser, user]);

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
