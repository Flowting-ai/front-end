"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { ModelSelector } from "../chat/model-selector";
import { TokenTracker } from "../chat/token-tracker";
import type { AIModel } from "@/types/ai-model";
import type { PinType } from "./right-sidebar";
import { useTokenUsage } from "@/context/token-context";
import { useAuth } from "@/context/auth-context";
import { UserRoundPen, UserRoundPlus, Share2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/lib/toast-helper";

interface TopbarProps {
  children?: ReactNode;
  selectedModel: AIModel | null;
  useFramework: boolean;
  onModelSelect: (model: AIModel | null) => void;
  onFrameworkChange: (useFramework: boolean) => void;
  onPinsSelect?: (pinIds: string[]) => void;
  chatBoards?: Array<{ id: string; name: string }>;
  activeChatId?: string | null;
  hasMessages?: boolean;
  pins?: PinType[];
}

export function Topbar({
  children,
  selectedModel,
  onModelSelect,
  useFramework,
  onFrameworkChange,
  onPinsSelect,
  chatBoards = [],
  activeChatId,
  hasMessages = false,
  pins = [],
}: TopbarProps) {
  const { usagePercent, isLoading } = useTokenUsage();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const showUpgradePlan = !isLoading && usagePercent >= 80;
  const firstName =
    (user?.firstName as string | undefined) ||
    (user?.name as string | undefined)?.split(" ")[0] ||
    "User";

  const isHomePage = pathname === "/";
  const isPersonaAdminPage = pathname === "/personaAdmin";
  const isPersonasPage = pathname?.startsWith("/personas");
  const isPersonaAdminChatPage = pathname?.startsWith("/personaAdmin/chat/");
  const isWorkflowAdminChatPage = pathname?.startsWith("/workflowAdmin/chat/");

  return (
    <header className="z-40 sticky top-0 w-full bg-main-bg1">
      <div className="w-full min-h-[56px] h-[56px] border-b border-main-border flex items-center justify-between gap-4 px-3 py-2">
        <div className="min-w-0 flex-1 flex items-center gap-4 flex-wrap lg:flex-nowrap">
          {/* Left side content */}
          {isPersonaAdminChatPage && (
            <Button
              onClick={() => router.push("/personaAdmin")}
              className="flex items-center gap-2 h-9 px-4 bg-tb-button-bg text-tb-button-text hover:bg-tb-button-bg-hover rounded-lg ml-9"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {isWorkflowAdminChatPage && (
            <Button
              onClick={() => router.push("/workflowAdmin")}
              className="flex items-center gap-2 h-9 px-4 bg-tb-button-bg text-tb-button-text hover:bg-tb-button-bg-hover rounded-lg ml-9"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {isHomePage && children ? (
            <div className="shrink-0 lg:hidden">{children}</div>
          ) : null}
          {isHomePage && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={onModelSelect}
              useFramework={useFramework}
              onFrameworkChange={onFrameworkChange}
              onPinsSelect={onPinsSelect}
              chatBoards={chatBoards}
              activeChatId={activeChatId}
              hasMessages={hasMessages}
              pins={pins}
            />
          )}
          {(isHomePage || isPersonaAdminPage || isPersonasPage) && (
            <div className="flex items-center gap-3">
              {showUpgradePlan ? (
                <Button
                  variant="secondary"
                  className="cursor-pointer w-[122px] h-[33px] font-inter font-normal text-sm text-tb-button2-text bg-tb-button2-bg hover:text-tb-button2-text-hover hover:bg-tb-button2-bg-hover rounded-[8px] flex items-center justify-center px-4"
                >
                  Upgrade Plan
                </Button>
              ) : null}
              {isPersonasPage && (
                <Button
                  variant="outline"
                  className="cursor-pointer flex items-center gap-2 h-9 px-4 rounded-[8px] border-main-border"
                  onClick={() => window.location.href = '/personaAdmin'}
                >
                  Go to Command Center
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Right side content */}
          {isPersonaAdminChatPage && (
            <Button
              onClick={() => {
                toast.info("Share", {
                  description: "Share persona feature coming soon.",
                });
              }}
              className="pointer-events-none text-sm text-[#0A0A0A]/30 bg-white hover:bg-zinc-100 border border-[#D4D4D4] rounded-[8px] shadow-sm flex items-center gap-2 px-4 h-9 transition-all duration-300 mr-9"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>
          )}
          {isWorkflowAdminChatPage && (
            <Button
              onClick={() => {
                toast.info("Share", {
                  description: "Share workflow feature coming soon.",
                });
              }}
              className="pointer-events-none text-sm text-[#0A0A0A]/30 bg-white hover:bg-zinc-100 border border-[#D4D4D4] rounded-[8px] shadow-sm flex items-center gap-2 px-4 h-9 transition-all duration-300 mr-9"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>
          )}
          {isHomePage && !user && (
            <Link href="/auth/login">
              <Button
                className="cursor-pointer w-[122px] h-[38px] font-inter font-normal text-sm text-white bg-[#1E1E1E] hover:bg-[#2E2E2E] rounded-[7px] flex items-center justify-center gap-2 px-4 py-0 transition-all duration-300"
              >
                <UserRoundPen className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
          {/* {isPersonaAdminPage && (
            <Link href="/personas/new">
              <Button
                className="cursor-pointer w-[173px] h-[38px] font-inter font-normal text-sm text-white bg-[#1E1E1E] hover:bg-[#2E2E2E] rounded-[7px] flex items-center justify-center gap-2 px-4 py-0 transition-all duration-300"
              >
                <UserRoundPen className="h-3.5 w-3.5" />
                Create New Persona
              </Button>
            </Link>
          )} */}
        </div>
      </div>
    </header>
  );
}
