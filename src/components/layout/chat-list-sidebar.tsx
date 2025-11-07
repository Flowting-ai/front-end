
"use client";

import React, { useState, useRef, useEffect, useContext } from "react";
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
  Check,
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
import { Separator } from "../ui/separator";
import { AppLayoutContext } from "./app-layout";


export type ChatBoard = {
    id: number;
    name:string;
    time: string;
    isStarred: boolean;
    pinCount: number;
};

interface ChatListSidebarProps {
    chatBoards: ChatBoard[];
    setChatBoards: React.Dispatch<React.SetStateAction<ChatBoard[]>>;
    activeChatId: number | null;
    setActiveChatId: (id: number) => void;
    onAddChat: () => void;
}

export function ChatListSidebar({ chatBoards, setChatBoards, activeChatId, setActiveChatId, onAddChat }: ChatListSidebarProps) {
  const [chatToDelete, setChatToDelete] = useState<ChatBoard | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const layoutContext = useContext(AppLayoutContext);

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
        renameInputRef.current.focus();
    }
  }, [renamingChatId]);

  const toggleStar = (id: number) => {
    setChatBoards(prev => prev.map(board => 
        board.id === id ? { ...board, isStarred: !board.isStarred } : board
    ));
  };
  
  const handleDeleteClick = (board: ChatBoard) => {
    setChatToDelete(board);
  };
  
  const confirmDelete = () => {
    if (chatToDelete) {
        setChatBoards(prev => prev.filter(board => board.id !== chatToDelete.id));

        if (activeChatId === chatToDelete.id) {
            const newActiveChat = chatBoards.find(b => b.id !== chatToDelete.id);
            setActiveChatId(newActiveChat ? newActiveChat.id : 0);
        }
        setChatToDelete(null);
    }
  };
  
  const handleRenameClick = (board: ChatBoard) => {
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
    <>
      <aside className="w-[240px] bg-card text-card-foreground flex-col border-r hidden md:flex">
        <div className="p-4 border-b w-full">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search Ctrl+K" className="pl-9 bg-background rounded-[25px]" />
          </div>
          <Separator className="my-4 bg-border/50" />
          <Button variant="outline" className="w-full justify-start gap-2 rounded-[25px]" onClick={onAddChat}>
              <Plus className="w-4 h-4" />
              <span>Add Chat Board</span>
          </Button>
        </div>
        <div className="space-y-2 p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground px-2">CHAT BOARDS</h3>
            <div className="space-y-1">
                {chatBoards.map((board) => (
                    <div
                         key={board.id}
                         className={cn(
                            "w-full h-auto py-2 group flex justify-between items-center rounded-[25px] hover:bg-accent cursor-pointer",
                             activeChatId === board.id && "bg-secondary"
                         )}
                         onClick={() => setActiveChatId(board.id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1 pl-2">
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
                                            className="h-7 text-xs"
                                        />
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRenameSave}><Check className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="truncate w-full text-xs">{board.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{board.time}</p>
                                    </>
                                )}
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
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameClick(board) }}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteClick(board); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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
        <AlertDialogContent className="rounded-[25px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this chat board.
            </AlertDialogDescription>
            {chatToDelete && chatToDelete.pinCount > 0 && (
                <p className="text-sm font-semibold text-destructive mt-2">This chat board has {chatToDelete.pinCount} pinned message(s).</p>
              )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[25px]" onClick={() => setChatToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-[25px]" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
