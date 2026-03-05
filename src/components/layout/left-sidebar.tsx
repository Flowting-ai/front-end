"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronsLeft,
  Settings,
  LogOut,
  Search,
  HelpCircle,
  TrendingUp,
  User,
  UserCog,
  CreditCard,
  PanelLeft,
  ChevronUp,
  ChevronDown,
  Workflow,
  UserRoundPen,
  LogIn,
  Database,
  Folder,
  Zap,
  Brain,
  Palette,
  Shield,
  CircleHelp,
  Route,
  Cable,
  Bell,
  UsersRound,
} from "lucide-react";
import { TableColumnIcon } from "@/components/icons/table-column";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChatHistoryItem } from "./chat-history-item";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import type { ChatBoard, ChatBoardType } from "./app-layout";
import { useAuth } from "@/context/auth-context";
import { AppLayoutContext } from "./app-layout";
import chatStyles from "../chat/chat-interface.module.css";
import { workflowAPI } from "@/components/workflows/workflow-api";
import type { WorkflowMetadata } from "@/components/workflows/types";
import {
  fetchPersonas as fetchPersonasApi,
  type PersonaStatus,
} from "@/lib/api/personas";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  chatBoards: ChatBoard[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddChat: (typeOverride?: ChatBoardType | null) => void;
  renamingChatId: string | null;
  setRenamingChatId: (id: string | null) => void;
  renamingText: string;
  setRenamingText: (text: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  handleDeleteClick: (board: ChatBoard) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  isRenamingPending: boolean;
  onToggleStar: (board: ChatBoard) => void;
  starUpdatingChatId: string | null;
}

export function LeftSidebar({
  isCollapsed,
  onToggle,
  chatBoards,
  activeChatId,
  setActiveChatId,
  onAddChat,
  renamingChatId,
  setRenamingChatId,
  renamingText,
  setRenamingText,
  renameInputRef,
  handleDeleteClick,
  onRenameConfirm,
  onRenameCancel,
  isRenamingPending,
  onToggleStar,
  starUpdatingChatId,
}: LeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, csrfToken } = useAuth();
  const layoutContext = React.useContext(AppLayoutContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [isChatBoardsExpanded, setIsChatBoardsExpanded] = useState(true);

  // Track the displayed length of titles that are animating (typewriter effect)
  const [displayedTitleLengths, setDisplayedTitleLengths] = useState<
    Map<string, number>
  >(new Map());

  // Track which animations have completed so we don't restart them
  const completedAnimationsRef = React.useRef<Set<string>>(new Set());

  // Keep refs so the interval always reads fresh values without restarting
  const chatBoardsRef = React.useRef(chatBoards);
  chatBoardsRef.current = chatBoards;
  const getAnimatingTitleRef = React.useRef(layoutContext?.getAnimatingTitle);
  getAnimatingTitleRef.current = layoutContext?.getAnimatingTitle;

  // Typewriter effect for chat titles — runs a single interval for the lifetime of the component
  React.useEffect(() => {
    const timer = setInterval(() => {
      const getAnimatingTitle = getAnimatingTitleRef.current;
      if (!getAnimatingTitle) return;

      setDisplayedTitleLengths((prev) => {
        const boards = chatBoardsRef.current;
        const next = new Map(prev);
        let hasChanges = false;

        boards.forEach((board) => {
          const animInfo = getAnimatingTitle(board.id);
          if (animInfo) {
            // Skip if this animation already completed
            const animKey = `${board.id}:${animInfo.timestamp}`;
            if (completedAnimationsRef.current.has(animKey)) return;

            const currentLength = prev.get(board.id) ?? 0;
            const targetLength = animInfo.targetTitle.length;

            if (currentLength < targetLength) {
              next.set(board.id, currentLength + 1);
              hasChanges = true;
            } else {
              // Animation complete — mark done and clean up
              completedAnimationsRef.current.add(animKey);
              if (prev.has(board.id)) {
                next.delete(board.id);
                hasChanges = true;
              }
            }
          } else {
            if (prev.has(board.id)) {
              next.delete(board.id);
              hasChanges = true;
            }
          }
        });

        return hasChanges ? next : prev;
      });
    }, 15);

    return () => clearInterval(timer);
  }, []); // stable — reads from refs

  // Expand "Recent chats" when on workflow or persona pages (including chat pages)
  React.useEffect(() => {
    if (
      pathname?.startsWith("/workflowAdmin") ||
      pathname?.startsWith("/personaAdmin")
    ) {
      setIsChatBoardsExpanded(true);
    } else if (pathname === "/" || pathname?.startsWith("/chat")) {
      setIsChatBoardsExpanded(true);
    } else {
      setIsChatBoardsExpanded(false);
    }
  }, [pathname]);

  const userFirstName = (() => {
    const fromName = user?.name?.trim();
    if (fromName) {
      return fromName;
    }
    if (typeof user?.firstName === "string") {
      const first = user.firstName.split("@")[0];
      if (first) return first;
    }
    return "Test";
  })();
  const userLastName = (() => {
    const fromName = user?.name?.trim();
    if (fromName) {
      return fromName;
    }
    if (typeof user?.lastName === "string") {
      const first = user.lastName.split("@")[0];
      if (first) return first;
    }
    return "User";
  })();

  // Determine if user is on chat board route
  const isOnChatBoard = pathname === "/" || pathname?.startsWith("/chat");

  // Determine if user is on persona pages
  const isOnPersonaPage =
    pathname?.startsWith("/personaAdmin") || pathname?.startsWith("/personas");

  // Determine if user is on workflow pages
  const isOnWorkflowPage =
    pathname?.startsWith("/workflowAdmin") ||
    pathname?.startsWith("/workflows");
  const isOnWorkflowChatPage = pathname?.startsWith("/workflowAdmin/chat");
  const activeWorkflowIdFromUrl =
    pathname?.match(/\/workflowAdmin\/chat\/([^/]+)/)?.[1] ?? null;

  // Determine if user is on persona chat page
  const isOnPersonaChatPage = pathname?.startsWith("/personaAdmin/chat");
  const activePersonaIdFromUrl =
    pathname?.match(/\/personaAdmin\/chat\/([^/]+)/)?.[1] ?? null;

  // Determine if user is on settings-related pages
  const isSettingsSectionRoute = pathname?.startsWith("/settings");
  const isAccountRoute = pathname?.startsWith("/settings/account");
  const isUsageAndBillingRoute = pathname?.startsWith(
    "/settings/usage-and-billing",
  );
  const isRoutingRoute = pathname?.startsWith("/settings/routing");
  const isMemoryAndContextRoute = pathname?.startsWith(
    "/settings/memory-and-context",
  );
  const isFilesAndDataRoute = pathname?.startsWith("/settings/files-and-data");
  const isAutomationsRoute = pathname?.startsWith("/settings/automations");
  const isAIandModelsRoute = pathname?.startsWith("/settings/ai-and-models");
  const isIntegrationsRoute = pathname?.startsWith("/settings/integrations");
  const isNotificationsRoute = pathname?.startsWith("/settings/notifications");
  const isAppearanceRoute = pathname?.startsWith("/settings/appearance");
  const isSecurityRoute = pathname?.startsWith("/settings/security");
  const isTeamsAndRolesRoute = pathname?.startsWith(
    "/settings/teams-and-roles",
  );
  const isHelpAndLegalRoute = pathname?.startsWith("/settings/help-and-legal");

  // Persist settings nav scroll position across settings routes
  const settingsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const activeSettingsItemRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (!isSettingsSectionRoute) return;
    const stored =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("settingsScrollTop")
        : null;
    if (stored && settingsScrollRef.current) {
      const value = Number(stored);
      if (!Number.isNaN(value)) {
        settingsScrollRef.current.scrollTop = value;
      }
    }
  }, [isSettingsSectionRoute]);

  // Ensure the active settings item is fully visible inside the scroll container
  React.useEffect(() => {
    if (!isSettingsSectionRoute) return;
    const container = settingsScrollRef.current;
    const activeItem = activeSettingsItemRef.current;
    if (!container || !activeItem) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    // Add a small margin so the item isn't flush with the edge
    const margin = 6;

    if (itemRect.top < containerRect.top + margin) {
      container.scrollTop += itemRect.top - containerRect.top - margin;
    } else if (itemRect.bottom > containerRect.bottom - margin) {
      container.scrollTop += itemRect.bottom - containerRect.bottom + margin;
    }
  }, [pathname, isSettingsSectionRoute]);

  const handleSettingsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "settingsScrollTop",
      String(event.currentTarget.scrollTop),
    );
  };

  // Fetch workflows for "Recent Workflow chats" when on workflow pages
  const [workflowList, setWorkflowList] = useState<WorkflowMetadata[]>([]);
  const [workflowListLoading, setWorkflowListLoading] = useState(false);
  useEffect(() => {
    if (!isOnWorkflowPage) return;
    let cancelled = false;
    setWorkflowListLoading(true);
    workflowAPI
      .list()
      .then(({ workflows }) => {
        if (!cancelled) setWorkflowList(workflows);
      })
      .catch(() => {
        if (!cancelled) setWorkflowList([]);
      })
      .finally(() => {
        if (!cancelled) setWorkflowListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnWorkflowPage]);

  // Fetch personas for "Recent Persona chats" when on persona pages
  const [personaList, setPersonaList] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  const [personaListLoading, setPersonaListLoading] = useState(false);
  useEffect(() => {
    if (!isOnPersonaPage) return;
    let cancelled = false;
    setPersonaListLoading(true);
    fetchPersonasApi()
      .then((personas) => {
        if (!cancelled) {
          // Map all personas for recent persona chats
          const personasList = personas.map((p) => ({
            id: p.id,
            name: p.name,
            isActive: true,
          }));
          setPersonaList(personasList);
        }
      })
      .catch(() => {
        if (!cancelled) setPersonaList([]);
      })
      .finally(() => {
        if (!cancelled) setPersonaListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnPersonaPage]);

  const normalizedWorkflowSearch = searchTerm.trim().toLowerCase();
  const workflowsToDisplay = useMemo(() => {
    if (!normalizedWorkflowSearch) return workflowList;
    return workflowList.filter((wf) =>
      wf.name.toLowerCase().includes(normalizedWorkflowSearch),
    );
  }, [workflowList, normalizedWorkflowSearch]);

  const normalizedPersonaSearch = searchTerm.trim().toLowerCase();
  const personasToDisplay = useMemo(() => {
    if (!normalizedPersonaSearch) return personaList;
    return personaList.filter((p) =>
      p.name.toLowerCase().includes(normalizedPersonaSearch),
    );
  }, [personaList, normalizedPersonaSearch]);

  // Dynamic button text based on current page
  const chatBoardButtonText = isOnChatBoard ? "New Chat Board" : "Chat Board";

  // Determine which chat board type to display based on current route
  const currentBoardType = isOnPersonaPage
    ? "persona"
    : isOnWorkflowPage
      ? "workflow"
      : "chat";

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const boardsToDisplay = chatBoards.filter((board) => {
    // Filter by type - default to "chat" if no type is set (for backward compatibility)
    const boardType = board.type || "chat";
    if (boardType !== currentBoardType) return false;

    // Filter by search term
    if (!normalizedSearch) return true;
    const haystack = `${board.name} ${board.time ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <section
      className={cn(
        "max-w-[240px] w-full h-screen bg-lsb-bg border-r border-main-border transition-all duration-500 overflow-hidden",
        isCollapsed && "max-w-[72px]",
      )}
    >
      {isCollapsed ? (
        // === COLLAPSED SIDEBAR ===
        <aside className="w-full h-full flex flex-col">
          {/* 1. Logo + ToggleIcon */}
          <div className="w-full min-h-[56px] h-[56px] px-4">
            <div className="group relative w-full h-full border-b border-main-border flex items-center justify-center">
              {/* Open Sidebar Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="cursor-pointer absolute top-[50%] left-[50%] -translate-1/2 w-full max-h-[56px] h-full flex items-center justify-center gap-2 group-hover:opacity-0 transition-all duration-500"
                  >
                    <Image
                      src="/icons/logo.png"
                      width={23}
                      height={23}
                      alt="Flowting AI Logo"
                      className="object-contain"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={"right"}>
                  <p>Open Sidebar</p>
                </TooltipContent>
              </Tooltip>

              <div className="text-lsb-panelleft-normal group-hover:text-lsb-panelleft-hover group-hover:bg-zinc-200 rounded-sm opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 transition-all duration-300">
                <PanelLeft size={20} strokeWidth={1.3} />
              </div>
            </div>
          </div>

          {/* 2. Buttons - (flexing to remaining height) */}
          <div className="flex flex-1 flex-col items-center gap-3 py-6">
            {/* Button 1 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={isOnChatBoard ? "New Chat Board" : "Chat Board"}
                  className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-main-border hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
                  onClick={() => {
                    onAddChat("chat");
                  }}
                >
                  <Image
                    src="/icons/chatboard.svg"
                    alt="chatboard"
                    width={16}
                    height={16}
                    className="object-contain filter brightness-0"
                    style={{ height: "auto" }}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="pointer-events-none px-2 py-1 text-xs font-medium"
              >
                {isOnChatBoard ? "New Chat Board" : "Chat Board"}
              </TooltipContent>
            </Tooltip>

            {/* Button 2 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="AI Personas"
                  className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-main-border hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
                  onClick={() => router.push("/personaAdmin")}
                >
                  <UserRoundPen
                    className={cn(
                      "h-5 w-5",
                      isOnPersonaPage ? "text-[#303030]" : "text-[#303030]",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="pointer-events-none px-2 py-1 text-xs font-medium"
              >
                AI Personas
              </TooltipContent>
            </Tooltip>

            {/* Button 3 - Workflows */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Flow Builder"
                  className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-main-border hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
                  onClick={() => router.push("/workflowAdmin")}
                >
                  {/* <BotMessageSquare
                    className={cn(
                      "h-5 w-5",
                      pathname?.startsWith("/workflowAdmin") ? "text-[#303030]" : "text-[#303030]"
                    )}
                  /> */}
                  <Workflow
                    className={cn(
                      "h-5 w-5",
                      isOnWorkflowPage ? "text-[#303030]" : "text-[#303030]",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="pointer-events-none px-2 py-1 text-xs font-medium"
              >
                Flow Builder
              </TooltipContent>
            </Tooltip>

            {/* 3. User Footer */}
            <div className="w-full mt-auto flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer h-10 w-10 bg-transparent hover:bg-zinc-200 border border-main-border rounded-2xl"
                    aria-label="User settings"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  className="bg-white border-[#E5E5E5] rounded-lg p-1.5"
                  style={{ width: "222px", gap: "8px" }}
                >
                  {/* {!user && ( */}
                  <DropdownMenuItem
                    disabled
                    className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <User className="h-4 w-4 text-lsb-text" />
                    Profile
                  </DropdownMenuItem>
                  {/* )} */}
                  <DropdownMenuItem
                    disabled
                    className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <TrendingUp className="h-4 w-4 text-lsb-text" />
                    Upgrade Plan
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <Settings className="h-4 w-4 text-lsb-text" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <HelpCircle className="h-4 w-4 text-lsb-text" />
                    Help
                  </DropdownMenuItem>
                  {user ? (
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                    >
                      <LogOut className="h-4 w-4 text-lsb-text" />
                      Logout
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => router.push("/auth/login")}
                      className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                    >
                      <LogIn className="h-4 w-4 text-lsb-text" />
                      Sign In
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      ) : (
        // === OPEN SIDEBAR ===
        <aside className="w-full h-full flex flex-col">
          {/* 1. Header */}
          <div className="w-full h-[56px] px-4">
            <div className="w-full h-full border-b border-main-border flex items-center justify-between">
              <div className="min-h-[56px] h-[56px] flex items-center gap-2">
                {isSettingsSectionRoute ? (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="cursor-pointer flex items-center justify-center rounded-md p-1 text-lsb-panelleft-normal hover:text-lsb-panelleft-active hover:bg-zinc-200 transition-all duration-300"
                    >
                      <ChevronsLeft size={18} strokeWidth={1.5} />
                    </button>
                    <h3 className="font-clash font-normal text-[18px] transition-all duration-300 overflow-hidden whitespace-nowrap">
                      Settings
                    </h3>
                  </>
                ) : (
                  <>
                    <Image
                      src="/icons/logo.png"
                      width={23}
                      height={23}
                      alt="Flowting AI Logo"
                    />
                    <h3 className="font-clash font-normal text-[18px] transition-all duration-300 overflow-hidden whitespace-nowrap">
                      SouvenirAI
                    </h3>
                  </>
                )}
              </div>
              {!isSettingsSectionRoute && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggle}
                      className="cursor-pointer text-lsb-panelleft-normal hover:text-lsb-panelleft-active hover:bg-zinc-200 rounded-sm flex items-center justify-center p-1 transition-all duration-300"
                    >
                      <PanelLeft size={20} strokeWidth={1.3} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side={"bottom"}>
                    <p>Close Sidebar</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {isSettingsSectionRoute ? (
            // Settings navigation layout
            <div className="w-full flex-1 flex flex-col px-0 py-2 gap-4 font-inter overflow-hidden">
              {/* Row 2: Search settings */}
              <div className="relative mx-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9F9F9F]" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search settings"
                  className="h-9 w-full rounded-[8px] border border-[#E5E5E5] bg-white pl-9 pr-3 text-sm text-[#1E1E1E] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
                  type="search"
                  aria-label="Search settings"
                />
              </div>

              {/* 2. Settings links */}
              <div
                ref={settingsScrollRef}
                onScroll={handleSettingsScroll}
                className="flex-1 flex flex-col gap-1 min-h-0 pl-4 pr-2 mr-1 mt-1 overflow-y-auto customScrollbar2"
              >
                {/* 1. Account */}
                <Button
                  ref={isAccountRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/account")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isAccountRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <UserCog size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Account</p>
                </Button>
                {/* 2. Usage & Billing */}
                <Button
                  ref={isUsageAndBillingRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/usage-and-billing")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isUsageAndBillingRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <CreditCard size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Usage &amp; Billing</p>
                </Button>
                {/* 3. Routing */}
                <Button
                  ref={isRoutingRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/routing")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isRoutingRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Route size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Routing</p>
                </Button>
                {/* 4. Memory & Context */}
                <Button
                  ref={isMemoryAndContextRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/memory-and-context")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isMemoryAndContextRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Database size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Memory & Context</p>
                </Button>
                {/* 5. Files & Data */}
                <Button
                  ref={isFilesAndDataRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/files-and-data")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isFilesAndDataRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Folder size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Files & Data</p>
                </Button>
                {/* 6. Automations */}
                <Button
                  ref={isAutomationsRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/automations")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isAutomationsRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Zap size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Automations</p>
                </Button>
                {/* 7. AI & Models */}
                <Button
                  ref={isAIandModelsRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/ai-and-models")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isAIandModelsRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Brain size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">AI & Models</p>
                </Button>
                {/* 8. Integrations */}
                <Button
                  ref={isIntegrationsRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/integrations")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isIntegrationsRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Cable size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Integrations</p>
                </Button>
                {/* 9. Notifications */}
                <Button
                  ref={isNotificationsRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/notifications")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isNotificationsRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Bell size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Notifications</p>
                </Button>
                {/* 10. Appearance */}
                <Button
                  ref={isAppearanceRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/appearance")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isAppearanceRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Palette size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Appearance</p>
                </Button>
                {/* 11. Security */}
                <Button
                  ref={isSecurityRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/security")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isSecurityRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <Shield size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Security</p>
                </Button>
                {/* 12. Teams & Roles */}
                <Button
                  ref={isTeamsAndRolesRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/teams-and-roles")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isTeamsAndRolesRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <UsersRound size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Teams & Roles</p>
                </Button>
                {/* 13. Help & Legal */}
                <Button
                  ref={isHelpAndLegalRoute ? activeSettingsItemRef : undefined}
                  type="button"
                  onClick={() => router.push("/settings/help-and-legal")}
                  className={cn(
                    "cursor-pointer w-full min-h-[41px] h-[41px] text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isHelpAndLegalRoute &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center mr-2">
                    <CircleHelp size={18} strokeWidth={1.7} />
                  </div>
                  <p className="font-normal text-[13px]">Help & Legal</p>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 2. Primary buttons */}
              <div className="w-full font-inter grid grid-cols-1 gap-1 px-4 py-4">
                {/* Chat Board */}
                <Button
                  onClick={() => {
                    onAddChat("chat");
                  }}
                  className={cn(
                    "group cursor-pointer max-h-[210px] w-full min-h-[41px] h-full text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isOnChatBoard &&
                      !isOnPersonaPage &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <Image
                    src="/icons/chatboard.svg"
                    alt="chatboard"
                    width={14}
                    height={14}
                    className={cn(
                      "object-contain brightness-0 invert-0 group-hover:invert-100 transition-all duration-300",
                      isOnChatBoard && !isOnPersonaPage && "invert-100",
                    )}
                  />
                  {/* <SquarePen size={20} strokeWidth={2} /> */}
                  <p className="font-normal text-[13px]">
                    {chatBoardButtonText}
                  </p>
                </Button>

                {/* Personas */}
                <Button
                  onClick={() => router.push("/personaAdmin")}
                  className={cn(
                    "cursor-pointer max-h-[210px] w-full min-h-[41px] h-full text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    !isOnChatBoard &&
                      isOnPersonaPage &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center">
                    <UserRoundPen size={20} strokeWidth={2} />
                  </div>

                  <p className="font-normal text-[13px]">AI Assistants</p>
                </Button>

                {/* Workflows */}
                <Button
                  onClick={() => router.push("/workflowAdmin")}
                  className={cn(
                    "cursor-pointer max-h-[210px] w-full min-h-[41px] h-full text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                    isOnWorkflowPage &&
                      "text-lsb-button-active-text bg-lsb-button-active-bg",
                  )}
                >
                  <div className="w-auto h-full flex items-center justify-center">
                    {/* <BotMessageSquare size={20} strokeWidth={2} /> */}
                    <Workflow size={20} strokeWidth={2} />
                  </div>
                  <p className="h-full font-normal text-[13px] flex items-center gap-2">
                    Flow Builder
                  </p>
                </Button>

                {/* Container Border Bottom */}
                <div className="w-full h-[0.5] bg-main-border mt-3"></div>
              </div>

              {/* 3. Chat / recent lists */}
              <div className="font-inter flex-1 w-full flex flex-col min-h-0">
                <div className="px-0 pb-4.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Section header - accordion trigger style */}
                  <div className="flex h-[31px] w-full items-center gap-2 shrink-0 px-4">
                    <p className="px-1 flex-1 text-sm font-medium leading-[150%] tracking-[0.01em] text-[#0A0A0A]">
                      {isOnPersonaPage
                        ? "Recent Persona chats"
                        : isOnWorkflowPage
                          ? "Recent Workflow chats"
                          : "Recent Chat boards"}
                    </p>
                    <button
                      onClick={() =>
                        setIsChatBoardsExpanded(!isChatBoardsExpanded)
                      }
                      className="cursor-pointer h-4 w-4 text-[#737373] hover:text-black flex items-center justify-center"
                    >
                      {isChatBoardsExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>

                  {isChatBoardsExpanded && (
                    <>
                      <div className="mt-2 shrink-0 px-4">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9F9F9F]" />
                          <Input
                            value={searchTerm}
                            onChange={(event) =>
                              setSearchTerm(event.target.value)
                            }
                            placeholder={
                              isOnPersonaPage
                                ? "Search persona chats"
                                : isOnWorkflowPage
                                  ? "Search workflow chats"
                                  : "Search chats"
                            }
                            className="h-9 w-full rounded-[8px] border border-[#E5E5E5] bg-white pl-9 pr-3 text-sm text-[#1E1E1E] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
                            type="search"
                            aria-label="Search chats"
                          />
                        </div>
                      </div>

                      {isOnWorkflowPage ? (
                        workflowListLoading ? (
                          <div className="mt-8 px-4 text-sm text-[#6F6F6F]">
                            Loading workflows...
                          </div>
                        ) : workflowsToDisplay.length > 0 ? (
                          <div
                            id="recent-workflow-chats"
                            className={cn(
                              "flex-1 min-h-0 max-h-full space-y-2 overflow-y-auto pl-4 pr-2 mt-4 transition-all duration-500",
                              chatStyles.customScrollbar2,
                            )}
                          >
                            {workflowsToDisplay.map((wf) => {
                              const isActive =
                                activeWorkflowIdFromUrl === wf.id;
                              const handleSelect = () => {
                                router.push(`/workflowAdmin/chat/${wf.id}`);
                              };
                              return (
                                <div key={wf.id} className="snap-start">
                                  <ChatHistoryItem
                                    title={wf.name}
                                    isSelected={isActive}
                                    isStarred={false}
                                    pinnedCount={0}
                                    onSelect={handleSelect}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-12 flex w-full flex-col items-center gap-3 text-center text-sm text-[#6F6F6F]">
                            <p>No workflows found.</p>
                          </div>
                        )
                      ) : isOnPersonaPage ? (
                        personaListLoading ? (
                          <div className="mt-8 px-4 text-sm text-[#6F6F6F]">
                            Loading personas...
                          </div>
                        ) : personasToDisplay.length > 0 ? (
                          <div
                            id="recent-persona-chats"
                            className={cn(
                              "flex-1 min-h-0 max-h-full space-y-2 overflow-y-auto pl-4 pr-2 mt-4 transition-all duration-500",
                              chatStyles.customScrollbar2,
                            )}
                          >
                            {personasToDisplay.map((persona) => {
                              const isActive =
                                activePersonaIdFromUrl === persona.id;
                              const handleSelect = () => {
                                router.push(`/personaAdmin/chat/${persona.id}`);
                              };
                              return (
                                <div key={persona.id} className="snap-start">
                                  <ChatHistoryItem
                                    title={persona.name}
                                    isSelected={isActive}
                                    isStarred={false}
                                    pinnedCount={0}
                                    onSelect={handleSelect}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-12 flex w-full flex-col items-center gap-3 text-center text-sm text-[#6F6F6F]">
                            <p>No personas found.</p>
                          </div>
                        )
                      ) : boardsToDisplay.length > 0 ? (
                        <div
                          id="recent-chat-boards"
                          className={cn(
                            "flex-1 min-h-0 max-h-full space-y-2 overflow-y-auto pl-4 pr-2 mt-4 transition-all duration-500",
                            chatStyles.customScrollbar2,
                          )}
                        >
                          {boardsToDisplay.map((board) => {
                            const isActive = activeChatId === board.id;
                            const pinTotal =
                              board.metadata?.pinCount ?? board.pinCount ?? 0;
                            const isRenamingBoard = renamingChatId === board.id;

                            const handleSelect = () => {
                              if (renamingChatId) {
                                onRenameCancel();
                              }
                              setActiveChatId(board.id);
                              router.push("/");
                            };

                            const handleToggleStar = () => {
                              void onToggleStar(board);
                            };

                            const handleRename = () => {
                              if (isRenamingPending) return;
                              setRenamingChatId(board.id);
                              setRenamingText(board.name);
                              requestAnimationFrame(() => {
                                renameInputRef.current?.focus();
                              });
                            };

                            const handleDelete = () => {
                              handleDeleteClick(board);
                            };

                            const handleRenameSubmit = () => {
                              const trimmed = renamingText.trim();
                              if (!trimmed) return;
                              void onRenameConfirm();
                            };

                            // Get the display title - use typewriter effect if animating
                            const displayTitle = (() => {
                              const displayedLength = displayedTitleLengths.get(
                                board.id,
                              );
                              if (
                                displayedLength !== undefined &&
                                displayedLength < board.name.length
                              ) {
                                // Show partial title (typewriter effect)
                                return board.name.substring(0, displayedLength);
                              }
                              // Show full title
                              return board.name;
                            })();

                            return (
                              <div key={board.id} className="snap-start">
                                <ChatHistoryItem
                                  title={displayTitle}
                                  isSelected={isActive}
                                  isStarred={Boolean(board.isStarred)}
                                  pinnedCount={pinTotal}
                                  onSelect={handleSelect}
                                  onToggleStar={handleToggleStar}
                                  onRename={handleRename}
                                  onDelete={handleDelete}
                                  isRenaming={isRenamingBoard}
                                  renameValue={
                                    isRenamingBoard ? renamingText : undefined
                                  }
                                  onRenameChange={
                                    isRenamingBoard
                                      ? (value) => {
                                          setRenamingText(value);
                                        }
                                      : undefined
                                  }
                                  onRenameSubmit={
                                    isRenamingBoard
                                      ? handleRenameSubmit
                                      : undefined
                                  }
                                  onRenameCancel={
                                    isRenamingBoard ? onRenameCancel : undefined
                                  }
                                  renameInputRef={
                                    isRenamingBoard ? renameInputRef : undefined
                                  }
                                  isRenamePending={
                                    isRenamingBoard ? isRenamingPending : false
                                  }
                                  isStarPending={
                                    starUpdatingChatId === board.id
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-12 flex w-full flex-col items-center gap-3 text-center text-sm text-[#6F6F6F]">
                          <p>
                            {isOnPersonaPage
                              ? "No persona chats found."
                              : isOnWorkflowPage
                                ? "No workflow chats found."
                                : "No chats found."}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 4. User Footer */}
          <div className="w-full min-h-[59px] h-[59px] border-t border-main-border px-2 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer w-full h-full text-left hover:bg-[#E5E5E5] rounded-md focus:outline-none flex items-center gap-2 px-4 transition-colors"
                >
                  <Avatar className="w-8 h-8 bg-white border border-main-border rounded-full flex items-center justify-center">
                    <AvatarFallback className="font-clash font-medium flex items-center justify-center w-11 h-11 rounded-full text-lsb-button-active-bg bg-white text-xs">
                      {(() => {
                        if (user?.firstName && user?.lastName) {
                          const first = user.firstName.trim().split(/\s+/);
                          const firstLetter = first[0]?.charAt(0) ?? "";
                          const last = user.lastName.trim().split(/\s+/);
                          const lastLetter = last[0]?.charAt(0) ?? "";
                          const combo = (firstLetter + lastLetter).trim();
                          if (combo) return combo.toUpperCase();
                        }
                        return "TU";
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col justify-center">
                    <span className="font-geist font-medium capitalize text-sm text-lsb-text whitespace-nowrap">
                      {user ? `${userFirstName} ${userLastName}` : "Test User"}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="top"
                className="bg-white border-[#E5E5E5] rounded-lg p-1.5"
                style={{ width: "222px", gap: "8px" }}
              >
                {user && (
                  <DropdownMenuItem
                    disabled
                    className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <User className="h-4 w-4 text-lsb-text" />
                    Profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled
                  className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                >
                  <TrendingUp className="h-4 w-4 text-lsb-text" />
                  Upgrade Plan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                >
                  <Settings className="h-4 w-4 text-lsb-text" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled
                  className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
                >
                  <HelpCircle className="h-4 w-4 text-lsb-text" />
                  Help
                </DropdownMenuItem>
                {user ? (
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <LogOut className="h-4 w-4 text-lsb-text" />
                    Logout
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => router.push("/auth/login")}
                    className="cursor-pointer flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <LogIn className="h-4 w-4 text-lsb-text" />
                    Sign In
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      )}
    </section>
  );
}
