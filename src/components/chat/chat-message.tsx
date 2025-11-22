
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Pin, Copy, Pencil, Flag, Trash2, Bot, User, Check, X, Info, CornerDownRight, RefreshCw, Eye, EyeOff } from "lucide-react";
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
  referencedMessageId?: string | null;
  thinkingContent?: string | null;
  imageUrl?: string;
  imageAlt?: string;
  metadata?: {
    modelName?: string;
    providerName?: string;
    llmModelId?: string | number | null;
    inputTokens?: number;
    outputTokens?: number;
    createdAt?: string;
    documentId?: string | null;
    documentUrl?: string | null;
    pinIds?: string[];
    userReaction?: string | null;
  };
}

interface ChatMessageProps {
  message: Message;
  isPinned?: boolean;
  taggedPins?: { id: string; label: string }[];
  onPin: (message: Message) => void;
  onCopy: (content: string) => void;
  onDelete: (message: Message) => void;
  onResubmit: (newContent: string, messageId: string) => void;
  onReference?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onReact?: (message: Message, reaction: string | null) => void;
  referencedMessage?: Message | null;
  isNewMessage: boolean;
}

export function ChatMessage({ message, isPinned, taggedPins = [], onPin, onCopy, onDelete, onResubmit, onReference, onRegenerate, onReact, referencedMessage, isNewMessage }: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showThinking, setShowThinking] = useState(false);
  
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
  useEffect(() => {
    setShowThinking(false);
  }, [message.id, message.thinkingContent]);
  
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
          {onRegenerate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={actionButtonClasses}
                  onClick={() => onRegenerate(message)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Regenerate</p></TooltipContent>
            </Tooltip>
          )}
          {onReference && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={actionButtonClasses} onClick={() => onReference(message)}>
                  <CornerDownRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Reply to this message</p></TooltipContent>
            </Tooltip>
          )}
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
                {message.metadata?.providerName && (
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-muted-foreground">Provider:</span>
                    <span className="text-card-foreground">{message.metadata.providerName}</span>
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
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-slate-200/80 shadow-inner animate-pulse" />
      <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-2.5 w-2.5 rounded-full bg-slate-300 animate-bounce"
              style={{ animationDelay: `${dot * 0.12}s` }}
            />
          ))}
          <span className="text-xs font-medium text-muted-foreground">
            thinking…
          </span>
        </div>
      </div>
    </div>
  )

  const fallbackText = (() => {
    if (isUser) return "U";
    const hint = message.avatarHint || message.metadata?.modelName || message.metadata?.providerName || "";
    const cleaned = hint.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (cleaned.length >= 2) return cleaned.slice(0, 2);
    if (cleaned.length === 1) return cleaned;
    return "AI";
  })();

  const AvatarComponent = (
    <Avatar className="h-9 w-9 border border-white/70 bg-white shadow-[0_6px_15px_rgba(15,23,42,0.12)]">
      {message.avatarUrl && <AvatarImage src={message.avatarUrl} alt={isUser ? "User" : "AI"} data-ai-hint={message.avatarHint} />}
      <AvatarFallback className="text-xs font-semibold text-slate-700">
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-4 w-full group relative",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && AvatarComponent}
      <div className={cn("relative flex flex-col gap-1 max-w-[calc(100%-4rem)]", isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <div className="pointer-events-auto absolute -top-5 right-0 z-10 hidden rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-xs shadow-sm opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
            <div className="flex items-center gap-1">
              {[
                { key: "like", label: "Good", emoji: "👍" },
                { key: "love", label: "Love", emoji: "❤️" },
                { key: "angry", label: "Angry", emoji: "😡" },
                { key: "dislike", label: "Bad", emoji: "👎" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    onReact?.(
                      message,
                      message.metadata?.userReaction === option.key ? null : option.key
                    )
                  }
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-slate-100",
                    message.metadata?.userReaction === option.key && "bg-slate-200"
                  )}
                  title={option.label}
                >
                  <span className="text-base leading-none">{option.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div
            className={cn(
            "p-4 rounded-[22px] break-words shadow-[0_12px_30px_rgba(15,23,42,0.08)] border",
            isUser
              ? "bg-[#EEF2FF] text-slate-900 border-white/60"
              : "bg-white text-slate-900 border-slate-100"
            )}
        >
          {message.referencedMessageId && referencedMessage && (
            <div className="mb-3 pb-3 border-b border-slate-200">
              <div className="flex items-start gap-2 text-xs">
                <CornerDownRight className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-500 mb-0.5">Replying to:</p>
                  <p className="text-slate-600 line-clamp-2 italic">
                    {referencedMessage.content}
                  </p>
                </div>
              </div>
            </div>
          )}
          {message.thinkingContent && (
            <div className="mb-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left font-semibold"
                onClick={() => setShowThinking((prev) => !prev)}
              >
                <span>{showThinking ? "Hide reasoning" : "Show reasoning"}</span>
                {showThinking ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              {showThinking && (
                <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-amber-900/90">
                  {message.thinkingContent}
                </pre>
              )}
            </div>
          )}

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
              {message.imageUrl && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={message.imageUrl}
                    alt={message.imageAlt || message.content || "Generated image"}
                    className="w-full h-auto object-contain bg-white"
                  />
                </div>
              )}
              {taggedPins.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {taggedPins.map((pin) => (
                    <span
                      key={pin.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      <Pin className="h-3 w-3" />
                      <span className="truncate max-w-[240px]">@{pin.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center transition-opacity">
            {isUser ? <UserActions /> : <AiActions />}
        </div>
        {!isUser && message.metadata?.userReaction && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2">
              <span className="text-base leading-none">
                {{
                  like: "👍",
                  love: "❤️",
                  angry: "😡",
                  dislike: "👎",
                  laugh: "😂",
                  insightful: "🤔",
                  confused: "😕",
                  sad: "😢",
                }[message.metadata.userReaction] || "👍"}
              </span>
              <span className="capitalize">{message.metadata.userReaction}</span>
            </span>
          </div>
        )}
      </div>
      {isUser && AvatarComponent}
    </div>
  );
}
