
"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2 } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";


// Custom hook for typewriter effect
const useTypewriter = (text: string, speed: number = 20) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (!text) return;
    setDisplayText(''); // Reset on new text
    let i = 0;
    const intervalId = setInterval(() => {
      if(i < text.length) {
        setDisplayText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(intervalId);
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed]);

  return displayText;
};


export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  avatar: ReactNode;
  isPinned?: boolean;
  isLoading?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onPin: (message: Message) => void;
  onCopy: (content: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
  onResubmit: (newContent: string, messageId: string) => void;
}

export function ChatMessage({ message, onPin, onCopy, onEdit, onDelete, onResubmit }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Convert 90 WPM to character delay. Avg word is 5 chars + space = 6.
  // 90 WPM * 6 chars/word = 540 chars/min.
  // 60,000 ms/min / 540 chars/min = ~111 ms/char. We'll use a faster 20ms for better UX.
  const displayedContent = useTypewriter(message.content, 20);

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
    // The UI for the user message will update via the onResubmit flow,
    // which modifies the main messages array. We don't need onEdit here.
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
          <Pin className={cn("h-4 w-4", message.isPinned && "fill-current text-blue-500")} />
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

  return (
    <div
      className={cn(
        "flex items-start gap-4 group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && message.avatar}
      <div className="flex flex-col gap-2 w-full max-w-[calc(100%-4rem)]">
        <div
            className={cn(
            "p-4 rounded-[20px] break-words",
            isUser
                ? "bg-primary text-primary-foreground"
                : "bg-background"
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
        <div className={cn("flex items-center", isUser ? "justify-end" : "justify-start")}>
            {isUser ? <UserActions /> : <AiActions />}
        </div>
      </div>
      {isUser && message.avatar}
    </div>
  );
}

      