
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2, Bot, User, Check, X } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


// Custom hook for typewriter effect
const useTypewriter = (text: string, speed: number = 5, enabled: boolean = true) => {
    const [displayText, setDisplayText] = useState('');
  
    useEffect(() => {
      if (!enabled || !text) {
        setDisplayText(text || '');
        return;
      }
  
      let i = 0;
      setDisplayText(''); // Reset on new text
      const intervalId = setInterval(() => {
        if (i < text.length) {
          setDisplayText(prev => prev + text.charAt(i));
          i++;
        } else {
          clearInterval(intervalId);
        }
      }, speed);
  
      return () => clearInterval(intervalId);
    }, [text, speed, enabled]);
  
    return displayText;
  };


export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  avatarUrl?: string;
  avatarHint?: string;
  isLoading?: boolean;
}

interface ChatMessageProps {
  message: Message;
  isPinned?: boolean;
  onPin: (message: Message) => void;
  onCopy: (content: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (message: Message) => void;
  onResubmit: (newContent: string, messageId: string) => void;
  isNewMessage: boolean;
}

export function ChatMessage({ message, isPinned, onPin, onCopy, onEdit, onDelete, onResubmit, isNewMessage }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const displayedContent = useTypewriter(message.content, 5, isNewMessage && !isUser && !message.isLoading);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      // Auto-resize logic
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      adjustHeight();
      textarea.addEventListener('input', adjustHeight);

      return () => {
        if (textarea) {
            textarea.removeEventListener('input', adjustHeight);
        }
      };
    }
  }, [isEditing]);
  
  const handleSaveAndResubmit = () => {
    onResubmit(editedContent, message.id);
    setIsEditing(false);
  }

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };
  
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveAndResubmit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const actionButtonClasses = "h-7 w-7 text-muted-foreground/60 hover:text-muted-foreground";

  const UserActions = () => (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Copy</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Edit</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={actionButtonClasses}><Flag className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Flag</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onDelete(message)}><Trash2 className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Delete</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )

  const AiActions = () => {
    return (
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onPin(message)}>
                <Pin className={cn("h-4 w-4", isPinned && "fill-primary text-primary")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{isPinned ? "Unpin" : "Pin"} message</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent><p>Copy</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={actionButtonClasses}><Flag className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent><p>Flag</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onDelete(message)}><Trash2 className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent><p>Delete</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  const LoadingState = () => (
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 w-20 rounded-md" />
      <Skeleton className="h-4 w-16 rounded-md" />
    </div>
  )

  const AvatarComponent = (
    <Avatar className="h-8 w-8">
      {message.avatarUrl && <AvatarImage src={message.avatarUrl} alt={isUser ? "User" : "AI"} data-ai-hint={message.avatarHint} />}
      <AvatarFallback>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-4 w-full group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && AvatarComponent}
      <div className={cn("flex flex-col gap-1 max-w-[calc(100%-4rem)]", isUser ? 'items-end' : 'items-start')}>
        <div
            className={cn(
            "p-4 rounded-[20px] break-words",
            "bg-card text-card-foreground",
            )}
        >
          {isEditing && isUser ? (
            <div className="space-y-2 w-full">
               <Textarea
                  ref={textareaRef}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full text-sm bg-transparent text-card-foreground focus-visible:ring-0 ring-0 border-0 shadow-none resize-none overflow-hidden"
                  rows={1}
                />
                <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={handleSaveAndResubmit} className="h-7 w-7"><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                </div>
            </div>
          ) : message.isLoading ? (
            <LoadingState />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{isUser ? message.content : displayedContent}</p>
          )}
        </div>
        <div className="flex items-center transition-opacity">
            {isUser ? <UserActions /> : <AiActions />}
        </div>
      </div>
      {isUser && AvatarComponent}
    </div>
  );
}
