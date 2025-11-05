
"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Star,
  MoreHorizontal,
  Archive,
  Trash2,
  Share2,
  Pencil,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type ChatBoard = {
    id: number;
    name: string;
    time: string;
    isStarred: boolean;
    pinCount: number;
};

interface ChatListSidebarProps {
    chatBoards: ChatBoard[];
    setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
    activeChatId: number;
    setActiveChatId: (id: number) => void;
    isLeftSidebarCollapsed?: boolean;
}

export function ChatListSidebar({ chatBoards, setChatBoards, activeChatId, setActiveChatId }: ChatListSidebarProps) {
  const [chatToDelete, setChatToDelete] = useState<number | null>(null);

  const handleAddChat = () => {
    const newChat = {
        id: Date.now(),
        name: "New Chat",
        time: "1m",
        isStarred: false,
        pinCount: 0
    };
    setChatBoards(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const toggleStar = (id: number) => {
    setChatBoards(prev => prev.map(board => 
        board.id === id ? { ...board, isStarred: !board.isStarred } : board
    ));
  };
  
  const handleDeleteClick = (id: number) => {
    setChatToDelete(id);
  };
  
  const confirmDelete = () => {
    if (chatToDelete) {
        setChatBoards(prev => prev.filter(board => board.id !== chatToDelete));
        setChatToDelete(null);
    }
  };


  return (
    <>
      <aside className="w-72 bg-card text-card-foreground flex-col border-r hidden md:flex">
        <div className="p-4 border-b w-full">
          <Button variant="outline" className="w-full justify-start gap-2 rounded-[25px]" onClick={handleAddChat}>
              <Plus className="w-4 h-4" />
              <span>Add Chat Board</span>
          </Button>
          <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search Ctrl+K" className="pl-9 bg-background rounded-[25px]" />
          </div>
        </div>
        <div className="space-y-2 p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground px-2">CHAT BOARDS</h3>
            <div className="space-y-1">
                {chatBoards.map((board) => (
                    <div
                         key={board.id}
                         className={cn(
                            "w-full h-auto py-2 group flex justify-between items-center rounded-md hover:bg-accent cursor-pointer",
                             activeChatId === board.id && "bg-accent"
                         )}
                         onClick={() => setActiveChatId(board.id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1 pl-2">
                                <MessageSquare className="w-5 h-5 flex-shrink-0" />
                                <div className="flex-grow text-left overflow-hidden">
                                    <p className="truncate w-full">{board.name}</p>
                                    <p className="text-xs text-muted-foreground">{board.time}</p>
                                </div>
                            </div>
                             <div className="ml-2 flex-shrink-0 flex items-center gap-1 pr-1">
                               <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={(e) => { e.stopPropagation(); toggleStar(board.id); }}>
                                 <Star className={cn("w-4 h-4 text-muted-foreground", board.isStarred && "text-blue-400 fill-blue-400")} />
                               </Button>
                               {board.pinCount > 0 && <Badge variant="default" className="rounded-full h-5 w-5 text-[10px] p-0 flex items-center justify-center bg-blue-400 text-white dark:text-black">{board.pinCount}</Badge>}
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                          <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(board.id); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                      <DropdownMenuItem><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                                      <DropdownMenuItem><Share2 className="mr-2 h-4 w-4" />Share</DropdownMenuItem>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                    </div>
                ))}
            </div>
        </div>
      </aside>
      <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your chat board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
