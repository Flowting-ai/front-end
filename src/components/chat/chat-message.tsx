"use client";
import { usePrismHighlight } from "@/hooks/usePrismHighlight";

import chatStyles from "./chat-interface.module.css";
import { useState, useRef, useEffect, useMemo, type JSX } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Pin,
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  CornerDownRight,
  RefreshCw,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Reply,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import Image from "next/image";

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
        className="font-semibold text-[#171717]"
      >
        {match[2]}
      </strong>,
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
      <ul key={listKey} className="ml-5 list-disc space-y-1 text-[#171717]">
        {listBuffer.map((item, index) => (
          <li key={`${listKey}-item-${index}`} className="leading-relaxed">
            {renderInlineContent(item, `${listKey}-item-${index}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      nodes.push(
        <span
          key={`${keyPrefix}-gap-${index}`}
          className="block h-2"
          aria-hidden="true"
        />,
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
            "font-semibold text-[#171717] tracking-tight",
            headingClassByLevel[level],
          )}
        >
          {renderInlineContent(content, `${keyPrefix}-heading-${index}`)}
        </HeadingTag>,
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
        <div
          key={tableKey}
          className="overflow-x-auto rounded-2xl border border-slate-200"
        >
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50/70 text-slate-700">
              <tr>
                {headerCells.map((cell, cellIndex) => (
                  <th
                    key={`${tableKey}-header-${cellIndex}`}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-[#171717]"
                  >
                    {renderInlineContent(
                      cell,
                      `${tableKey}-header-${cellIndex}`,
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr
                  key={`${tableKey}-row-${rowIndex}`}
                  className="odd:bg-white even:bg-slate-50/50"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${tableKey}-cell-${rowIndex}-${cellIndex}`}
                      className="border-t border-slate-100 px-3 py-2 align-top text-[#171717]"
                    >
                      {renderInlineContent(
                        cell,
                        `${tableKey}-cell-${rowIndex}-${cellIndex}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
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
        className="whitespace-pre-wrap leading-relaxed text-[#171717]"
      >
        {renderInlineContent(line, `${keyPrefix}-paragraph-${index}`)}
      </p>,
    );
  }

  flushList();
  return nodes;
};

// Custom hook for typewriter effect
const useTypewriter = (
  text: string,
  speed: number = 50,
  enabled: boolean = true,
) => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayText(text || "");
      return;
    }

    let i = 0;
    setDisplayText(""); // Reset on new text
    const intervalId = setInterval(() => {
      if (i < text.length) {
        setDisplayText((prev) => prev + text.charAt(i));
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
    replyToMessageId?: string | null;
    replyToContent?: string | null;
    attachments?: Array<{
      id: string;
      type: "pdf" | "image";
      name: string;
      url: string;
    }>;
    mentionedPins?: Array<{
      id: string;
      label: string;
      text?: string;
    }>;
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
  onReply?: (message: Message) => void;
  onReact?: (message: Message, reaction: string | null) => void;
  referencedMessage?: Message | null;
  isNewMessage: boolean;
  isResponding?: boolean;
}

export function ChatMessage({
  message,
  isPinned,
  taggedPins = [],
  onPin,
  onCopy,
  onDelete,
  onResubmit,
  onReference,
  onRegenerate,
  onReply,
  onReact,
  referencedMessage,
  isNewMessage,
  isResponding,
}: ChatMessageProps) {
  const isUser = message.sender === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showThinking, setShowThinking] = useState(false);

  // Typewriter effect disabled - displaying content directly
  // const typewriterSpeed = 7;
  // const displayedContent = useTypewriter(
  //   message.content,
  //   typewriterSpeed,
  //   isNewMessage && !isUser && !message.isLoading,
  // );

  usePrismHighlight(message.content);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();

      // Auto-resize logic for height and width
      const adjustSize = () => {
        // Calculate width based on content first
        const span = document.createElement("span");
        span.style.cssText =
          "position: absolute; visibility: hidden; white-space: pre; font-size: 14px; font-family: inherit; line-height: 1.5;";
        span.textContent = textarea.value || textarea.placeholder;
        document.body.appendChild(span);
        const textWidth = span.offsetWidth;
        document.body.removeChild(span);

        // If text is less than one line (less than 550px), shrink width
        // Otherwise, keep at 550px max width
        if (textWidth < 550) {
          textarea.style.width = `${Math.max(textWidth + 40, 100)}px`;
        } else {
          textarea.style.width = "550px";
        }

        // Then reset height to get accurate scrollHeight
        textarea.style.height = "0px";
        const newHeight = textarea.scrollHeight;
        textarea.style.height = `${newHeight}px`;
      };

      adjustSize();
      textarea.addEventListener("input", adjustSize);

      return () => {
        if (textarea) {
          textarea.removeEventListener("input", adjustSize);
        }
      };
    }
  }, [isEditing, editedContent]);
  useEffect(() => {
    setShowThinking(false);
  }, [message.id, message.thinkingContent]);

  const handleSaveAndResubmit = () => {
    onResubmit(editedContent, message.id);
    setIsEditing(false);
  };

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

  const contentToDisplay = message.content;
  const contentSegments = useMemo(
    () => parseContentSegments(contentToDisplay),
    [contentToDisplay],
  );

  const actionButtonClasses =
    "h-8 w-8 rounded-full text-[#6B7280] transition-colors hover:text-[#111827] hover:bg-[#E4E4E7]";

  const UserActions = ({ className }: { className?: string } = {}) => (
    <TooltipProvider>
      <div
        className={cn(
          "bg-transparent inline-flex items-center gap-1",
          // , className
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => onCopy(message.content)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionButtonClasses}
              onClick={() => onDelete(message)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  const AiActions = ({ className }: { className?: string } = {}) => (
    <TooltipProvider>
      <div
        className={cn(
          "bg-transparent inline-flex items-center gap-1 w-full justify-between",
          // ,className
        )}
      >
        <div className="inline-flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  actionButtonClasses,
                  isPinned && "bg-[#4A4A4A] text-white hover:bg-[#4A4A4A]",
                )}
                onClick={() => onPin(message)}
                aria-pressed={isPinned}
              >
                <Pin className={cn("h-4 w-4", isPinned && "fill-white")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPinned ? "Unpin" : "Pin"} message</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={actionButtonClasses}
                onClick={() => onCopy(message.content)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy</p>
            </TooltipContent>
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
              <TooltipContent>
                <p>Regenerate</p>
              </TooltipContent>
            </Tooltip>
          )}
          {onReply && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={actionButtonClasses}
                  onClick={() => onReply(message)}
                >
                  <Reply className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reply</p>
              </TooltipContent>
            </Tooltip>
          )}
          {onReference && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={actionButtonClasses}
                  onClick={() => onReference(message)}
                >
                  <CornerDownRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reply to this message</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={actionButtonClasses}
                onClick={() => onDelete(message)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete</p>
            </TooltipContent>
          </Tooltip>
          {onReact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    actionButtonClasses,
                    message.metadata?.userReaction === "like" &&
                      "bg-[#E4E4E7] text-[#111827]",
                  )}
                  onClick={() =>
                    onReact(
                      message,
                      message.metadata?.userReaction === "like" ? null : "like",
                    )
                  }
                  aria-pressed={message.metadata?.userReaction === "like"}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Good response</p>
              </TooltipContent>
            </Tooltip>
          )}
          {onReact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    actionButtonClasses,
                    message.metadata?.userReaction === "dislike" &&
                      "bg-[#E4E4E7] text-[#111827]",
                  )}
                  onClick={() =>
                    onReact(
                      message,
                      message.metadata?.userReaction === "dislike"
                        ? null
                        : "dislike",
                    )
                  }
                  aria-pressed={message.metadata?.userReaction === "dislike"}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Needs improvement</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {(message.metadata?.modelName || message.metadata?.providerName) && (
          <span className="text-xs text-[#6B7280] font-medium pr-[5px]">
            {message.metadata.modelName || message.metadata.providerName}
          </span>
        )}
      </div>
    </TooltipProvider>
  );

  // const LoadingState = () => (
  //   <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#6B7280]">
  //     {[0, 1, 2].map((dot) => (
  //       <span
  //         key={dot}
  //         className="h-2 w-2 rounded-full bg-[#D4D4D8] animate-bounce"
  //         style={{ animationDelay: `${dot * 0.12}s` }}
  //       />
  //     ))}
  //     <span>Thinking…</span>
  //   </div>
  // );

  const extractInitials = (value: string, fallback: string) => {
    const cleaned = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (cleaned.length >= 2) return cleaned.slice(0, 2);
    if (cleaned.length === 1) return `${cleaned}${cleaned}`;
    return fallback;
  };

  const fallbackText = (() => {
    if (isUser) {
      const hint = message.avatarHint || "User";
      return extractInitials(hint, "US");
    }
    const hint =
      message.avatarHint ||
      message.metadata?.modelName ||
      message.metadata?.providerName ||
      "AI";
    return extractInitials(hint, "AI");
  })();

  const AvatarComponent = !isUser && (
    <Avatar
      className={cn(
        "h-9 w-9 text-xs font-semibold",
        "border border-transparent bg-transparent text-[#111827]",
      )}
    >
      {message.avatarUrl && (
        <AvatarImage
          src={message.avatarUrl}
          alt={"AI"}
          data-ai-hint={message.avatarHint}
        />
      )}
      <AvatarFallback className="bg-transparent text-xs font-semibold text-[#111827]">
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );

  const renderActions = (className?: string) => {
    // Hide action icons ONLY for AI messages that are currently being generated
    // All completed messages (previous responses) keep their action icons visible
    if (!isUser && message.isLoading) {
      return null;
    }
    
    return isUser ? (
      <UserActions className={className} />
    ) : (
      <AiActions className={className} />
    );
  };

  return (
    <div className="group/message w-full">
      <div
        className={cn(
          "relative mx-auto flex w-full items-start my-2",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        {/* Only show avatar for AI, not user */}
        <div className="w-auto flex flex-col items-center justify-start gap-1">
          {!isUser && <div className="mt-4 shrink-0">{AvatarComponent}</div>}
          {!isUser && (
            <span className="text-[10px] text-[#8a8a8a] font-medium text-center max-w-[50px] truncate" title={message.metadata?.modelName || message.metadata?.providerName || message.avatarHint}>
              {message.metadata?.modelName || message.metadata?.providerName || ""}
            </span>
          )}
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col gap-2",
            isUser ? "items-end text-left" : "items-start text-left",
          )}
        >
          <div
            className={cn(
              "relative flex w-full max-w-162 flex-col",
              isUser ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "group/bubble chat-message-bubble relative px-4 py-2",
                isUser
                  ? "chat-message-bubble--user bg-white text-[#111827] border border-[#E4E4E7] rounded-tl-[25px] rounded-tr-[12px] rounded-b-[25px] px-4 py-2"
                  : "chat-message-bubble--ai bg-white text-[#111827] px-6 py-5",
              )}
            >
              {/* Reply indicator for user messages */}
              {isUser && message.metadata?.replyToMessageId && message.metadata?.replyToContent && (
                <div className="mb-2 flex items-start gap-2 px-2 py-1.5 bg-[#F5F5F5] rounded-lg border border-[#E5E5E5]">
                  <Reply className="mt-0.5 h-3 w-3 shrink-0 text-[#666666]" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs font-medium text-[#666666]">
                      Replying to AI
                    </p>
                    <p className="text-xs text-[#8a8a8a] line-clamp-1">
                      {message.metadata.replyToContent.slice(0, 80)}{message.metadata.replyToContent.length > 80 ? '...' : ''}
                    </p>
                  </div>
                </div>
              )}
              {message.referencedMessageId && referencedMessage && (
                <div className="mb-3 border-b border-slate-200 pb-3">
                  <div className="flex items-start gap-2 text-xs">
                    <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 font-semibold text-slate-500">
                        Replying to:
                      </p>
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
                    <span>
                      {showThinking ? "Hide reasoning" : "Show reasoning"}
                    </span>
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
                <div className="space-y-2">
                  <Textarea
                    ref={textareaRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="min-h-[1.5em] resize-none overflow-hidden border-0 bg-transparent text-sm text-[#171717] ring-0 shadow-none focus-visible:ring-0"
                    style={{ width: "auto", maxWidth: "100%" }}
                    rows={1}
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveAndResubmit}
                      className="h-7 w-7"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 w-7"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : message.isLoading ? (
                <div className="max-w-125 w-125 flex flex-col gap-2">
                  <div className="bg-zinc-400/50 w-full h-4 animate-pulse rounded-md"></div>
                  <div className="bg-zinc-400/50 w-4/5 h-4 animate-pulse rounded-md"></div>
                </div>
              ) : (
                // <LoadingState />
                <div className="flex flex-col gap-4 text-sm">
                  {contentSegments.length === 0 && (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {contentToDisplay}
                    </p>
                  )}
                  {contentSegments.map((segment, index) => {
                    if (segment.type === "code") {
                      return (
                        <div
                          key={`code-${message.id}-${index}`}
                          className={`relative border border-zinc-100 rounded-2xl bg-[#f9f9f9] py-2 overflow-hidden`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70 px-4">
                            {segment.language && (
                              <span className="text-black">
                                {segment.language}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onCopy(segment.value)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium border border-main-border text-black transition hover:text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
                          <pre
                            className={`overflow-x-auto rounded-2xl bg-transparent p-4 font-normal text-[14px] leading-relaxed ${chatStyles.customScrollbar}`}
                          >
                            <code
                              className={`language-${segment.language || "ts"}`}
                            >
                              {segment.value.trimEnd()}
                            </code>
                          </pre>
                        </div>
                      );
                    }

                    if (!segment.value) {
                      return <br key={`text-${message.id}-${index}`} />;
                    }

                    return (
                      <div
                        key={`text-${message.id}-${index}`}
                        className="space-y-2"
                      >
                        {renderTextContent(
                          segment.value,
                          `text-${message.id}-${index}`,
                        )}
                      </div>
                    );
                  })}
                  {message.imageUrl && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <Image
                        src={message.imageUrl}
                        alt={
                          message.imageAlt ||
                          message.content ||
                          "Generated image"
                        }
                        className="w-full h-auto object-contain bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              className={cn(
                "mt-1 flex w-full",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              {renderActions(
                "flex items-center gap-1 rounded-full bg-[#F5F5F5]/80 px-1.5 py-1 text-xs backdrop-blur-sm",
              )}
            </div>
          </div>
          {/* Show tagged pins above user chat bubble only */}
          {isUser && taggedPins.length > 0 && (
            <div
              className={cn(
                "mb-1 flex flex-wrap gap-2",
                isUser ? "justify-end" : "justify-start",
              )}
            >
              {taggedPins.map((pin) => (
                <span
                  key={pin.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F4] px-3 py-1 text-xs font-medium text-[#44404D]"
                >
                  <Pin className="h-3 w-3" />
                  <span className="truncate max-w-[240px]">@{pin.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
