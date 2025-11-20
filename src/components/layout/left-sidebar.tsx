
"use client";

import Link from "next/link";
import React from 'react';
import {
  Users,
  ChevronsLeft,
  Settings,
  Plus,
  LogOut,
  Search,
  Library,
  MessageSquare,
  Star,
  MoreHorizontal,
  Archive,
  Trash2,
  Share2,
  Pencil,
  Check,
  LayoutGrid,
  UserPlus,
  BarChart2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { ChatBoard } from "./app-layout";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

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
  handleDeleteClick
}: LeftSidebarProps) {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/auth/login');
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChatBoards(prev => prev.map(board => 
        board.id === id ? { ...board, isStarred: !board.isStarred } : board
    ).sort((a, b) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return 0;
    }));
  };

  const handleRenameClick = (e: React.MouseEvent, board: ChatBoard) => {
    e.stopPropagation();
    setRenamingChatId(board.id);
    setRenamingText(board.name);
  };

  const handleRenameSave = () => {
    if (renamingChatId) {
        setChatBoards(prev => prev.map(board =>
            board.id === renamingChatId ? { ...board, name: renamingText } : board
        ));
        setRenamingChatId(null);
        setRenamingText("");
    }
  };

  return (
      <aside className={cn(
          "flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border relative hidden md:flex",
          isCollapsed ? "w-16 items-center" : "w-64"
        )}
        style={{ backgroundColor: 'hsl(var(--left-sidebar-background))' }}
        >
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 -right-4 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full">
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")}/>
        </Button>
        
        <div className={cn("p-2 space-y-2 w-full")}>
            <Button variant="ghost" className={cn("w-full justify-start gap-2 rounded-[25px]", isCollapsed && "justify-center w-auto aspect-square p-0")} onClick={onAddChat}>
                <Plus className="w-4 h-4" />
                <span className={cn(isCollapsed && "hidden")}>New Chat</span>
            </Button>
            <div className={cn("relative", isCollapsed && "hidden")}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chats" className="pl-9 bg-card rounded-[25px] h-9" />
            </div>
             <Button asChild variant="ghost" className={cn("w-full justify-start gap-2 rounded-[25px]", isCollapsed && "justify-center w-auto aspect-square p-0")}>
                <Link href="/personas">
                    <Users className="w-4 h-4" />
                    <span className={cn(isCollapsed && "hidden")}>Personas</span>
                </Link>
            </Button>
             <Button variant="ghost" className={cn("w-full justify-start gap-2 rounded-[25px]", isCollapsed && "justify-center w-auto aspect-square p-0")}>
                <Library className="w-4 h-4" />
                <span className={cn(isCollapsed && "hidden")}>Library</span>
            </Button>
        </div>
        
        <Separator className={cn("my-2", isCollapsed && "mx-2")} />

        <div className={cn("space-y-1 flex-1 overflow-y-auto w-full px-2", isCollapsed && "px-1 hidden")}>
            <h3 className={cn("text-xs font-semibold text-muted-foreground px-2 mb-2", isCollapsed && "hidden")}>Chat Boards</h3>
            {!isCollapsed && chatBoards.map((board) => (
              <div
                    key={board.id}
                    className={cn(
                      "w-full h-auto py-2 group flex justify-between items-center rounded-[25px] hover:bg-accent cursor-pointer px-2",
                      activeChatId === board.id && "bg-secondary",
                    )}
                    onClick={() => setActiveChatId(board.id)}
                  >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                          <MessageSquare className="w-5 h-5 flex-shrink-0" />
                          <div className="flex-grow text-left overflow-hidden">
                          {renamingChatId === board.id ? (
                              <div className="flex items-center gap-1">
                                  <Input 
                                      ref={renameInputRef}
                                      value={renamingText}
                                      onChange={(e) => setRenamingText(e.target.value)}
                                      onBlur={handleRenameSave}
                                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
                                      className="h-7 text-xs rounded-md"
                                  />
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRenameSave}><Check className="h-4 w-4" /></Button>
                              </div>
                          ) : (
                              <>
                                  <p className="truncate w-full text-sm">{board.name}</p>
                                  <p className="text-xs text-muted-foreground">{board.time}</p>
                              </>
                          )}
                          </div>
                      </div>
                        <div className={"ml-2 flex-shrink-0 flex items-center gap-1"}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={(e) => toggleStar(e, board.id)}>
                            <Star className={cn("w-4 h-4 text-muted-foreground", board.isStarred && "text-yellow-400 fill-yellow-400")} />
                          </Button>
                          {board.pinCount > 0 && <Badge variant="default" className="rounded-full h-5 w-5 text-[10px] p-0 flex items-center justify-center bg-muted-foreground text-background">{board.pinCount}</Badge>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => handleRenameClick(e, board) }><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(board); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                <DropdownMenuItem><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                                <DropdownMenuItem><Share2 className="mr-2 h-4 w-4" />Share</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
              </div>
          ))}
        </div>

        <div className={cn("p-4 border-t border-sidebar-border mt-auto w-full", isCollapsed && "p-2 space-y-2")}>
            <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "justify-between")}>
            <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
                <Avatar className="h-8 w-8">
                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User avatar" data-ai-hint={userAvatar.imageHint} />}
                <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span className={cn("text-sm font-medium")}>Avnish Poonia</span>
            </div>
            {isCollapsed && (
                <Avatar className="h-8 w-8">
                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User avatar" data-ai-hint={userAvatar.imageHint} />}
                <AvatarFallback>U</AvatarFallback>
                </Avatar>
            )}
            <ThemeSwitcher />
            </div>
            <nav className="space-y-1 mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("flex items-center gap-2 p-2 rounded-[25px] w-full", isCollapsed ? "justify-center" : "justify-start")}>
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
