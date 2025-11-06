
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2, Bot, User } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";


// Custom hook for typewriter effect
const useTypewriter = (text: string, speed: number = 20, enabled: boolean = true) => {
    const [displayText, setDisplayText] = useState('');
  
    useEffect(() => {
      if (!enabled || !text) {
        setDisplayText(text || '');
        return;
      }
  
      setDisplayText(''); // Reset on new text
      let i = 0;
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
  onDelete: (messageId: string) => void;
  onResubmit: (newContent: string, messageId: string) => void;
  isNewMessage: boolean;
}

export function ChatMessage({ message, isPinned, onPin, onCopy, onEdit, onDelete, onResubmit, isNewMessage }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const displayedContent = useTypewriter(message.content, 20, isNewMessage && !isUser && !message.isLoading);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);
  
  const handleSaveEdit = () => {
    if (editedContent.trim() !== message.content) {
      onEdit(message.id, editedContent);
    }
    setIsEditing(false);
  };
  
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


  const UserActions = () => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7"><Flag className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(message.id)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  )

  const AiActions = () => {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(message)}>
          <Pin className={cn("h-4 w-4", isPinned && "fill-blue-400 text-blue-400")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Flag className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(message.id)}><Trash2 className="h-4 w-4" /></Button>
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
        "flex items-start gap-4 w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && AvatarComponent}
      <div className={cn("flex flex-col gap-2 max-w-[calc(100%-4rem)]", isUser ? 'items-end' : 'items-start')}>
        <div
            className={cn(
            "p-4 rounded-[20px] break-words bg-card",
            isUser && "bg-muted text-card-foreground"
            )}
        >
          {isEditing && isUser ? (
            <div className="space-y-2">
               <Textarea
                  ref={textareaRef}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full text-sm bg-background/20 text-primary-foreground focus-visible:ring-ring"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveAndResubmit}>Save & Submit</Button>
                </div>
            </div>
          ) : message.isLoading ? (
            <LoadingState />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{isUser ? message.content : displayedContent}</p>
          )}
        </div>
        <div className={cn("flex items-center opacity-0 group-hover:opacity-100 transition-opacity", isUser ? "justify-end" : "justify-start")}>
            {isUser ? <UserActions /> : <AiActions />}
        </div>
      </div>
      {isUser && AvatarComponent}
    </div>
  );
}
