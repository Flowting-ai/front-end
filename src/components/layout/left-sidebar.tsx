
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bot,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Star,
  Users,
  WandSparkles,
  PanelLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ThemeSwitcher } from "../theme-switcher";
import { cn } from "@/lib/utils";

const chatBoards = [
    { name: "Product Analysis Q4", time: "2m", isNew: true, isStarred: true },
    { name: "Product Analysis Q1", time: "2m" },
    { name: "Product Analysis Q4", time: "1 Day", isNew: true, isStarred: true },
    { name: "Product Analysis Q4", time: "1 month" },
    { name: "Product Analysis Q4", time: "1 month" },
    { name: "Product Analysis Q4", time: "1 month" },
    { name: "Product Analysis Q4", time: "1 month" },
    { name: "Product Analysis Q4", time: "1 month" },
    { name: "Product Analysis Q4", time: "1month" },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-16" : "w-72"
      )}>
        
      <div className={cn("p-4 border-b", isCollapsed && "p-2")}>
        <div className="flex items-center justify-between">
            <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                      <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M2 7L12 12M22 7L12 12M12 22V12M17 4.5L7 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
              <h1 className="text-lg font-semibold">Flowting</h1>
            </div>
             <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-4 top-1/2 -translate-y-1/2 bg-background border hover:bg-accent z-10 h-8 w-8">
                {isCollapsed ? <ChevronsRight className="h-4 w-4"/> : <ChevronsLeft className="h-4 w-4"/>}
            </Button>
        </div>
      </div>

      <div className={cn("p-4 space-y-4 flex-1 overflow-y-auto", isCollapsed && "p-2")}>
        <Button variant="outline" className={cn("w-full justify-start gap-2", isCollapsed && "w-auto justify-center")}>
            <Plus className="w-4 h-4" />
            <span className={cn(isCollapsed && "hidden")}>Add Chat Board</span>
        </Button>
        <nav className="space-y-1">
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md", isCollapsed && "justify-center")}>
                <Users />
                <span className={cn(isCollapsed && "hidden")}>Personas</span>
            </Link>
            <Link href="#" className={cn("flex items-center gap-2 p-2 rounded-md", isCollapsed && "justify-center")}>
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
                         className={cn("w-full justify-start h-auto py-2", isCollapsed && "justify-center w-10 h-10 p-0")}
                        >
                            <MessageSquare className="w-5 h-5 flex-shrink-0" />
                            <div className={cn("flex flex-col items-start w-full ml-2", isCollapsed && "hidden")}>
                                <span className="truncate">{board.name}</span>
                                <span className="text-xs text-muted-foreground">{board.time}</span>
                            </div>
                            <div className={cn("ml-auto flex items-center gap-1", isCollapsed && "hidden")}>
                               {board.isStarred && <Star className="w-4 h-4 text-blue-500 fill-current" />}
                               {board.isNew && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                            </div>
                    </Button>
                ))}
            </div>
        </div>
      </div>

      <div className={cn("p-4 border-t mt-auto", isCollapsed && "p-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User avatar" data-ai-hint={userAvatar.imageHint} />}
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <span className={cn("text-sm font-medium", isCollapsed && "hidden")}>Avnish Poonia</span>
          </div>
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
