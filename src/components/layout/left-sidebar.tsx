
"use client";

import Link from "next/link";
import React from 'react';
import {
  Users,
  ChevronsLeft,
  Settings,
  Plus,
  LogOut
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onAddChat: () => void;
}

export function LeftSidebar({ isCollapsed, onToggle, onAddChat }: LeftSidebarProps) {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/auth/login');
  };

  return (
      <aside className={cn(
          "bg-sidebar text-sidebar-foreground flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border relative hidden md:flex",
          isCollapsed ? "w-16 items-center" : "w-60"
        )}>
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="absolute top-1/2 -translate-y-1/2 bg-card border hover:bg-accent z-10 h-8 w-8 rounded-full" style={{ right: '-1rem' }}>
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")}/>
        </Button>
        
        <div className={cn("p-4 space-y-4 w-full", isCollapsed && "p-2")}>
            <Button variant="outline" className={cn("w-full justify-start gap-2 rounded-[25px]", isCollapsed && "justify-center w-auto aspect-square p-0")} onClick={onAddChat}>
                <Plus className="w-4 h-4" />
                <span className={cn(isCollapsed && "hidden")}>Add Chat Board</span>
            </Button>
        </div>

        <div className={cn("p-4 space-y-4 flex-1 overflow-y-auto w-full", isCollapsed && "p-2")}>
            <nav className="space-y-1">
                <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-accent", isCollapsed && "justify-center")}>
                    <Users />
                    <span className={cn(isCollapsed && "hidden")}>Personas</span>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("flex items-center gap-2 p-2 rounded-md w-full", isCollapsed ? "justify-center" : "justify-start")}>
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
