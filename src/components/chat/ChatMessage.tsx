"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ReasoningBlock } from "./ReasoningBlock";
import { ActivitiesSection } from "./ActivityRow";
import { StreamingCursor } from "./StreamingCursor";
import { BlockSequenceRenderer, SourceList } from "./ResponseBlocks";
import { ContentRenderer } from "@/lib/content-renderer";
import { usePinboard } from "@/context/pinboard-context";
import { useHighlight } from "@/context/highlight-context";
import { SelectionPopover } from "@/components/SelectionPopover";
import type { UIMessage, ActivityItem, WebCitation } from "@/hooks/use-chat-state";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { MessageBubble } from "@/components/MessageBubble";
import {
  PinIcon,
  CopyOneIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RedoIcon,
  TickTwoIcon,
} from "@strange-huge/icons";

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

// ── StreamingTextContent — renders live content as inline text with BreathingDot ──
// Used only while isLoading=true so paragraphs don't "snap in" as markdown blocks.
// Structured blocks (<table>, <chart>) are rendered as real components even
// during streaming; only the markdown prose uses the inline inline renderTextBlock path.

function StreamingTextContent({ content, citations }: { content: string; citations?: WebCitation[] }) {
  const dot = (
    <motion.span
      animate={{ opacity: [0.15, 1, 0.15] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#826B60", verticalAlign: "middle", marginLeft: 4 }}
    />
  );
  return <ContentRenderer content={content} webCitations={citations} isStreaming cursor={dot} />;
}

// ── Main ChatMessage Component ────────────────────────────────────────────────

interface ChatMessageProps {
  message: UIMessage;
  isLast: boolean;
  isNewMessage?: boolean;
  chatId?: string;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onCitationsClick?: () => void;
  onFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
}

export function ChatMessage({
  message,
  isLast,
  isNewMessage = false,
  chatId,
  onRegenerate,
  onEdit,
  onFollowUp,
  onRetry,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<DOMRect | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { addPin, removePinByMessage, isPinned, open: openPinboard } = usePinboard();
  const { addHighlight, open: openHighlightPanel, highlights } = useHighlight();

  const messageHighlights = useMemo(
    () => highlights
      .filter(h => h.messageId === message.id)
      .map(h => ({
        id:         h.id,
        text:       h.text,
        colorIndex: (highlights.indexOf(h) % 4) as 0 | 1 | 2 | 3,
      })),
    [highlights, message.id],
  )

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasThinking = Boolean(message.thinking);
  const pinned = isAssistant ? isPinned(message.id) : false;

  // ── Text selection → SelectionPopover (assistant messages only) ──────────
  useEffect(() => {
    if (!isAssistant) return

    const handleMouseUp = () => {
      requestAnimationFrame(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!contentRef.current?.contains(range.commonAncestorContainer)) return
        const rect = range.getBoundingClientRect()
        if (!rect.width) return
        setSelectionAnchor(rect)
        setSelectionOpen(true)
      })
    }

    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setSelectionOpen(false)
        setSelectionAnchor(null)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [isAssistant])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
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
      chatId,
    });
    openPinboard();
  };

  const handleHighlight = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text) return
    addHighlight({ text, messageId: message.id, chatId })
    openHighlightPanel()
    sel?.removeAllRanges()
    setSelectionOpen(false)
    setSelectionAnchor(null)
  };

  const handleCopySelection = () => {
    const sel = window.getSelection()
    const text = sel?.toString()
    if (text) navigator.clipboard.writeText(text).catch(() => {})
  };

  return (
    <motion.div
      data-message-id={message.id}
      initial={isUser ? { opacity: 0, y: 10, scale: 0.97 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={isUser
        ? { type: "spring", stiffness: 380, damping: 28 }
        : { duration: 0.4, ease: [0.2, 0, 0, 1] }
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
          {/* File attachment chips — appear above the message bubble */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
              {message.attachments.map((att) => {
                const ext = att.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
                const isImage = att.file_type.startsWith("image/");
                return (
                  <div
                    key={att.id}
                    style={{
                      display:         "inline-flex",
                      alignItems:      "center",
                      gap:             "5px",
                      padding:         "4px 8px",
                      borderRadius:    "8px",
                      backgroundColor: "rgba(59,54,50,0.07)",
                      border:          "1px solid rgba(59,54,50,0.10)",
                      maxWidth:        "220px",
                    }}
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="var(--neutral-500)" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      {isImage ? (
                        <>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </>
                      ) : (
                        <>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </>
                      )}
                    </svg>
                    <span
                      style={{
                        fontFamily:   "var(--font-body)",
                        fontSize:     "11px",
                        fontWeight:   500,
                        color:        "var(--neutral-700)",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace:   "nowrap",
                      }}
                    >
                      {att.file_name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize:   "10px",
                        color:      "var(--neutral-400)",
                        flexShrink: 0,
                      }}
                    >
                      {ext}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <MessageBubble
            role="user"
            content={message.content}
            onRetry={onRegenerate}
            onEditSave={onEdit ? (newContent) => onEdit(message.id, newContent) : undefined}
            maxWidth="100%"
          />
        </div>
      ) : (
        /* ── Assistant message: left-aligned, no bubble ── */
        <div style={{ width: "100%", minWidth: 0 }}>

        {/* Assistant role label when no thinking/reasoning present */}
        {!hasThinking && !(message.activities && message.activities.length > 0) && (message.modelName || !message.isLoading) && (
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
              {(message.modelName || message.model_name || message.model || "souvenir").toLowerCase()}
            </span>
          </div>
        )}

        {/* Assistant model label when activities exist but no thinking */}
        {!hasThinking && message.activities && message.activities.length > 0 && (
          <StandaloneActivitiesBlock
            modelName={message.modelName || message.model_name || message.model}
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
            modelName={message.modelName || message.model_name || message.model}
            modelMeta={message.modelMeta}
            activities={message.activities}
            reasoningSections={message.reasoning_sections}
          />
        )}

        {/* Message content — assistant only (user handled above) */}
        {/* When responseBlocks are present, use BlockSequenceRenderer */}
        {message.responseBlocks && message.responseBlocks.length > 0 ? (
          <motion.div
            ref={contentRef}
            initial={isNewMessage ? { opacity: 0, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <BlockSequenceRenderer
              blocks={message.responseBlocks}
              static={!message.isLoading}
              onFollowUp={onFollowUp}
              onRetry={onRetry}
            />
          </motion.div>
        ) : message.content ? (
          <motion.div
            ref={contentRef}
            initial={isNewMessage ? { opacity: 0, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* During active streaming on a new message: use renderTextBlock so
                content renders inline with a trailing BreathingDot rather than
                as block-level markdown (which "snaps" whole paragraphs in).
                For completed messages: MarkdownRenderer handles GFM tables etc. */}
            {isNewMessage && message.isLoading
              ? <StreamingTextContent content={message.content} citations={message.webCitations} />
              : <ContentRenderer content={message.content} webCitations={message.webCitations} highlights={messageHighlights} />}
            {!(isNewMessage && message.isLoading) && (
              <StreamingCursor isVisible={false} />
            )}
          </motion.div>
        ) : null}

        {/* Citation sources — shown below response when citations are present */}
        {message.webCitations && message.webCitations.length > 0 && !message.isLoading && (
          <SourceList citations={message.webCitations} />
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
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {message.generatedFiles.map((file, i) => {
              // ── Derive file type label + badge colour ──────────────────────
              const ext = (() => {
                if (file.mimeType) {
                  const sub = file.mimeType.split("/").pop() ?? ""
                  if (sub.includes("pdf")) return "PDF"
                  if (sub.includes("wordprocessingml") || sub.includes("msword")) return "DOCX"
                  if (sub.includes("spreadsheetml") || sub.includes("excel")) return "XLSX"
                  if (sub.includes("presentationml") || sub.includes("powerpoint")) return "PPTX"
                  if (sub.includes("csv")) return "CSV"
                  if (sub.includes("markdown") || sub.includes("md")) return "MD"
                  return sub.toUpperCase().slice(0, 5) || "FILE"
                }
                const fromName = (file.filename.split(".").pop() ?? "").toUpperCase()
                return fromName.slice(0, 5) || "FILE"
              })()

              const badgeColor = (() => {
                switch (ext) {
                  case "PDF":  return "#E53E3E"
                  case "DOCX": case "DOC": return "#3182CE"
                  case "XLSX": case "XLS": return "#38A169"
                  case "CSV":  return "#2F855A"
                  case "PPTX": case "PPT": return "#DD6B20"
                  case "MD":   return "#805AD5"
                  default:     return "#6A625D"
                }
              })()

              // Download URL goes through our proxy so the browser always saves
              // the file (avoids CORS + Content-Disposition issues from S3)
              const downloadHref = `/api/download?url=${encodeURIComponent(file.url)}&filename=${encodeURIComponent(file.filename)}`

              return (
                <motion.div
                  key={`${file.url}-${i}`}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 360,
                    damping: 26,
                    delay: i * 0.07,
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px 8px 8px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(59,54,50,0.05)",
                    border: "1px solid rgba(59,54,50,0.10)",
                    width: "fit-content",
                    maxWidth: "420px",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Coloured type badge */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      backgroundColor: badgeColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: "white",
                        letterSpacing: "0.4px",
                        lineHeight: 1,
                      }}
                    >
                      {ext}
                    </span>
                  </div>

                  {/* Filename */}
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#524B47",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {file.filename}
                  </span>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {/* View — opens file in new tab (browsers show PDF inline, download DOCX/XLSX etc.) */}
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transition: "background-color 120ms",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(59,54,50,0.10)"
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent"
                      }}
                    >
                      {/* External link icon */}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M10 2h4v4M14 2 8 8M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"
                          stroke="#9A9089"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>

                    {/* Download — proxied through /api/download so browser always saves */}
                    <a
                      href={downloadHref}
                      download={file.filename}
                      title="Download"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transition: "background-color 120ms",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(59,54,50,0.10)"
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent"
                      }}
                    >
                      {/* Download arrow icon */}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M8 2v8m0 0L5.5 7.5M8 10l2.5-2.5M2 13h12"
                          stroke="#9A9089"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </div>
                </motion.div>
              )
            })}
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
        <AnimatePresence>
          {isHovered && !message.isLoading && (
          <motion.div
            key="action-buttons"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.15 }}
            style={{
              display: "flex",
              gap: 2,
              marginTop: 4,
            }}
          >
            <ActionIconButton
              icon={<PinIcon size={18} color={pinned ? "var(--brown-700, #683D1B)" : "var(--neutral-400)"} />}
              label={pinned ? "Unpin" : "Pin"}
              onClick={handlePin}
            />
            <ActionIconButton
              icon={copied ? <TickTwoIcon size={18} color="var(--success-600, #80B707)" /> : <CopyOneIcon size={18} color="var(--neutral-400)" />}
              label={copied ? "Copied" : "Copy"}
              onClick={handleCopy}
            />
            <ActionIconButton
              icon={<ThumbsUpIcon size={18} color="var(--neutral-400)" />}
              label="Like"
              onClick={() => {/* wired later */}}
            />
            <ActionIconButton
              icon={<ThumbsDownIcon size={18} color="var(--neutral-400)" />}
              label="Dislike"
              onClick={() => {/* wired later */}}
            />
            {isLast && onRegenerate && (
              <ActionIconButton
                icon={<RedoIcon size={18} color="var(--neutral-400)" />}
                label="Regenerate"
                onClick={onRegenerate}
              />
            )}
          </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}

      {/* ── Text-selection toolbar (assistant messages only) ── */}
      {isAssistant && (
        <SelectionPopover
          open={selectionOpen}
          anchorRect={selectionAnchor}
          onHighlight={handleHighlight}
          onCopy={handleCopySelection}
        />
      )}
    </motion.div>
  );
}

function ActionIconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} side="top" sideOffset={6} delayDuration={400}>
      <IconButton
        variant="ghost-2"
        size="xs"
        icon={icon}
        aria-label={label}
        onClick={onClick}
      />
    </Tooltip>
  );
}
