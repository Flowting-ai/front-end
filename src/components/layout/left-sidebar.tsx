"use client";

import Link from "next/link";
import {
  Bot,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Star,
  Users,
  WandSparkles
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 7L12 12M22 7L12 12M12 22V12M17 4.5L7 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          <h1 className="text-lg font-semibold">Flowting</h1>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4 space-y-4">
        <Button variant="outline" className="w-full justify-start gap-2">
            <Plus className="w-4 h-4" />
            Add Chat Board
        </Button>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              variant="ghost"
              isActive={pathname === "/personas"}
              tooltip="Personas"
            >
              <Link href="#">
                <Users />
                <span className="truncate">Personas</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
               variant="ghost"
              isActive={pathname === "/ai-automation"}
              tooltip="AI Automation"
            >
              <Link href="#">
                <WandSparkles />
                <span className="truncate">AI Automation</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search Ctrl+K" className="pl-9 bg-background" />
        </div>

        <Button variant="default" className="w-full justify-start gap-2">
            <Plus className="w-4 h-4" />
            Add Chat Board
        </Button>
        
        <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-2">CHAT BOARDS</h3>
            <SidebarMenu>
                {chatBoards.map((board, index) => (
                    <SidebarMenuItem key={index}>
                        <SidebarMenuButton
                         variant="ghost"
                         className="w-full justify-start h-auto py-2"
                        >
                            <MessageSquare className="w-5 h-5" />
                            <div className="flex flex-col items-start w-full">
                                <span className="truncate">{board.name}</span>
                                <span className="text-xs text-muted-foreground">{board.time}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                               {board.isStarred && <Star className="w-4 h-4 text-blue-500 fill-current" />}
                               {board.isNew && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User avatar" data-ai-hint={userAvatar.imageHint} />}
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">Avnish Poonia</span>
          </div>
        </div>
         <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              variant="ghost"
              isActive={pathname === "/settings"}
              tooltip="Settings"
            >
              <Link href="#">
                <Settings />
                <span className="truncate">Setting</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
