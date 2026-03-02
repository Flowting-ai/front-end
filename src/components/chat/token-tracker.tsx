"use client";

import { useTokenUsage } from "@/context/token-context";
import { useAuth } from "@/context/auth-context";

export function TokenTracker() {
  const { usagePercent, isLoading } = useTokenUsage();
  const { user } = useAuth();

  const formattedBudgetUsed = user?.budgetUsed ? `$${user.budgetUsed}` : "--";
  const formattedBudget = user?.budget ? `$${user.budget}` : "--";

  return (
    <div className="flex w-[235px] flex-col items-center gap-0.5">
      {/* Token count label + percentage */}
      <div className="flex w-full items-center justify-between text-[12px] leading-tight text-[#1E1E1E]">
        <span className="truncate">Token count</span>
        <span className="text-[#757575]">
          {isLoading ? "--" : `${usagePercent}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-[8px] w-[235px]">
        <div className="absolute left-0 top-0 h-[8px] w-[235px] overflow-hidden">
          {/* Background */}
          <div className="absolute h-full w-full top-0 right-0 bottom-0 left-0 rounded-[10px] bg-[#D4D4D4]" />
          {/* Progress fill */}
          <div
            className="absolute h-full top-0 bottom-0 left-0 rounded-[10px] bg-[#1A1A1A]"
            style={{ width: `${Math.max(0, Math.min(100, usagePercent))}%` }}
          />
        </div>
      </div>

      {/* Token usage text */}
      <div className="w-full text-right text-[10px] leading-[129%] text-[#757575]">
        {isLoading ? "Updating..." : `${formattedBudgetUsed}/${formattedBudget}`}
      </div>
    </div>
  );
}
