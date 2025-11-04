
"use client";

import Link from "next/link";
import React from 'react';
import {
  Plus,
  Users,
  WandSparkles,
  ChevronsLeft,
  ChevronsRight,
  Settings,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function LeftSidebar({ isCollapsed, onToggle }: LeftSidebarProps) {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

  return (
    <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border relative",
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
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full" style={{ right: '-1rem' }}>
          {isCollapsed ? <ChevronsRight className="h-4 w-4"/> : <ChevronsLeft className="h-4 w-4"/>}
      </Button>

      <div className={cn("p-4 space-y-4 flex-1 overflow-y-auto w-full", isCollapsed && "p-2")}>
        <Button variant="outline" className={cn("w-full justify-start gap-2", isCollapsed && "w-auto justify-center")}>
            <Plus className="w-4 h-4" />
            <span className={cn(isCollapsed && "hidden")}>Add Chat Board</span>
        </Button>
        <nav className="space-y-1">
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-accent", isCollapsed && "justify-center")}>
                <Users />
                <span className={cn(isCollapsed && "hidden")}>Personas</span>
            </Link>
            <Link href="/dashboard" className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-accent", isCollapsed && "justify-center")}>
                <WandSparkles />
                <span className={cn(isCollapsed && "hidden")}>AI Automation</span>
            </Link>
        </nav>
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
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-accent", isCollapsed && "justify-center")}>
                <Settings />
                <span className={cn(isCollapsed && "hidden")}>Setting</span>
            </Link>
        </nav>
      </div>
    </aside>
  );
}
