"use client";
import { usePrismHighlight } from "@/hooks/usePrismHighlight";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import chatStyles from "./chat-interface.module.css";
import { useState, useRef, useEffect, useCallback, type JSX } from "react";
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
  ChevronDown,
  ChevronUp,
  Search,
  MessageSquare,
  ExternalLink,
  Globe,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import Image from "next/image";


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

export interface Citation {
  url: string;
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface MemorySearchResult {
  name: string;
  chats: Array<{ chatId: string; title: string }>;
}

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
  citations?: Citation[];
  memoryResults?: MemorySearchResult[];
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
    cost?: number;
    latencyMs?: number;
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

function MemorySearchSection({ results }: { results: MemorySearchResult[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3 rounded-xl border border-amber-200/60 bg-amber-50/20 px-4 py-3 text-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Searched memory</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="mt-3 space-y-3">
          {results.map((result, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-medium text-zinc-400">
                  Relevant chats
                </p>
                <span className="text-[11px] text-zinc-400">
                  {result.chats.length} {result.chats.length === 1 ? "result" : "results"}
                </span>
              </div>
              <ul className="space-y-1">
                {result.chats.map((chat, chatIdx) => (
                  <li
                    key={chatIdx}
                    className="flex items-center gap-2 text-[12px] text-zinc-600 py-1"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate">{chat.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CitationsList({ citations }: { citations: Citation[] }) {
  const uniqueCitations = citations.filter(
    (citation, index, self) =>
      index === self.findIndex((c) => c.url === citation.url)
  );

  if (uniqueCitations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
        Sources
      </p>
      <div className="flex flex-col gap-1.5">
        {uniqueCitations.map((citation, idx) => {
          let faviconUrl: string | null = null;
          try {
            const domain = new URL(citation.url).hostname;
            faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
          } catch {
            // invalid URL, fall back to Globe icon
          }

          return (
            <a
              key={idx}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12px] text-blue-600 hover:text-blue-800 transition-colors group"
            >
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  onError={(e) => {
                    // Hide broken favicon, parent still has gap so it looks fine
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Globe className="h-3.5 w-3.5 shrink-0 text-blue-400 group-hover:text-blue-600" />
              )}
              <span className="truncate underline underline-offset-2">
                {citation.title || citation.url}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          );
        })}
      </div>
    </div>
  );
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
  const [showThinking, setShowThinking] = useState(true);

  // Typewriter effect for thinking/reasoning content
  const thinkingTypewriterSpeed = 5;
  const displayedThinking = useTypewriter(
    message.thinkingContent || "",
    thinkingTypewriterSpeed,
    isNewMessage && !isUser && isResponding && !!message.thinkingContent,
  );

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
    setShowThinking(true);
  }, [message.id]);

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

  const handleCopyCode = useCallback((code: string) => {
    onCopy(code);
  }, [onCopy]);

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
                <div className={cn(
                  "mb-3 rounded-xl border border-zinc-200/80 bg-zinc-50/30 px-4 py-3 text-xs",
                  isResponding && "border-l-2 border-l-zinc-400"
                )}>
                  <div className="flex w-full items-center justify-between">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                      onClick={() => setShowThinking((prev) => !prev)}
                    >
                      {showThinking ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span>
                        {showThinking ? "Hide reasoning" : "Show reasoning"}
                      </span>
                    </button>
                    {showThinking && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
                        onClick={() => onCopy(message.thinkingContent ?? "")}
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                  {showThinking && (
                    <div className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-500 italic">
                      {isNewMessage && isResponding ? displayedThinking : message.thinkingContent}
                      {isNewMessage && isResponding && displayedThinking.length < (message.thinkingContent?.length || 0) && (
                        <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-zinc-400 animate-pulse align-middle" />
                      )}
                    </div>
                  )}
                </div>
              )}

              {message.memoryResults && message.memoryResults.length > 0 && (
                <MemorySearchSection results={message.memoryResults} />
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
                <div className="max-w-125 w-auto flex flex-col gap-2">
                  <div className="bg-zinc-400/50 w-[300px] h-4 animate-pulse rounded-md"></div>
                  <div className="bg-zinc-400/50 w-[175px] h-4 animate-pulse rounded-md"></div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-sm text-[#171717]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Headings
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-semibold text-[#171717] tracking-tight mt-4 mb-2">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-[#171717] tracking-tight mt-3 mb-2">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-[#171717] tracking-tight mt-3 mb-1">{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-base font-semibold text-[#171717] mt-2 mb-1">{children}</h4>
                      ),
                      // Paragraphs
                      p: ({ children }) => (
                        <p className="leading-relaxed text-[#171717] my-2">{children}</p>
                      ),
                      // Links
                      a: ({ href, children }) => {
                        let faviconUrl: string | null = null;
                        let domain = "";
                        try {
                          domain = new URL(href || "").hostname;
                          faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                        } catch {
                          // invalid URL
                        }

                        // Check if link text is a bare URL (children equals href)
                        const childText = Array.isArray(children)
                          ? children.join("")
                          : typeof children === "string"
                            ? children
                            : "";
                        const isBareUrl = childText === href && domain;

                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors group/link"
                          >
                            {faviconUrl && (
                              <img
                                src={faviconUrl}
                                alt=""
                                width={14}
                                height={14}
                                className="inline-block h-3.5 w-3.5 rounded-sm shrink-0 align-text-bottom"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            {isBareUrl ? domain : children}
                            <ExternalLink className="inline-block h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        );
                      },
                      // Bold
                      strong: ({ children }) => (
                        <strong className="font-semibold text-[#171717]">{children}</strong>
                      ),
                      // Italic
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      // Lists
                      ul: ({ children }) => (
                        <ul className="ml-5 list-disc space-y-1 text-[#171717] my-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="ml-5 list-decimal space-y-1 text-[#171717] my-2">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                      ),
                      // Code blocks
                      pre: ({ children }) => (
                        <div className="relative border border-zinc-100 rounded-2xl bg-[#f9f9f9] py-2 overflow-hidden my-3">
                          {children}
                        </div>
                      ),
                      code: ({ className, children }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !className;
                        const codeContent = String(children).replace(/\n$/, "");

                        if (isInline) {
                          return (
                            <code className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-[13px] font-mono">
                              {children}
                            </code>
                          );
                        }

                        return (
                          <>
                            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
                              {match && (
                                <span className="text-black">{match[1]}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyCode(codeContent)}
                                className="cursor-pointer inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium border border-main-border text-black transition hover:text-white hover:bg-black"
                              >
                                <Copy className="h-3 w-3" />
                                Copy
                              </button>
                            </div>
                            <pre className={`overflow-x-auto bg-transparent px-4 pb-2 font-normal text-[14px] leading-relaxed ${chatStyles.customScrollbar}`}>
                              <code className={className}>
                                {codeContent}
                              </code>
                            </pre>
                          </>
                        );
                      },
                      // Tables
                      table: ({ children }) => (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 my-3">
                          <table className="w-full border-collapse text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-50/70 text-slate-700">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-[#171717]">
                          {children}
                        </th>
                      ),
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => (
                        <tr className="odd:bg-white even:bg-slate-50/50">{children}</tr>
                      ),
                      td: ({ children }) => (
                        <td className="border-t border-slate-100 px-3 py-2 align-top text-[#171717]">
                          {children}
                        </td>
                      ),
                      // Blockquotes
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-zinc-600 my-3">
                          {children}
                        </blockquote>
                      ),
                      // Horizontal rule
                      hr: () => <hr className="border-zinc-200 my-4" />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.imageUrl && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 mt-3">
                      <Image
                        src={message.imageUrl}
                        alt={
                          message.imageAlt ||
                          message.content ||
                          "Generated image"
                        }
                        width={0}
                        height={0}
                        sizes="100vw"
                        unoptimized={message.imageUrl.startsWith("data:")}
                        className="w-full h-auto object-contain bg-white"
                      />
                    </div>
                  )}
                  {message.citations && message.citations.length > 0 && (
                    <CitationsList citations={message.citations} />
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
