
"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2, Check, X } from "lucide-react";
import { Textarea } from "../ui/textarea";

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  avatar: ReactNode;
  isPinned?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onPin: (message: Message) => void;
  onCopy: (content: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
}

export function ChatMessage({ message, onPin, onCopy, onEdit, onDelete }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };
  
  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
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

  const AiActions = () => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(message)}>
        <Pin className={cn("h-4 w-4", message.isPinned && "fill-current text-blue-500")} />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7"><Flag className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(message.id)}><Trash2 className="h-4 w-4" /></Button>
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
      <div className="flex flex-col gap-2 max-w-2xl w-full">
        <div
            className={cn(
            "rounded-lg p-4",
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
                  rows={1}
                />
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4"/></Button>
                    <Button size="sm" onClick={handleSaveEdit}><Check className="h-4 w-4"/></Button>
                </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
