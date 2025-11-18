"use client";

import { useEffect, useMemo, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { fetchTokenStats, type TokenStats } from "@/lib/api/tokens";
import { useAuth } from "@/context/auth-context";

export function TokenTracker() {
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

  const { usagePercent, remainingFormatted } = useMemo(() => {
    const totalBudget = Math.max(
      1,
      stats.availableTokens + stats.totalTokensUsed
    );
    const percent = Math.min(
      100,
      (stats.totalTokensUsed / totalBudget) * 100
    );
    const formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    });
    return {
      usagePercent: Math.round(percent),
      remainingFormatted: formatter.format(stats.availableTokens),
    };
  }, [stats.availableTokens, stats.totalTokensUsed]);

  return (
    <div className="flex flex-col gap-1 w-full text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Token usage</span>
        <span className="font-mono text-xs">
          {isLoading ? "…" : `${usagePercent}% used`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Progress
          value={usagePercent}
          className="h-2 flex-grow"
          indicatorClassName="bg-green-500"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {remainingFormatted} left
        </span>
      </div>
    </div>
  );
}
