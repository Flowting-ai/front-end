"use client";

import React, { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

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
  renameInputRef: React.RefObject<HTMLInputElement>;
  handleDeleteClick: (board: ChatBoard) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  isRenamingPending: boolean;
  onToggleStar: (board: ChatBoard) => void;
  starUpdatingChatId: string | null;
}

const dummyChatBoards: ChatBoard[] = [
  {
    id: "demo-chat-1",
    name: "Exec Briefing Prep",
    time: "3m ago",
    isStarred: false,
    pinCount: 3,
    metadata: { messageCount: 24, pinCount: 3 },
  },
  {
    id: "demo-chat-2",
    name: "Persona Workshop Notes",
    time: "12m ago",
    isStarred: false,
    pinCount: 1,
    metadata: { messageCount: 18, pinCount: 1 },
  },
  {
    id: "demo-chat-3",
    name: "Latency Bench Triage",
    time: "1h ago",
    isStarred: false,
    pinCount: 2,
    metadata: { messageCount: 42, pinCount: 2 },
  },
  {
    id: "demo-chat-4",
    name: "Pricing FAQ Refresh",
    time: "2h ago",
    isStarred: false,
    pinCount: 0,
    metadata: { messageCount: 15, pinCount: 0 },
  },
  {
    id: "demo-chat-5",
    name: "Q4 Marketing Strategy",
    time: "3h ago",
    isStarred: true,
    pinCount: 5,
    metadata: { messageCount: 36, pinCount: 5 },
  },
  {
    id: "demo-chat-6",
    name: "API Documentation Review",
    time: "5h ago",
    isStarred: false,
    pinCount: 2,
    metadata: { messageCount: 28, pinCount: 2 },
  },
  {
    id: "demo-chat-7",
    name: "Customer Feedback Analysis",
    time: "Yesterday",
    isStarred: true,
    pinCount: 8,
    metadata: { messageCount: 54, pinCount: 8 },
  },
  {
    id: "demo-chat-8",
    name: "Design System Updates",
    time: "Yesterday",
    isStarred: false,
    pinCount: 1,
    metadata: { messageCount: 22, pinCount: 1 },
  },
  {
    id: "demo-chat-9",
    name: "Security Audit Findings",
    time: "2 days ago",
    isStarred: false,
    pinCount: 4,
    metadata: { messageCount: 31, pinCount: 4 },
  },
  {
    id: "demo-chat-10",
    name: "Product Roadmap Discussion",
    time: "2 days ago",
    isStarred: true,
    pinCount: 6,
    metadata: { messageCount: 48, pinCount: 6 },
  },
  {
    id: "demo-chat-11",
    name: "Onboarding Flow Improvements",
    time: "3 days ago",
    isStarred: false,
    pinCount: 3,
    metadata: { messageCount: 19, pinCount: 3 },
  },
  {
    id: "demo-chat-12",
    name: "Infrastructure Cost Optimization",
    time: "3 days ago",
    isStarred: false,
    pinCount: 2,
    metadata: { messageCount: 27, pinCount: 2 },
  },
  {
    id: "demo-chat-13",
    name: "Mobile App Feature Planning",
    time: "4 days ago",
    isStarred: false,
    pinCount: 7,
    metadata: { messageCount: 45, pinCount: 7 },
  },
  {
    id: "demo-chat-14",
    name: "User Research Synthesis",
    time: "5 days ago",
    isStarred: true,
    pinCount: 4,
    metadata: { messageCount: 33, pinCount: 4 },
  },
  {
    id: "demo-chat-15",
    name: "Competitor Analysis Report",
    time: "1 week ago",
    isStarred: false,
    pinCount: 5,
    metadata: { messageCount: 39, pinCount: 5 },
  },
];

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
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Determine if user is on chat board route
  const isOnChatBoard = pathname === "/" || pathname?.startsWith("/chat");
  const chatBoardButtonText = isOnChatBoard ? "New Chat Board" : "Chat Board";
  const [dummyBoards, setDummyBoards] = useState<ChatBoard[]>(() =>
    dummyChatBoards.map((board) => ({ ...board }))
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const hasRealBoards = chatBoards.length > 0;
  const usingDummyBoards = !hasRealBoards;
  const sourceBoards = hasRealBoards ? chatBoards : dummyBoards;
  const boardsToDisplay = sourceBoards.filter((board) => {
    if (!normalizedSearch) return true;
    const haystack = `${board.name} ${board.time ?? ""}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

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

  // Collapsed sidebar
  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={100} disableHoverableContent>
        <aside className="relative hidden h-full w-[72px] flex-col items-center border-r border-[#D9D9D9] bg-[#F5F5F5] md:flex transition-all duration-200">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-[57px] w-full items-center justify-center cursor-pointer bg-transparent"
                onClick={onToggle}
                onMouseEnter={() => setLogoHovered(true)}
                onMouseLeave={() => setLogoHovered(false)}
                onMouseMove={() => setLogoHovered(true)}
                aria-label="Open sidebar"
                style={{ userSelect: "none" }}
              >
                {logoHovered ? (
                  <TableColumnIcon className="h-5 w-5 text-[#1E1E1E] transition-all" />
                ) : (
                  <Image
                    src="/icons/logo.png"
                    alt="FlowtingAi logo"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain transition-all"
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={8}
              className="pointer-events-none px-2 py-1 text-xs font-medium"
            >
              Open sidebar
            </TooltipContent>
          </Tooltip>
          {/* Only show icons, not text, when collapsed */}
          <div className="flex flex-1 flex-col items-center gap-3 py-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={isOnChatBoard ? "New Chat Board" : "Chat Board"}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9D9D9] bg-white shadow-none hover:bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                  onClick={() => {
                    if (isOnChatBoard) {
                      onAddChat();
                    }
                    router.push("/");
                  }}
                >
                  <img
                    src="/icons/chatboard.svg"
                    alt="Chat board"
                    className="h-5 w-5 filter brightness-0"
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
            <Button
              variant="ghost"
              size="icon"
              aria-label="Workflows"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9D9D9] bg-transparent hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:opacity-40"
              disabled
            >
              <Layers className="h-5 w-5 text-[#303030]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="AI Automation"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9D9D9] bg-transparent hover:bg-transparent active:bg-transparent disabled:bg-transparent"
              disabled
            >
              <Bot className="h-5 w-5 text-[#303030]" />
            </Button>
            <div className="mt-auto flex w-full justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border border-[#D9D9D9] bg-transparent hover:bg-transparent active:bg-transparent"
                    aria-label="User settings"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      </TooltipProvider>
    );
  }

  // Expanded sidebar
  return (
    <TooltipProvider delayDuration={100} disableHoverableContent>
      <aside className="relative hidden h-full w-[240px] flex-col justify-between border-r border-[#D9D9D9] bg-[#F5F5F5] md:flex transition-all duration-200">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="px-4 pt-[3px]">
            <div className="flex h-[54px] items-center gap-2">
              {brandMark}
              <span
                style={{
                  fontFamily: "Clash Grotesk Variable",
                  fontSize: "19.86px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "129%",
                  letterSpacing: "0%",
                  textAlign: "center",
                  width: "89px",
                  height: "26px",
                  color: "#1E1E1E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                FlowtingAi
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="ml-auto flex h-[32px] w-[32px] items-center justify-center rounded-lg text-[#1E1E1E] transition-colors hover:bg-[#EDEDED] focus:outline-none cursor-pointer"
                    aria-label="Collapse sidebar"
                    style={{ userSelect: "none" }}
                  >
                    <TableColumnIcon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="pointer-events-none px-2 py-1 text-xs font-medium"
                >
                  Close sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="h-px w-full bg-[#D9D9D9]" />

          <div className="px-4 py-3 space-y-3">
            {/* Primary dark button - Chat Board */}
            <Button
              variant="ghost"
              className="sidebar-primary-action-button"
              onClick={() => {
                if (isOnChatBoard) {
                  onAddChat();
                }
                router.push("/");
              }}
            >
              <span className="sidebar-primary-action-icon">
                <img src="/icons/chatboard.svg" alt="Chat board" />
              </span>
              <span className="sidebar-primary-action-label">{chatBoardButtonText}</span>
            </Button>

            {/* Secondary button - Workflows (disabled/coming soon) */}
            <div className="flex h-[45px] w-[210px] items-center justify-between rounded-[16px] px-3 text-[13px] font-medium text-[#303030] opacity-70">
              <span className="flex items-center gap-[6px] whitespace-nowrap">
                <Layers className="h-5 w-5" />
                Workflows
              </span>
              <span className="flex h-[16px] min-w-[78px] items-center justify-center rounded-[5px] border border-[#E5E5E5] bg-white/10 px-2 text-[9px] font-medium tracking-[0.02em] text-[#0A0A0A] whitespace-nowrap">
                Coming soon
              </span>
            </div>

            {/* Secondary button - AI Automation (disabled/coming soon) */}
            <div className="flex h-[45px] w-[210px] items-center justify-between rounded-[16px] px-3 text-[13px] font-medium text-[#303030] opacity-70">
              <span className="flex items-center gap-[6px] whitespace-nowrap">
                <Bot className="h-5 w-5" />
                AI Automation
              </span>
              <span className="flex h-[16px] min-w-[78px] items-center justify-center rounded-[5px] border border-[#E5E5E5] bg-white/10 px-2 text-[9px] font-medium tracking-[0.02em] text-[#0A0A0A] whitespace-nowrap">
                Coming soon
              </span>
            </div>
          </div>

          <div className="h-px w-full bg-[#D9D9D9]" />

          <div className="px-4 pt-2.5 pb-3 flex-1 flex flex-col overflow-hidden">
            {/* Section header - accordion trigger style */}
            <div className="flex h-[31px] w-full items-center gap-2 rounded-[8px] flex-shrink-0">
              <span className="flex-1 text-sm font-medium leading-[150%] tracking-[0.01em] text-[#0A0A0A]">
                Recent Chat boards
              </span>
              <div className="h-4 w-4 opacity-30">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

            {boardsToDisplay.length > 0 ? (
              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-hidden">
                {boardsToDisplay.map((board) => {
                  const isDummy = usingDummyBoards;
                  const isActive = !isDummy && activeChatId === board.id;
                  const pinTotal =
                    board.pinCount ?? board.metadata?.pinCount ?? 0;
                  const isRenamingBoard =
                    !isDummy && renamingChatId === board.id;

                  const handleSelect = () => {
                    if (isDummy) return;
                    if (renamingChatId) {
                      onRenameCancel();
                    }
                    setActiveChatId(board.id);
                    router.push("/");
                  };

                  const handleToggleStar = () => {
                    if (isDummy) {
                      const willStar = !board.isStarred;
                      setDummyBoards((prev) =>
                        prev.map((item) =>
                          item.id === board.id
                            ? { ...item, isStarred: !item.isStarred }
                            : item
                        )
                      );
                      toast({
                        title: willStar ? "Chat starred" : "Star removed",
                        description: willStar
                          ? "Added to your favorites."
                          : "Removed from favorites.",
                      });
                      return;
                    }
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
                    if (isDummy) {
                      setDummyBoards((prev) =>
                        prev.filter((item) => item.id !== board.id)
                      );
                      return;
                    }
                    handleDeleteClick(board);
                  };

                  const handleRenameSubmit = () => {
                    const trimmed = renamingText.trim();
                    if (!trimmed) return;
                    if (isDummy) {
                      setDummyBoards((prev) =>
                        prev.map((item) =>
                          item.id === board.id ? { ...item, name: trimmed } : item
                        )
                      );
                      onRenameCancel();
                      toast({
                        title: "Chat renamed",
                        description: "Name updated successfully.",
                      });
                      return;
                    }
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
                      onRenameSubmit={isRenamingBoard ? handleRenameSubmit : undefined}
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
                        !isDummy && starUpdatingChatId === board.id
                      }
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
      {/* 5) User footer */}
      <div className="border-t border-[#D9D9D9] px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-[35px] w-full items-center gap-2 rounded-[10px] px-2.5 text-left transition-colors hover:bg-[#EDEDED] focus:outline-none"
            >
              <Avatar className="h-[28px] w-[28px] rounded-full">
                {userAvatar ? (
                  <AvatarImage
                    src={userAvatar.imageUrl}
                    alt="User avatar"
                    data-ai-hint={userAvatar.imageHint}
                  />
                ) : null}
                <AvatarFallback>
                  {user?.name
                    ? user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "AP"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col justify-center">
                <span className="text-[15px] font-medium text-[#1E1E1E]">
                  {user?.name || "Avnish Poonia"}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            side="top" 
            className="bg-white border-[#E5E5E5] rounded-lg p-1.5"
            style={{ width: '222px', gap: '8px' }}
          >
            {user && (
              <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-[#1E1E1E]">
                <User className="h-4 w-4 text-[#1E1E1E]" />
                Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-[#1E1E1E]">
              <TrendingUp className="h-4 w-4 text-[#1E1E1E]" />
              Upgrade Plan
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-[#1E1E1E]">
              <Settings className="h-4 w-4 text-[#1E1E1E]" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed flex items-center gap-2 rounded-md text-[#1E1E1E]">
              <HelpCircle className="h-4 w-4 text-[#1E1E1E]" />
              Help
            </DropdownMenuItem>
            {user ? (
              <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 rounded-md text-[#1E1E1E]">
                <LogOut className="h-4 w-4 text-[#1E1E1E]" />
                Logout
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => router.push("/auth/login")} className="flex items-center gap-2 rounded-md text-[#1E1E1E]">
                <LogOut className="h-4 w-4 text-[#1E1E1E]" />
                Sign In
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  </TooltipProvider>
  );
}
