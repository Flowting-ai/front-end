"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronsLeft,
  Settings,
  LogOut,
  Layers,
  Bot,
  Search,
  HelpCircle,
  TrendingUp,
  User,
  PanelLeft,
  BotMessageSquare,
} from "lucide-react";
import { TableColumnIcon } from "@/components/icons/table-column";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
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
import type { ChatBoard } from "./app-layout";
import { useAuth } from "@/context/auth-context";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  chatBoards: ChatBoard[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddChat: () => void;
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
  const userAvatar = PlaceHolderImages.find((img) => img.id === "user-avatar");
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const userFirstName = (() => {
    const fromName = user?.name?.trim();
    if (fromName) {
      const first = fromName.split(/\s+/)[0];
      if (first) return first;
    }
    if (typeof user?.username === "string") {
      const first = user.username.split(/[.\s]/)[0];
      if (first) return first;
    }
    if (typeof user?.email === "string") {
      const first = user.email.split("@")[0];
      if (first) return first;
    }
    return "there";
  })();

  // Determine if user is on chat board route
  const isOnChatBoard = pathname === "/" || pathname?.startsWith("/chat");
  const chatBoardButtonText = isOnChatBoard ? "New Chat Board" : "Chat Board";

  // Determine if user is on persona pages
  const isOnPersonaPage =
    pathname?.startsWith("/personaAdmin") || pathname?.startsWith("/personas");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const boardsToDisplay = chatBoards.filter((board) => {
    if (!normalizedSearch) return true;
    const haystack = `${board.name} ${board.time ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  // Development-only: ensure at least 20 items so overflow-y-auto can be tested locally.
  const boardsToDisplayAugmented = useMemo(() => {
    const target = 20;
    if (process.env.NODE_ENV !== "development") return boardsToDisplay;
    if (normalizedSearch) return boardsToDisplay;
    const out = boardsToDisplay.slice();
    for (let i = out.length; i < target; i++) {
      out.push({
        id: `dev-${i}`,
        name: `Test Chat ${i + 1}`,
        time: `${i + 1}m`,
        isStarred: false,
        pinCount: Math.floor(Math.random() * 5),
      });
    }
    return out;
  }, [boardsToDisplay, normalizedSearch]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    router.push("/auth/login");
  };

  // Hover state for logo/table icon
  const [logoHovered, setLogoHovered] = useState(false);

  // Logo component (expanded)
  const brandMark = (
    <div className="relative flex h-[30.341px] w-[30.341px] flex-shrink-0 items-center justify-center">
      <Image
        src="/icons/logo.png"
        alt="FlowtingAi Logo"
        width={31}
        height={31}
        className="h-[30.341px] w-[30.341px] object-contain"
        priority
      />
    </div>
  );

  return (
    <section
      className={cn(
        "max-w-[240px] w-full h-screen bg-lsb-bg border-r border-main-border transition-all duration-500 overflow-hidden",
        isCollapsed && "max-w-[72px]"
      )}
    >
      {isCollapsed ? (
        // === COLLAPSED SIDEBAR ===
        <aside className="w-full h-full flex flex-col">
          {/* 1. Logo + ToggleIcon */}
          <div className="w-full h-[56px] px-4">
            <div className="group relative w-full h-full border-b border-main-border flex items-center justify-center">
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

              <div className="text-lsb-panelleft-icon group-hover:text-black group-hover:bg-zinc-200 rounded-sm opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 transition-all duration-300">
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
                  className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-[#D9D9D9] hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
                  onClick={() => {
                    // if (isOnChatBoard) {
                    //   onAddChat();
                    // }
                    router.push("/");
                  }}
                >
                  <Image
                    src="/icons/chatboard.svg"
                    alt="chatboard"
                    width={16}
                    height={16}
                    className="object-contain filter brightness-0"
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
                disabled
                  variant="ghost"
                  size="icon"
                  aria-label="Personas"
                  className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-[#D9D9D9] hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
                  onClick={() => router.push("/personaAdmin")}
                >
                  <Layers
                    className={cn(
                      "h-5 w-5",
                      isOnPersonaPage ? "text-white" : "text-[#303030]"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="pointer-events-none px-2 py-1 text-xs font-medium"
              >
                Personas
              </TooltipContent>
            </Tooltip>

            {/* Button 3 */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="AI Automation"
              className="cursor-pointer h-10 w-10 bg-white hover:bg-white border border-[#D9D9D9] hover:border-lsb-button-active-bg rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none flex items-center justify-center"
              disabled
            >
              <Bot className="h-5 w-5 text-[#303030]" />
            </Button>

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
                    disabled
                    className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
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
                  {!user ? (
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-md text-lsb-text"
                    >
                      <LogOut className="h-4 w-4 text-lsb-text" />
                      Logout
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => router.push("/auth/login")}
                      className="flex items-center gap-2 rounded-md text-lsb-text"
                    >
                      <LogOut className="h-4 w-4 text-lsb-text" />
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
          {/* 1. Logo + ToggleIcon */}
          <div className="w-full h-[56px] px-4">
            <div className="w-full h-full border-b border-main-border flex items-center justify-between">
              <div className="min-h-[56px] h-[56px] flex items-center gap-2">
                <Image
                  src="/icons/logo.png"
                  width={23}
                  height={23}
                  alt="Flowting AI Logo"
                />
                <h3 className="font-clash font-normal text-[18px] transition-all duration-300 overflow-hidden whitespace-nowrap">
                  FlowtingAi
                </h3>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggle}
                    className="cursor-pointer text-lsb-panelleft-icon hover:*:text-black hover:bg-zinc-200 rounded-sm flex items-center justify-center p-1 transition-all duration-300"
                  >
                    <PanelLeft size={20} strokeWidth={1.3} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={"bottom"}>
                  <p>Close Sidebar</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* 2. Buttons */}
          <div className="w-full font-inter grid grid-cols-1 gap-1 px-4 py-4">
            {/* Chat Board */}
            <Button
              onClick={() => {
                if (isOnChatBoard) {
                  onAddChat();
                }
                router.push("/");
              }}
              className={cn(
                "group cursor-pointer max-h-[210px] w-full min-h-[41px] h-full text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                isOnChatBoard &&
                  !isOnPersonaPage &&
                  "text-lsb-button-active-text bg-lsb-button-active-bg"
              )}
            >
              <Image
                src="/icons/chatboard.svg"
                alt="chatboard"
                width={14}
                height={11}
                className={cn(
                  "object-contain brightness-0 invert-0 group-hover:invert-100 transition-all duration-300",
                  isOnChatBoard && !isOnPersonaPage && "invert-100"
                )}
              />
              {/* <SquarePen size={20} strokeWidth={2} /> */}
              <p className="font-[400] text-[13px]">{chatBoardButtonText}</p>
            </Button>

            {/* Personas */}
            <Button
            disabled
              onClick={() => router.push("/personaAdmin")}
              className={cn(
                "cursor-pointer max-h-[210px] w-full min-h-[41px] h-full text-lsb-black bg-transparent hover:text-white hover:bg-lsb-button-active-bg flex items-center justify-start px-4 transition-all duration-300",
                !isOnChatBoard &&
                  isOnPersonaPage &&
                  "text-lsb-button-active-text bg-lsb-button-active-bg"
              )}
            >
              <div className="w-auto h-full flex items-center justify-center">
                <Layers size={20} strokeWidth={2} />
              </div>

              <p className="font-[400] text-[13px]">Persona</p>
            </Button>

            {/* Workflows */}
            <Button
              disabled
              onClick={() => {}}
              className={cn(
                "cursor-events-none max-h-[210px] w-full min-h-[41px] h-full text-lsb-button-text bg-transparent flex items-center justify-start px-4"
              )}
            >
              <div className="w-auto h-full flex items-center justify-center">
                <BotMessageSquare size={20} strokeWidth={2} />
              </div>
              <p className="h-full font-[400] text-[13px] flex items-center gap-2">
                Workflow
                <span className="text-[8px] border border-main-border rounded px-[4] py-0">
                  Coming Soon
                </span>
              </p>
            </Button>

            {/* Container Border Bottom */}
            <div className="w-full h-[0.5] bg-main-border mt-3"></div>
          </div>

          {/* 3. Chat */}
          <div className="flex-1 w-full flex flex-col min-h-0">
            <div className="px-4 pt-2.5 pb-3 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Section header - accordion trigger style */}
              <div className="flex h-[31px] w-full items-center gap-2 rounded-[8px] shrink-0">
                <span className="flex-1 text-sm font-medium leading-[150%] tracking-[0.01em] text-[#0A0A0A]">
                  Recent Chat boards
                </span>
                <div className="h-4 w-4 opacity-30">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 10L8 6L12 10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-2 flex-shrink-0">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9F9F9F]" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search chats"
                    className="h-9 w-full rounded-[8px] border border-[#E5E5E5] bg-white pl-9 pr-3 text-sm text-[#1E1E1E] placeholder:text-[#9F9F9F] focus-visible:ring-0 focus-visible:ring-offset-0"
                    type="search"
                    aria-label="Search chats"
                  />
                </div>
              </div>

              {boardsToDisplayAugmented.length > 0 ? (
                <div className="mt-4 flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-hidden">
                  {boardsToDisplayAugmented.map((board) => {
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

                    return (
                      <ChatHistoryItem
                        key={board.id}
                        title={board.name}
                        isSelected={isActive}
                        isStarred={Boolean(board.isStarred)}
                        pinnedCount={pinTotal}
                        onSelect={handleSelect}
                        onToggleStar={handleToggleStar}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        isRenaming={isRenamingBoard}
                        renameValue={isRenamingBoard ? renamingText : undefined}
                        onRenameChange={
                          isRenamingBoard
                            ? (value) => {
                                setRenamingText(value);
                              }
                            : undefined
                        }
                        onRenameSubmit={
                          isRenamingBoard ? handleRenameSubmit : undefined
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
                        isStarPending={starUpdatingChatId === board.id}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mt-12 flex w-full flex-col items-center gap-3 text-center text-sm text-[#6F6F6F]">
                  <p>No chats found.</p>
                </div>
              )}
            </div>
          </div>

          {/* 4. User Footer */}
          <div className="w-full min-h-[59px] h-[59px] border-t border-main-border px-4 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer w-full h-full text-left hover:bg-[#EDEDED] rounded-md focus:outline-none flex items-center gap-2 px-4 transition-colors"
                >
                  <Avatar className="w-[22px] h-[22px] bg-white border border-main-border rounded-full">
                    <AvatarFallback className="font-[500] font-inter font-bold text-lsb-button-active-bg text-[12px] bg-white">
                      {(() => {
                        if (user?.name) {
                          const parts = user.name.trim().split(" ");
                          const first = parts[0]?.[0] || "";
                          const last =
                            parts.length > 1 ? parts[parts.length - 1][0] : "";
                          return (first + last).toUpperCase();
                        }
                        if (user?.email) {
                          const [first, last] = user.email
                            .split("@")[0]
                            .split(".");
                          return (
                            (
                              (first?.[0] || "") + (last?.[0] || "")
                            ).toUpperCase() || "AP"
                          );
                        }
                        return "AP";
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col justify-center">
                    <span className="font-[400] font-inter text-[14px] text-lsb-text whitespace-nowrap">
                      {user ? `${userFirstName}` : "Avnish Poonia"}
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
                  disabled
                  className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-lsb-text"
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
                {!user ? (
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <LogOut className="h-4 w-4 text-lsb-text" />
                    Logout
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => router.push("/auth/login")}
                    className="flex items-center gap-2 rounded-md text-lsb-text"
                  >
                    <LogOut className="h-4 w-4 text-lsb-text" />
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
