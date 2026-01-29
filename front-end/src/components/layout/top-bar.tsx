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
import { usePathname } from "next/navigation";

interface TopbarProps {
  children?: ReactNode;
  selectedModel: AIModel | null;
  useFramework: boolean;
  onModelSelect: (model: AIModel | null) => void;
  onFrameworkChange: (useFramework: boolean) => void;
  chatBoards?: Array<{ id: string; name: string }>;
}

export function Topbar({
  children,
  selectedModel,
  onModelSelect,
  useFramework,
  onFrameworkChange,
  chatBoards = [],
}: TopbarProps) {
  const { usagePercent, isLoading } = useTokenUsage();
  const { user } = useAuth();
  const pathname = usePathname();
  const showUpgradePlan = !isLoading && usagePercent >= 80;
  const firstName =
    (user?.firstName as string | undefined) ||
    (user?.name as string | undefined)?.split(" ")[0] ||
    (user?.username as string | undefined) ||
    "User";

  const isHomePage = pathname === "/";
  const isPersonaAdminPage = pathname === "/personaAdmin";
  const isPersonasPage = pathname?.startsWith("/personas");

  return (
    <header className="sticky top-0 z-40 w-full bg-white">
      <div className="h-[56px] w-full border-b border-main-border flex items-center justify-between gap-4 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 lg:flex-nowrap">
          {/* Left side content */}
          {isHomePage && children ? (
            <div className="shrink-0 lg:hidden">{children}</div>
          ) : null}
          {isHomePage && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={onModelSelect}
              useFramework={useFramework}
              onFrameworkChange={onFrameworkChange}
              chatBoards={chatBoards}
            />
          )}
          {(isHomePage || isPersonaAdminPage || isPersonasPage) && (
            <div className="flex items-center gap-3">
              {showUpgradePlan ? (
                <Button
                  variant="secondary"
                  className="cursor-pointer w-[122px] h-[33px] font-inter font-[500] text-[14px] text-[#1E1E1E] bg-[#F5F5F5] hover:text-[#1E1E1E] hover:bg-[#DCDCDC] rounded-[7px] flex items-center justify-center px-4"
                >
                  Upgrade Plan
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Right side content */}
          {isHomePage && user && (
            <span className="text-[14px] text-[#1E1E1E] hidden md:inline-block">
              Hi, {firstName}
            </span>
          )}
          {isHomePage && !user && (
            <Link href="/auth/login">
              <Button
                className="cursor-pointer w-[122px] h-[38px] font-inter font-[400] text-[14px] text-white bg-[#1E1E1E] hover:bg-[#2E2E2E] rounded-[7px] flex items-center justify-center gap-2 px-4 py-0 transition-all duration-300"
              >
                <UserRoundPen className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
          {isPersonaAdminPage && (
            <Link href="/personas/new">
              <Button
                className="cursor-pointer w-[173px] h-[38px] font-inter font-[400] text-[14px] text-white bg-[#1E1E1E] hover:bg-[#2E2E2E] rounded-[7px] flex items-center justify-center gap-2 px-4 py-0 transition-all duration-300"
              >
                <UserRoundPen className="h-3.5 w-3.5" />
                Create New Persona
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
