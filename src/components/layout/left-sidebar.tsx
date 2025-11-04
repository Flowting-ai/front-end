
"use client";

import Link from "next/link";
import React from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Users,
  WandSparkles,
  ChevronsLeft,
  ChevronsRight,
  Star,
  Settings,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

const chatBoards = [
    { name: "Product Analysis Q4", time: "2m", isStarred: true, pinCount: 3 },
    { name: "Product Analysis Q1", time: "2m", isStarred: false, pinCount: 0 },
    { name: "Competitive Landscape is shifting towards AI-driven features", time: "1 Day", isStarred: true, pinCount: 1 },
    { name: "Q3 Earnings Call Prep", time: "1 month", isStarred: false, pinCount: 0 },
    { name: "User Feedback Synthesis", time: "1 month", isStarred: false, pinCount: 0 },
    { name: "Marketing Campaign Ideas", time: "1 month", isStarred: true, pinCount: 5 },
    { name: "API Integration Plan for the new mobile application", time: "2 months", isStarred: false, pinCount: 0 },
    { name: "Onboarding Flow UX", time: "2 months", isStarred: false, pinCount: 0 },
    { name: "Website Redesign Brainstorm", time: "3 months", isStarred: false, pinCount: 0 },
];

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function LeftSidebar({ isCollapsed, onToggle }: LeftSidebarProps) {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

  return (
    <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16 items-center" : "w-72"
      )}>
        
      <div className={cn("p-4 border-b border-sidebar-border w-full", isCollapsed && "p-2")}>
        <div className="flex items-center justify-between">
            <Link href="/" className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                      <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M2 7L12 12M22 7L12 12M12 22V12M17 4.5L7 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
              <h1 className="text-lg font-semibold">Flowting</h1>
            </Link>
             <Button variant="ghost" size="icon" onClick={onToggle} className="absolute left-0 top-1/2 -translate-y-1/2 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full" style={{ left: isCollapsed ? '4rem' : '18rem', transition: 'left 0.3s ease-in-out' }}>
                {isCollapsed ? <ChevronsRight className="h-4 w-4"/> : <ChevronsLeft className="h-4 w-4"/>}
            </Button>
        </div>
      </div>

      <div className={cn("p-4 space-y-4 flex-1 overflow-y-auto w-full", isCollapsed && "p-2")}>
        <Button variant="outline" className={cn("w-full justify-start gap-2", isCollapsed && "w-auto justify-center")}>
            <Plus className="w-4 h-4" />
            <span className={cn(isCollapsed && "hidden")}>Add Chat Board</span>
        </Button>
        <nav className="space-y-1">
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md", isCollapsed && "justify-center")}>
                <Users />
                <span className={cn(isCollapsed && "hidden")}>Personas</span>
            </Link>
            <Link href="/dashboard" className={cn("flex items-center gap-2 p-2 rounded-md", isCollapsed && "justify-center")}>
                <WandSparkles />
                <span className={cn(isCollapsed && "hidden")}>AI Automation</span>
            </Link>
        </nav>

        <div className={cn("relative", isCollapsed && "hidden")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search Ctrl+K" className="pl-9 bg-background" />
        </div>
        
        <div className="space-y-2">
            <h3 className={cn("text-xs font-semibold text-muted-foreground px-2", isCollapsed && "hidden")}>CHAT BOARDS</h3>
            <div className="space-y-1">
                {chatBoards.map((board, index) => (
                    <Button
                         key={index}
                         variant="ghost"
                         className={cn(
                            "w-full h-auto py-2 group flex justify-between items-center",
                            isCollapsed && "px-0 w-10 h-10 justify-center"
                          )}
                        >
                            <div className={cn("flex items-center gap-2 overflow-hidden", isCollapsed ? "justify-center" : "")}>
                                <MessageSquare className="w-5 h-5 flex-shrink-0" />
                                <div className={cn("flex-grow text-left overflow-hidden", isCollapsed && "hidden")}>
                                    <p className="truncate w-full">{board.name}</p>
                                    <p className="text-xs text-muted-foreground">{board.time}</p>
                                </div>
                            </div>
                             <div className={cn("ml-2 flex-shrink-0 flex flex-col items-center gap-0.5", isCollapsed && "hidden")}>
                               {board.isStarred && <Star className="w-4 h-4 text-blue-400 fill-blue-400" />}
                               {board.pinCount > 0 && <Badge variant="default" className="rounded-full h-4 w-4 text-[10px] p-0 flex items-center justify-center bg-blue-400 text-white dark:text-black">{board.pinCount}</Badge>}
                            </div>
                    </Button>
                ))}
            </div>
        </div>
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
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md", isCollapsed && "justify-center")}>
                <Settings />
                <span className={cn(isCollapsed && "hidden")}>Setting</span>
            </Link>
        </nav>
      </div>
    </aside>
  );
}
