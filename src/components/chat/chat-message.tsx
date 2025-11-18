
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2, Bot, User, Check, X, Info } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

type ContentSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language?: string };

const parseContentSegments = (value: string): ContentSegment[] => {
  if (!value) return [];
  const segments: ContentSegment[] = [];
  const codeRegex = /```([\w+-]+)?\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: value.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: "code",
      language: match[1]?.trim(),
      value: match[2] ?? "",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  return segments;
};

const headingClassByLevel: Record<number, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
  4: "text-base",
  5: "text-sm",
  6: "text-xs",
};

const isTableDivider = (line: string) =>
  /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line.trim());

const isTableRow = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
};

const parseTableRow = (line: string) => {
  const cleaned = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return cleaned.split("|").map((cell) => cell.trim());
};

const renderInlineContent = (text: string, keyPrefix: string) => {
  const boldRegex = /(\*\*|__)(.+?)\1/g;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let boldCount = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong
        key={`${keyPrefix}-bold-${boldCount++}`}
        className="font-semibold text-card-foreground"
      >
        {match[2]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  if (nodes.length === 0) {
    nodes.push(text);
  }

  return nodes;
};

const renderTextContent = (value: string, keyPrefix: string): JSX.Element[] => {
  const nodes: JSX.Element[] = [];
  const lines = value.replace(/\r/g, "").split("\n");
  const listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const listKey = `${keyPrefix}-list-${nodes.length}`;
    nodes.push(
      <ul key={listKey} className="ml-5 list-disc space-y-1 text-card-foreground">
        {listBuffer.map((item, index) => (
          <li key={`${listKey}-item-${index}`} className="leading-relaxed">
            {renderInlineContent(item, `${listKey}-item-${index}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      nodes.push(
        <span key={`${keyPrefix}-gap-${index}`} className="block h-2" aria-hidden="true" />
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = Math.min(headingMatch[1].length, 6);
      const content = headingMatch[2];
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(
        <HeadingTag
          key={`${keyPrefix}-heading-${index}`}
          className={cn(
            "font-semibold text-card-foreground tracking-tight",
            headingClassByLevel[level]
          )}
        >
          {renderInlineContent(content, `${keyPrefix}-heading-${index}`)}
        </HeadingTag>
      );
      continue;
    }

    if (isTableRow(line) && isTableDivider(lines[index + 1] ?? "")) {
      flushList();
      const headerCells = parseTableRow(line);
      index += 2; // skip divider line
      const bodyRows: string[][] = [];

      while (index < lines.length && isTableRow(lines[index])) {
        bodyRows.push(parseTableRow(lines[index]));
        index++;
      }

      const tableKey = `${keyPrefix}-table-${nodes.length}`;
      nodes.push(
        <div key={tableKey} className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50/70 text-slate-700">
              <tr>
                {headerCells.map((cell, cellIndex) => (
                  <th
                    key={`${tableKey}-header-${cellIndex}`}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold"
                  >
                    {renderInlineContent(cell, `${tableKey}-header-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`${tableKey}-row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${tableKey}-cell-${rowIndex}-${cellIndex}`}
                      className="border-t border-slate-100 px-3 py-2 align-top text-slate-600"
                    >
                      {renderInlineContent(
                        cell,
                        `${tableKey}-cell-${rowIndex}-${cellIndex}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      index -= 1; // adjust for loop increment
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      continue;
    }

    flushList();
    nodes.push(
      <p
        key={`${keyPrefix}-paragraph-${index}`}
        className="whitespace-pre-wrap leading-relaxed text-card-foreground"
      >
        {renderInlineContent(line, `${keyPrefix}-paragraph-${index}`)}
      </p>
    );
  }

  flushList();
  return nodes;
};

// Custom hook for typewriter effect
const useTypewriter = (text: string, speed: number = 50, enabled: boolean = true) => {
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
  chatMessageId?: string;
  pinId?: string;
  metadata?: {
    modelName?: string;
    providerName?: string;
    inputTokens?: number;
    outputTokens?: number;
    createdAt?: string;
  };
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
  
  // Faster typewriter effect (~1500 WPM) to keep bot replies snappy.
  const typewriterSpeed = 7;
  const displayedContent = useTypewriter(
    message.content,
    typewriterSpeed,
    isNewMessage && !isUser && !message.isLoading
  );

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

  const contentToDisplay = isUser ? message.content : displayedContent;
  const contentSegments = useMemo(
    () => parseContentSegments(contentToDisplay),
    [contentToDisplay]
  );

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
        <Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className={actionButtonClasses}><Info className="h-4 w-4" /></Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Info</p></TooltipContent>
          </Tooltip>
          <DialogContent className="rounded-[25px]">
            <DialogHeader>
              <DialogTitle>Message Information</DialogTitle>
              <DialogDescription>Metadata about this message</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="font-semibold text-muted-foreground">Message ID:</span>
                <span className="text-card-foreground font-mono text-xs break-all">{message.chatMessageId || message.id}</span>
              </div>
              {message.metadata?.createdAt && (
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <span className="font-semibold text-muted-foreground">Created:</span>
                  <span className="text-card-foreground">{new Date(message.metadata.createdAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className={actionButtonClasses}><Info className="h-4 w-4" /></Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Info</p></TooltipContent>
            </Tooltip>
            <DialogContent className="rounded-[25px]">
              <DialogHeader>
                <DialogTitle>Message Information</DialogTitle>
                <DialogDescription>Metadata about this AI response</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <span className="font-semibold text-muted-foreground">Message ID:</span>
                  <span className="text-card-foreground font-mono text-xs break-all">{message.chatMessageId || message.id}</span>
                </div>
                {message.metadata?.createdAt && (
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-muted-foreground">Created:</span>
                    <span className="text-card-foreground">{new Date(message.metadata.createdAt).toLocaleString()}</span>
                  </div>
                )}
                {message.metadata?.modelName && (
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-muted-foreground">Model:</span>
                    <span className="text-card-foreground">{message.metadata.modelName}</span>
                  </div>
                )}
                {message.metadata?.outputTokens !== undefined && (
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-muted-foreground">Output Tokens:</span>
                    <span className="text-card-foreground">{message.metadata.outputTokens.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
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
    <Avatar className="h-9 w-9 border border-white/70 bg-white shadow-[0_6px_15px_rgba(15,23,42,0.12)]">
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
            "p-4 rounded-[22px] break-words shadow-[0_12px_30px_rgba(15,23,42,0.08)] border",
            isUser
              ? "bg-[#EEF2FF] text-slate-900 border-white/60"
              : "bg-white text-slate-900 border-slate-100"
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
            <div className="flex flex-col gap-4 text-sm">
              {contentSegments.length === 0 && (
                <p className="whitespace-pre-wrap leading-relaxed">{contentToDisplay}</p>
              )}
              {contentSegments.map((segment, index) => {
                if (segment.type === "code") {
                  return (
                    <div key={`code-${message.id}-${index}`} className="relative rounded-2xl bg-slate-900 text-slate-50">
                      <div className="absolute right-3 top-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                        {segment.language && (
                          <span>{segment.language}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => onCopy(segment.value)}
                          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-2xl bg-transparent p-4 text-xs leading-relaxed">
                        <code>{segment.value.trimEnd()}</code>
                      </pre>
                    </div>
                  );
                }

                if (!segment.value) {
                  return <br key={`text-${message.id}-${index}`} />;
                }

                return (
                  <div key={`text-${message.id}-${index}`} className="space-y-2">
                    {renderTextContent(segment.value, `text-${message.id}-${index}`)}
                  </div>
                );
              })}
            </div>
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
