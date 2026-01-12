"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { ModelSelector } from "../chat/model-selector";
import { TokenTracker } from "../chat/token-tracker";
import type { AIModel } from "@/types/ai-model";
import { useTokenUsage } from "@/context/token-context";
import { useAuth } from "@/context/auth-context";
import { UserRoundPen, UserRoundPlus } from "lucide-react";
import Link from "next/link";

interface TopbarProps {
  children?: ReactNode;
  selectedModel: AIModel | null;
  onModelSelect: (model: AIModel) => void;
}

export function Topbar({
  children,
  selectedModel,
  onModelSelect,
}: TopbarProps) {
  const { usagePercent, isLoading } = useTokenUsage();
  const { user } = useAuth();
  const showUpgradePlan = !isLoading && usagePercent >= 80;
  const firstName =
    (user?.firstName as string | undefined) ||
    (user?.name as string | undefined)?.split(" ")[0] ||
    (user?.username as string | undefined) ||
    "User";

  return (
    <header className="sticky top-0 z-40 w-full bg-white">
      <div className="h-[56px] w-full border-b border-main-border flex items-center justify-between gap-4 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 lg:flex-nowrap">
          {/* ...existing code... */}
          {children ? (
            <div className="shrink-0 lg:hidden">{children}</div>
          ) : null}
          <ModelSelector
            selectedModel={selectedModel}
            onModelSelect={onModelSelect}
          />
          <div className="flex items-center gap-3">
            {/* Token count visual (progress bar + percentage) */}
            {/* <TokenTracker /> */}

            {/* commenting out this feature since we dont want the userr to be pestered or worried about their token exhaustion haha */}
            {/* * Token Count Visual:
             * - Rendered via the `TokenTracker` component in the header’s right-side group.
             * - `TokenTracker` reads `usagePercent`, `stats`, and `isLoading` from `useTokenUsage()`.
             * - Displays label + percentage, a progress bar whose fill width = `usagePercent`, and used/budget text.
             * - Upgrade CTA (`Upgrade Plan`) appears when `usagePercent >= 80`.
             *
             * Data source: values provided by `TokenProvider` in src/context/token-context.tsx.
             */}

            {/* variable: showUpgradePlan */}
            {showUpgradePlan ? (
              <Button
                variant="secondary"
                className="cursor-pointer w-[122px] h-[33px] font-inter font-[500] text-[14px] text-[#1E1E1E] bg-[#F5F5F5] hover:text-[#1E1E1E] hover:bg-[#DCDCDC] rounded-[7px] flex items-center justify-center px-4"
              >
                Upgrade Plan
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {user && <span className="text-[14px] text-[#1E1E1E] hidden md:inline-block">
            Hi, {firstName}
          </span>}
          {/* Sign Up */}
          {/* {!user && (
            <Link href="/auth/signup">
              <Button
                className="cursor-pointer w-[130px] h-[38px] font-inter font-[400] text-[14px] text-[#1E1E1E] bg-[#F5F5F5] hover:text-[#1E1E1E] hover:bg-[#DCDCDC] rounded-[7px] flex items-center justify-center gap-2 px-8 py-0 transition-all duration-300"
              >
                <UserRoundPlus className="h-4 w-4" />
                Get Started
              </Button>
            </Link>
          )} */}

          {/* Sign In */}
          {!user && (
            <Link href="/auth/login">
              <Button
                className="cursor-pointer w-[122px] h-[38px] font-inter font-[400] text-[14px] text-white bg-[#1E1E1E] hover:bg-[#2E2E2E] rounded-[7px] flex items-center justify-center gap-2 px-4 py-0 transition-all duration-300"
              >
                <UserRoundPen className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
