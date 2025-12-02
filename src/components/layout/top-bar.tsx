'use client';

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { CreatePersonaDialog } from "../personas/create-persona-dialog";
import { ModelSelector } from "../chat/model-selector";
import { TokenTracker } from "../chat/token-tracker";
import type { AIModel } from "@/types/ai-model";
import { useTokenUsage } from "@/context/token-context";
import { useAuth } from "@/context/auth-context";
import { UserRoundPen } from "lucide-react";
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
    "there";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D9D9D9] bg-white">
      <div className="flex h-[57px] w-full items-center justify-between gap-4 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 lg:flex-nowrap">
          {children ? (
            <div className="flex-shrink-0 lg:hidden">{children}</div>
          ) : null}
          <ModelSelector
            selectedModel={selectedModel}
            onModelSelect={onModelSelect}
          />
          <div className="flex items-center gap-3">
            <TokenTracker />
            {showUpgradePlan ? (
              <Button
                variant="secondary"
                className="flex h-[36px] w-[122px] items-center justify-center rounded-full bg-[#F5F5F5] px-4 text-sm font-medium text-[#1E1E1E] hover:bg-[#DCDCDC] hover:text-[#1E1E1E]"
              >
                Upgrade Plan
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="text-sm text-[#1E1E1E] hidden md:inline-block">
            Hi, {firstName}
          </span>
          <CreatePersonaDialog triggerClassName="border-[#D4D4D4] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] hover:text-[#1E1E1E]" />
          {!user && (
            <Link href="/auth/login">
              <Button
                className="flex h-[38px] min-h-[32px] items-center justify-center gap-2 rounded-full bg-[#1E1E1E] px-1.5 py-[8.5px] text-sm font-medium text-white hover:bg-[#2E2E2E]"
                style={{ width: '126.25px' }}
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
