"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MarkdownRenderer } from "@/lib/markdown-utils";
import { ReasoningBlock } from "./ReasoningBlock";
import { ActivitiesSection } from "./ActivityRow";
import { StreamingCursor } from "./StreamingCursor";
import { useHighlightJs } from "@/hooks/useHighlightJs";
import { usePinboard } from "@/context/pinboard-context";
import type { UIMessage, ActivityItem } from "@/hooks/use-chat-state";

// ── Icon Components (matching souvenir-chat-preview) ──────────────────────────

function CopyIcon({ size = 18, color = "#A09890" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 18, color = "#80B707" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RetryIcon({ size = 18, color = "#A09890" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
      <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14" />
    </svg>
  );
}

function EditIcon({ size = 16, color = "#B6ACA4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function ThumbsUpIcon({ size = 18, color = "#A09890" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 22V11l5-9a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 1.8l-1 9a2 2 0 0 1-2 1.2H7z" />
      <path d="M2 13v8a1 1 0 0 0 1 1h2V12H3a1 1 0 0 0-1 1z" />
    </svg>
  );
}

function ThumbsDownIcon({ size = 18, color = "#A09890" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2V13l-5 9a2 2 0 0 1-2-2v-4H4.5a2 2 0 0 1-2-1.8l1-9A2 2 0 0 1 5.5 4H17z" />
      <path d="M22 11V3a1 1 0 0 0-1-1h-2v10h2a1 1 0 0 0 1-1z" />
    </svg>
  );
}

function BookmarkIcon({ size = 18, color = "#A09890" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ── Standalone Activities Block (collapsible, used when no reasoning) ─────────

function StandaloneActivitiesBlock({
  modelName,
  activities,
}: {
  modelName?: string;
  activities: ActivityItem[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const modelFull = (modelName || "souvenir").toLowerCase();

  // Derive summary for collapsed state
  const doneCount = activities.filter((a) => a.status === "done").length;
  const allDone = doneCount === activities.length;
  const summaryText = allDone
    ? `${activities.length} ${activities.length === 1 ? "action" : "actions"} completed`
    : `${doneCount}/${activities.length} actions`;

  return (
    <div style={{ margin: "4px 0 8px" }}>
      {/* Header row — model name + summary + chevron */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--neutral-600, #524B47)",
            flexShrink: 0,
          }}
        >
          {modelFull}
        </span>
        <span
          style={{
            fontSize: 14,
            color: "var(--neutral-400, #9A9089)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          · {summaryText}
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 3,
            display: "flex",
            alignItems: "center",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ display: "block", flexShrink: 0 }}
          >
            <path
              d="M3 5.5 L7 9.5 L11 5.5"
              stroke="var(--neutral-400, #9C938B)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </button>
      </div>

      {/* Collapsible activities panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 260, damping: 28 },
              opacity: { duration: 0.22, ease: "easeInOut" },
            }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 10 }}>
              <ActivitiesSection activities={activities} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ChatMessage Component ────────────────────────────────────────────────

interface ChatMessageProps {
  message: UIMessage;
  isLast: boolean;
  isNewMessage?: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onCitationsClick?: () => void;
}

export function ChatMessage({
  message,
  isLast,
  isNewMessage = false,
  onRegenerate,
  onEdit,
  onCitationsClick,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { addPin, removePinByMessage, isPinned, open: openPinboard } = usePinboard();

  useHighlightJs(contentRef);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasThinking = Boolean(message.thinking);
  const hasCitations =
    Boolean(message.citations?.length) || Boolean(message.sources?.length);
  const pinned = isAssistant ? isPinned(message.id) : false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleEditSubmit = () => {
    if (editValue.trim() && editValue !== message.content) {
      onEdit?.(message.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setEditValue(message.content);
      setIsEditing(false);
    }
  };

  const handlePin = () => {
    if (pinned) {
      removePinByMessage(message.id);
      return;
    }
    const title =
      message.content.slice(0, 80).split("\n")[0] || "Pinned response";
    addPin({
      content: message.content,
      title,
      category: "Quote",
      messageId: message.id,
      modelName: message.modelName || message.model,
    });
    openPinboard();
  };

  return (
    <motion.div
      initial={isUser ? { opacity: 0, y: 10, scale: 0.97 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={isUser
        ? { type: "spring", stiffness: 380, damping: 28 }
        : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
      }
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        padding: "12px 0",
        width: "100%",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isUser ? (
        /* ── User message: right-aligned bubble ── */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: "85%" }}>
          {isEditing ? (
            <div style={{ width: "100%", maxWidth: 566 }}>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleEditSubmit}
                autoFocus
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  border: "1px solid var(--neutral-300)",
                  fontFamily: "var(--font-body)",
                  fontSize: "16px",
                  lineHeight: "22px",
                  color: "var(--neutral-900)",
                  backgroundColor: "var(--neutral-white)",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "var(--neutral-500)",
                }}
              >
                <span>Enter to save · Esc to cancel</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--brown-700, #683D1B)",
                color: "#FFFFFF",
                padding: "12px 16px",
                borderRadius: "16px 16px 4px 16px",
                boxShadow: "inset 0px -2px 1.1px rgba(0,0,0,0.25)",
                maxWidth: 566,
                fontSize: 16,
                lineHeight: "22px",
                fontFamily: "var(--font-body)",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.content}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
              {message.attachments.map((att) => (
                <span
                  key={att.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    backgroundColor: "var(--neutral-50)",
                    border: "1px solid var(--neutral-200)",
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    color: "var(--neutral-600)",
                  }}
                >
                  📎 {att.file_name}
                </span>
              ))}
            </div>
          )}

          {/* User action buttons on hover */}
          {isHovered && !isEditing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.14 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 24,
                paddingRight: 2,
              }}
            >
              {onRegenerate && (
                <ActionIconButton
                  icon={<RetryIcon size={16} color="#B6ACA4" />}
                  label="Retry"
                  onClick={onRegenerate}
                />
              )}
              {onEdit && (
                <ActionIconButton
                  icon={<EditIcon size={16} color="#B6ACA4" />}
                  label="Edit"
                  onClick={() => { setEditValue(message.content); setIsEditing(true); }}
                />
              )}
              <ActionIconButton
                icon={copied ? <CheckIcon size={16} color="#80B707" /> : <CopyIcon size={16} color="#B6ACA4" />}
                label={copied ? "Copied" : "Copy"}
                onClick={handleCopy}
              />
            </motion.div>
          )}
        </div>
      ) : (
        /* ── Assistant message: left-aligned, no bubble ── */
        <div style={{ width: "100%", minWidth: 0 }}>

        {/* Assistant role label when no thinking/reasoning present */}
        {!hasThinking && !message.isLoading && !(message.activities && message.activities.length > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--neutral-600, #524B47)",
              }}
            >
              {(message.modelName || "souvenir").toLowerCase()}
            </span>
          </div>
        )}

        {/* Assistant model label when activities exist but no thinking */}
        {!hasThinking && message.activities && message.activities.length > 0 && (
          <StandaloneActivitiesBlock
            modelName={message.modelName || message.model}
            activities={message.activities}
          />
        )}

        {/* Loading state — shows shimmer label */}
        {message.isLoading && !message.content && !message.thinking && !(message.activities && message.activities.length > 0) && (
          <div style={{ margin: "4px 0 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20 }}>
              <span
                className="kaya-label-shimmer"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: "18px",
                }}
              >
                Thinking…
              </span>
            </div>
          </div>
        )}

        {/* Reasoning block */}
        {hasThinking && (
          <ReasoningBlock
            thinkingContent={message.thinking!}
            isNewMessage={isNewMessage}
            isThinkingInProgress={message.isThinkingInProgress}
            modelName={message.modelName || message.model}
            activities={message.activities}
          />
        )}

        {/* Message content — assistant only (user handled above) */}
        {message.content && (
          <div ref={contentRef}>
            <MarkdownRenderer content={message.content} />
            <StreamingCursor isVisible={!!isNewMessage && !!message.isLoading} />
          </div>
        )}

        {/* Generated images */}
        {message.images && message.images.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {message.images.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                style={{
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid var(--neutral-200)",
                  maxWidth: "320px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt="Generated image"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    maxHeight: "300px",
                    objectFit: "cover",
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Generated files */}
        {message.generatedFiles && message.generatedFiles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginTop: "10px",
            }}
          >
            {message.generatedFiles.map((file, i) => (
              <motion.a
                key={i}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.06 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--neutral-50)",
                  border: "1px solid var(--neutral-200)",
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  color: "var(--neutral-700)",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "background-color 150ms",
                  width: "fit-content",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6" />
                  <path d="M9 15l3 3 3-3" />
                </svg>
                <span style={{ fontWeight: 500 }}>{file.filename}</span>
                {file.mimeType && (
                  <span style={{ fontSize: "11px", color: "var(--neutral-400)" }}>
                    {file.mimeType.split("/").pop()?.toUpperCase()}
                  </span>
                )}
              </motion.a>
            ))}
          </div>
        )}

        {/* Stopped indicator */}
        {message.stoppedByUser && (
          <span
            style={{
              display: "inline-block",
              marginTop: "8px",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--neutral-500)",
              fontStyle: "italic",
            }}
          >
            Generation stopped
          </span>
        )}

        {/* Action buttons (on hover) — assistant only */}
        {isHovered && !message.isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: "flex",
              gap: 2,
              marginTop: 4,
            }}
          >
            <ActionIconButton
              icon={<BookmarkIcon size={18} color={pinned ? "#683D1B" : "#A09890"} />}
              label={pinned ? "Unpin" : "Pin"}
              onClick={handlePin}
              activeBackground={pinned ? "rgba(104,61,27,0.1)" : undefined}
            />
            <ActionIconButton
              icon={copied ? <CheckIcon size={18} color="#80B707" /> : <CopyIcon size={18} color="#A09890" />}
              label={copied ? "Copied" : "Copy"}
              onClick={handleCopy}
            />
            <ActionIconButton
              icon={<ThumbsUpIcon size={18} color="#A09890" />}
              label="Like"
              onClick={() => {/* wired later */}}
            />
            <ActionIconButton
              icon={<ThumbsDownIcon size={18} color="#A09890" />}
              label="Dislike"
              onClick={() => {/* wired later */}}
            />
            {isLast && onRegenerate && (
              <ActionIconButton
                icon={<RetryIcon size={18} color="#A09890" />}
                label="Retry"
                onClick={onRegenerate}
              />
            )}
          </motion.div>
        )}
        </div>
      )}
    </motion.div>
  );
}

function ActionIconButton({
  icon,
  label,
  onClick,
  activeBackground,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  activeBackground?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        padding: 6,
        borderRadius: 7,
        border: "none",
        background: activeBackground
          ? activeBackground
          : hovered
            ? "rgba(59,54,50,0.08)"
            : "transparent",
        cursor: "pointer",
        transition: "background 120ms",
      }}
    >
      {icon}
    </button>
  );
}
