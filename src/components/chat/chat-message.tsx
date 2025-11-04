
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2 } from "lucide-react";

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
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
}

export function ChatMessage({ message, onPin, onCopy, onEdit, onDelete }: ChatMessageProps) {
  const isUser = message.sender === "user";

  const UserActions = () => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(message.content)}><Copy className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(message)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7"><Flag className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(message.id)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  )

  const AiActions = () => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(message)}>
        <Pin className={cn("h-4 w-4", message.isPinned && "fill-current text-foreground")} />
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
      <div className="flex flex-col gap-2 max-w-2xl">
        <div
            className={cn(
            "rounded-lg p-4",
            isUser
                ? "bg-primary text-primary-foreground"
                : "bg-background"
            )}
        >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={cn("flex items-center", isUser ? "justify-end" : "justify-start")}>
            {isUser ? <UserActions /> : <AiActions />}
        </div>
      </div>
      {isUser && message.avatar}
    </div>
  );
}

    