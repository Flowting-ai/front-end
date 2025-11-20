"use client";

import React from "react";
import {
  ChevronsLeft,
  Settings,
  Plus,
  LogOut,
  Search,
  MessageSquare,
  Star,
  MoreHorizontal,
  Archive,
  Trash2,
  Share2,
  Pencil,
  Check,
  GitBranch,
  Bot,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { ChatBoard } from "./app-layout";
import { Separator } from "../ui/separator";
import { useAuth } from "@/context/auth-context";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  chatBoards: ChatBoard[];
  setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  onAddChat: () => void;
  renamingChatId: string | null;
  setRenamingChatId: (id: string | null) => void;
  renamingText: string;
  setRenamingText: (text: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  handleDeleteClick: (board: ChatBoard) => void;
}

export function LeftSidebar({
  isCollapsed,
  onToggle,
  chatBoards,
  setChatBoards,
  activeChatId,
  setActiveChatId,
  onAddChat,
  renamingChatId,
  setRenamingChatId,
  renamingText,
  setRenamingText,
  renameInputRef,
  handleDeleteClick,
}: LeftSidebarProps) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "user-avatar");
  const router = useRouter();
  const { user, clearAuth } = useAuth();

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChatBoards((prev) =>
      prev
        .map((board) =>
          board.id === id ? { ...board, isStarred: !board.isStarred } : board
        )
        .sort((a, b) => {
          if (a.isStarred && !b.isStarred) return -1;
          if (!a.isStarred && b.isStarred) return 1;
          return 0;
        })
    );
  };

  const handleRenameClick = (e: React.MouseEvent, board: ChatBoard) => {
    e.stopPropagation();
    setRenamingChatId(board.id);
    setRenamingText(board.name);
  };

  const handleRenameSave = () => {
    if (renamingChatId) {
      setChatBoards((prev) =>
        prev.map((board) =>
          board.id === renamingChatId ? { ...board, name: renamingText } : board
        )
      );
      setRenamingChatId(null);
      setRenamingText("");
    }
  };

  const navItems = [
    { label: "Chat Board", href: "/", icon: LayoutGrid },
    { label: "Personas", href: "/personas", icon: UserPlus },
    { label: "Dashboard", href: "/dashboard", icon: BarChart2 },
  ];

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border relative hidden md:flex",
        isCollapsed ? "w-16 items-center" : "w-72"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -right-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full"
      >
        <ChevronsLeft
          className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")}
        />
      </Button>

      <div className="w-full px-3 pt-4 pb-3 space-y-3">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div>
              <p className="text-base font-semibold leading-tight">FlowtingAi</p>
              <p className="text-xs text-muted-foreground leading-tight">Workspace</p>
            </div>
          )}
        </div>

        <div className={cn("space-y-2", isCollapsed && "hidden")}>
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 rounded-2xl h-10 px-3 text-sm",
                item.href === "/" ? "bg-foreground text-background hover:bg-foreground" : "bg-muted/50 text-foreground hover:bg-muted"
              )}
              onClick={() => router.push(item.href)}
            >
              <item.icon
                className={cn(
                  "h-4 w-4",
                  item.href === "/" ? "text-background" : "text-muted-foreground"
                )}
              />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <Separator className={cn("mb-2", isCollapsed && "mx-2 hidden")} />

      <div className={cn("flex-1 w-full px-3 space-y-3", isCollapsed && "hidden")}>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Chat Boards
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs border border-border"
            onClick={onAddChat}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search" className="pl-9 bg-card rounded-full h-9 shadow-none" />
          </div>
          <Button
            className="w-full justify-start gap-2 rounded-2xl h-10 px-3 bg-foreground text-background hover:bg-foreground/90"
            onClick={onAddChat}
          >
            <Plus className="h-4 w-4" />
            Add Chat Board
          </Button>
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto pr-1">
          {chatBoards.map((board) => (
            <div
              key={board.id}
              className={cn(
                "w-full h-auto py-2 group flex items-center justify-between rounded-xl px-3 border border-transparent hover:border-border hover:bg-muted/40 cursor-pointer transition-colors",
                activeChatId === board.id && "bg-muted/70 border-border"
              )}
              onClick={() => setActiveChatId(board.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <div className="flex-grow text-left overflow-hidden">
                  {renamingChatId === board.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={renameInputRef}
                        value={renamingText}
                        onChange={(e) => setRenamingText(e.target.value)}
                        onBlur={handleRenameSave}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameSave()}
                        className="h-7 text-xs rounded-md"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleRenameSave}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate w-full text-sm font-medium">{board.name}</p>
                      <p className="text-xs text-muted-foreground">{board.time}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="ml-2 flex-shrink-0 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={(e) => toggleStar(e, board.id)}
                >
                  <Star
                    className={cn(
                      "w-4 h-4 text-muted-foreground",
                      board.isStarred && "text-blue-500 fill-blue-500"
                    )}
                  />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleRenameClick(e, board)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(board);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("p-4 border-t border-sidebar-border mt-auto w-full", isCollapsed && "p-2 space-y-2")}>
        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "justify-between")}>
          <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
            <Avatar className="h-8 w-8">
              {userAvatar && (
                <AvatarImage
                  src={userAvatar.imageUrl}
                  alt="User avatar"
                  data-ai-hint={userAvatar.imageHint}
                />
              )}
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {user?.name || user?.email || "Guest User"}
            </span>
          </div>
          {isCollapsed && (
            <Avatar className="h-8 w-8">
              {userAvatar && (
                <AvatarImage
                  src={userAvatar.imageUrl}
                  alt="User avatar"
                  data-ai-hint={userAvatar.imageHint}
                />
              )}
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}
          <ThemeSwitcher />
        </div>
        <nav className="space-y-1 mt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 p-2 rounded-[25px] w-full",
                  isCollapsed ? "justify-center" : "justify-start"
                )}
              >
                <Settings />
                <span className={cn(isCollapsed && "hidden")}>Setting</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCollapsed ? "end" : "start"}>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </aside>
  );
}
