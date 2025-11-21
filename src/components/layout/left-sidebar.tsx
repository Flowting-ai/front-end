
"use client";

import React, { useRef, useEffect } from 'react';
import { ChevronsLeft, Star, Trash2, Edit3, PanelLeftClose, NotepadText, Layers, BotMessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ChatBoard } from './app-layout';
import { Logo } from '../icons/logo';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


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

  const handleRename = (board: ChatBoard) => {
    setRenamingChatId(board.id);
    setRenamingText(board.name);
  };

  const handleRenameSubmit = () => {
    if (renamingChatId && renamingText) {
      setChatBoards(boards => boards.map(b => b.id === renamingChatId ? { ...b, name: renamingText } : b));
      setRenamingChatId(null);
      setRenamingText('');
    }
  };

  const toggleStar = (boardId: string) => {
    setChatBoards(boards => boards.map(b => b.id === boardId ? { ...b, isStarred: !b.isStarred } : b));
  };

  const starredChats = chatBoards.filter(b => b.isStarred).sort((a, b) => a.name.localeCompare(b.name));
  const unstarredChats = chatBoards.filter(b => !b.isStarred).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingChatId, renameInputRef]);

  const renderChatList = (list: ChatBoard[]) => {
    return list.map(board => (
      <div
        key={board.id}
        onClick={() => renamingChatId !== board.id && setActiveChatId(board.id)}
        className={cn(
          "group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm",
          activeChatId === board.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          isCollapsed && "justify-center"
        )}
      >
        {renamingChatId === board.id ? (
          <Input
            ref={renameInputRef}
            value={renamingText}
            onChange={(e) => setRenamingText(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            className="h-7 text-sm px-1.5 w-full"
          />
        ) : (
          <span className={cn("truncate", isCollapsed && "hidden")}>{board.name}</span>
        )}

        {!isCollapsed && renamingChatId !== board.id && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); handleRename(board);}}><Edit3 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); toggleStar(board.id);}}>
                    <Star className={cn("h-3.5 w-3.5", board.isStarred ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); handleDeleteClick(board);}}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
        )}
      </div>
    ));
  };

  return (
    <TooltipProvider delayDuration={0}>
        <aside className={cn(
            "flex flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border relative hidden md:flex h-full overflow-y-auto overflow-x-hidden",
            isCollapsed ? "w-[72px] items-center" : "w-[240px]"
          )}
          style={{ backgroundColor: '#F5F5F5' }}
          >

          <div className={cn("flex items-center p-4 h-[60px]", isCollapsed ? 'justify-center' : 'justify-between')}>
              <div className={cn("flex items-center gap-2", isCollapsed ? 'justify-center' : '')}>
                  <div className={cn("transition-all", isCollapsed ? "group cursor-ew-resize" : "")}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <div
                              className="relative h-6 w-6"
                              onClick={isCollapsed ? onToggle : undefined}
                          >
                              <Logo className={cn("text-primary h-6 w-6 transition-opacity", isCollapsed && "group-hover:opacity-0")} />
                              <PanelLeftClose className={cn("text-primary h-6 w-6 absolute top-0 left-0 opacity-0 transition-opacity", isCollapsed && "group-hover:opacity-100")} />
                          </div>
                      </TooltipTrigger>
                      {isCollapsed && (
                          <TooltipContent side="right">
                              Open sidebar
                          </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                  {!isCollapsed && <h1 className="text-lg font-semibold">Flowting</h1>}
              </div>
              {!isCollapsed && (
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 rounded-full">
                              <PanelLeftClose className="h-4 w-4"/>
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                          <p>Collapse sidebar</p>
                      </TooltipContent>
                  </Tooltip>
              )}
          </div>
          
          <div className="w-full px-2">
            <Separator />
          </div>

          <div className="flex-1 overflow-y-auto w-full px-2 space-y-2 py-4">
            {!isCollapsed ? (
                <Button 
                    variant="outline"
                    className="w-[210px] h-[40px] mb-2 justify-start px-3 rounded-md text-base font-medium"
                    style={{ backgroundColor: '#2C2C2C', color: '#F5F5F5' }}
                    onClick={onAddChat}
                >
                    <NotepadText className="mr-2 h-5 w-5"/> 
                    Chat Board
                </Button>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button 
                            variant="outline"
                            size="icon" 
                            className="w-10 h-10 rounded-full mb-2"
                            style={{ backgroundColor: '#2C2C2C', color: '#F5F5F5' }}
                            onClick={onAddChat}
                        >
                            <NotepadText className="h-5 w-5"/>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Chat Board</p>
                    </TooltipContent>
                </Tooltip>
            )}

            <div className="space-y-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <a href="#" className={cn("flex items-center p-2 rounded-md", isCollapsed ? "justify-center" : "hover:bg-accent/50")}>
                            <Layers className={cn("h-5 w-5", !isCollapsed && "h-6 w-6")} />
                            {!isCollapsed && <span className="ml-3 text-sm font-medium">Workflows</span>}
                        </a>
                    </TooltipTrigger>
                    {isCollapsed && <TooltipContent side="right"><p>Workflows</p></TooltipContent>}
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <a href="#" className={cn("flex items-center p-2 rounded-md", isCollapsed ? "justify-center" : "hover:bg-accent/50")}>
                            <BotMessageSquare className={cn("h-5 w-5", !isCollapsed && "h-6 w-6")} />
                            {!isCollapsed && <span className="ml-3 text-sm font-medium">AI Automation</span>}
                        </a>
                    </TooltipTrigger>
                    {isCollapsed && <TooltipContent side="right"><p>AI Automation</p></TooltipContent>}
                </Tooltip>
            </div>

            {!isCollapsed && <Separator className="my-2" />}

            {starredChats.length > 0 && (
              <div className="mb-2">
                {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-1">Starred</h3>}
                {renderChatList(starredChats)}
              </div>
            )}
            
            {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-1">Recent</h3>}
            {renderChatList(unstarredChats)}
          </div>
          
          <div className="p-4 border-t w-full h-[60px] flex items-center">
              <div className={cn("flex items-center gap-2", isCollapsed && "justify-center w-full")}>
                  <Avatar className="h-[22px] w-[22px]">
                      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                      <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && <div className="h-[22px] w-[106px] flex items-center"><span className="text-sm font-medium truncate">shadcn</span></div>}
              </div>
          </div>
      </aside>
    </TooltipProvider>
  );
}
