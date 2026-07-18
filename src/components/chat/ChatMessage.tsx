"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { ReasoningBlock, ModelLogo, AnimatedLogo } from "./ReasoningBlock";
import { BreathingDot } from "@/components/BreathingDot";
import { ActivitiesSection } from "./ActivityRow";
import { StreamingCursor } from "./StreamingCursor";
import { BlockSequenceRenderer, SourceList } from "./ResponseBlocks";
import { ConnectPromptCard } from "./ConnectorPrompts";
import { PermissionPromptCard } from "@/components/shared/PermissionPromptCard";
import { ContentRenderer } from "@/lib/content-renderer";
import { applyRenderedHighlights, clearRenderedHighlights, getRenderedSelectionRange } from "@/lib/rendered-highlights";
import { usePinboardActions } from "@/context/pinboard-context";
import { useHighlight } from "@/context/highlight-context";
import { trackBrowserEvent, trackFeature } from "@/lib/analytics/events";
import { SelectionPopover } from "@/components/SelectionPopover";
import type { UIMessage, ActivityItem, WebCitation, ModelSelectedMeta } from "@/hooks/use-chat-state";
import { respondToChatPrompt } from "@/lib/api/chat";
import { IconButton } from "@/components/IconButton";
import { Tooltip } from "@/components/Tooltip";
import { MessageBubble } from "@/components/MessageBubble";
import {
  PinIcon,
  CopyOneIcon,
  RedoIcon,
  TickTwoIcon,
  ImageDownloadTwoIcon,
  AlertCircleIcon,
} from "@strange-huge/icons";

// ── Generated Image Card with download button ──────────────────────────────────

function GeneratedImageCard({ img, index }: { img: { url: string; s3Key?: string }; index: number }) {
  const [hovered, setHovered] = useState(false);

  function handleDownload() {
    const filename = img.s3Key
      ? img.s3Key.split("/").pop() ?? "image.png"
      : `image-${index + 1}.png`;
    // Route through the /api/download proxy: it streams the image server-side
    // with Content-Disposition: attachment, so the browser always saves it.
    // A direct client fetch would fail CORS on presigned S3 URLs and fall back
    // to opening a blank tab.
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(img.url)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <m.div
      key={img.url}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid var(--neutral-200)",
        maxWidth: "320px",
      }}
    >
      <Image
        src={img.url}
        alt="Generated image"
        width={0}
        height={0}
        sizes="100%"
        unoptimized
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: "300px",
          objectFit: "cover",
        }}
      />
      <AnimatePresence>
        {hovered && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
            }}
          >
            <Tooltip content="Download image">
              <IconButton
                onClick={handleDownload}
                aria-label="Download image"
                icon={<ImageDownloadTwoIcon size={16} animated />}
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(4px)",
                  borderRadius: "8px",
                  color: "#fff",
                  border: "none",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />
            </Tooltip>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

// ── Standalone Activities Block (collapsible, used when no reasoning) ─────────

function StandaloneActivitiesBlock({
  modelName,
  modelMeta,
  activities,
}: {
  modelName?: string;
  modelMeta?: ModelSelectedMeta;
  activities: ActivityItem[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const displayName = (() => {
    const complexity = modelMeta?.complexity
    if (complexity === 'basic') return 'Souvenir Muse (Basic)'
    if (complexity === 'advanced') return 'Souvenir Muse (Advanced)'
    const raw = modelMeta?.modelName ?? modelName
    if (!raw) return null
    const l = raw.toLowerCase()
    if (l === 'muse') return 'Souvenir Muse'
    if (l === 'souvenir' || l.startsWith('souvenir')) return null
    return raw
  })()

  // Derive summary for collapsed state
  const doneCount = activities.filter((a) => a.status === "done").length;
  const allDone = doneCount === activities.length;
  const summaryText = allDone
    ? `${activities.length} ${activities.length === 1 ? "action" : "actions"} completed`
    : `${doneCount}/${activities.length} actions`;

  return (
    <div style={{ margin: "4px 0 8px" }}>
      {/* Header row - logo + model name + summary + chevron */}
      <div draggable={false} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" }}>
        <ModelLogo modelMeta={modelMeta} modelName={modelName} size={16} />
        {displayName && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--neutral-600, #524B47)",
              flexShrink: 0,
            }}
          >
            {displayName}
          </span>
        )}
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
          <m.svg
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
          </m.svg>
        </button>
      </div>

      {/* Collapsible activities panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
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
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── StreamingTextContent - renders live content with BreathingDot cursor ──────
// Uses full MarkdownRenderer (same as completed messages) for consistent
// formatting quality during streaming — code blocks, math, GFM tables all
// render properly while the stream is active.

function StreamingTextContent({ content, citations }: { content: string; citations?: WebCitation[] }) {
  const dot = (
    <m.span
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
  showReasoning?: boolean;
  /** Pre-computed pin status for this message — avoids context subscription churn */
  pinned?: boolean;
  /** When true, hides the Pin/Unpin action button from the hover actions bar. */
  hidePinAction?: boolean;
  /** When true, disables text selection highlighting (SelectionPopover + highlight marks). */
  disableHighlight?: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onCitationsClick?: () => void;
  onFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  /** Records a permission-prompt answer in the owning messages state so the
   *  card stays hidden across remounts (message-id swap, virtualizer). */
  onPromptDecided?: (messageId: string, requestId: string, decision: string) => void;
}

export function ChatMessage({
  message,
  isLast,
  isNewMessage = false,
  chatId,
  showReasoning = true,
  pinned: pinnedProp = false,
  hidePinAction = false,
  disableHighlight = false,
  onRegenerate,
  onEdit,
  onFollowUp,
  onRetry,
  onPromptDecided,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<DOMRect | null>(null);
  const [justModelSelected, setJustModelSelected] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevModelKeyRef = useRef<string | undefined>(undefined);
  const { addPin, removePinByMessage, open: openPinboard, close: closePinboard } = usePinboardActions();
  const { addHighlight, open: openHighlightPanel, close: closeHighlightPanel, highlights } = useHighlight();

  const messageHighlights = useMemo(
    () => highlights
      // Include highlights that belong to this message, OR highlights whose
      // messageId is missing/null (e.g. created before the API sent message_id).
      // For the latter case the rehype plugin's text-search naturally limits
      // the mark to whichever message actually contains the selected text.
      .flatMap(h => (h.messageId === message.id || !h.messageId)
        ? [{ id: h.id, text: h.text, colorIndex: h.colorIndex, startOffset: h.startOffset, endOffset: h.endOffset }]
        : []),
    [highlights, message.id],
  )

  // Stable reference so BlockSequenceRenderer (React.memo) doesn't re-render
  // on every text token during streaming — only recomputes when responseBlocks changes.
  const structuralBlocks = useMemo(
    () => (message.responseBlocks ?? []).filter(b => b.kind !== 'text'),
    [message.responseBlocks],
  )

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasThinking = Boolean(message.thinking);
  const pinned = isAssistant && pinnedProp;

  // Resolve the actual model display name — never expose "souvenir" as a routing label.
  const modelDisplayName = (() => {
    const complexity = message.modelMeta?.complexity
    if (complexity === 'basic') return 'Souvenir Muse (Basic)'
    if (complexity === 'advanced') return 'Souvenir Muse (Advanced)'
    const raw = message.modelMeta?.modelName ?? message.modelName ?? message.model_name ?? message.model
    if (!raw) return null
    const l = raw.toLowerCase()
    if (l === 'muse') return 'Souvenir Muse'
    if (l === 'souvenir' || l.startsWith('souvenir')) return null
    return raw
  })()

  // Trigger glow burst on the logo the instant model_selected fires (streaming only).
  const currentModelKey = message.modelMeta?.modelName || message.modelName || message.model_name || message.model
  useEffect(() => {
    if (!isNewMessage) return
    if (currentModelKey && currentModelKey !== prevModelKeyRef.current) {
      prevModelKeyRef.current = currentModelKey
      setJustModelSelected(true)
      const t = setTimeout(() => setJustModelSelected(false), 1200)
      return () => clearTimeout(t)
    }
  }, [currentModelKey, isNewMessage])

  // ── Text selection → SelectionPopover (assistant messages only) ──────────
  useEffect(() => {
    if (!isAssistant || disableHighlight) return

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
  }, [disableHighlight, isAssistant])

  useEffect(() => {
    if (!isAssistant || disableHighlight) return
    const root = contentRef.current
    if (!root) return

    let frame: number | null = null
    const observer = new MutationObserver(() => scheduleApply())

    const apply = () => {
      frame = null
      observer.disconnect()
      if (messageHighlights.length) {
        applyRenderedHighlights(root, messageHighlights)
      } else {
        clearRenderedHighlights(root)
      }
      observer.observe(root, { childList: true, characterData: true, subtree: true })
    }

    const scheduleApply = () => {
      if (frame != null) return
      frame = requestAnimationFrame(apply)
    }

    scheduleApply()
    observer.observe(root, { childList: true, characterData: true, subtree: true })

    return () => {
      if (frame != null) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [disableHighlight, isAssistant, messageHighlights])

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

    // Extract tag labels from any `tags` ResponseBlock delivered via structured_block SSE events.
    const tagsFromBlocks = (message.responseBlocks ?? [])
      .flatMap((b) => b.kind === "tags" ? b.data.tags.map((t) => t.label) : []);

    addPin({
      content: message.content,
      title,
      category: "Quote",
      messageId: message.id,
      modelName: message.modelName || message.model,
      chatId,
      ...(tagsFromBlocks.length > 0 ? { tags: tagsFromBlocks } : {}),
    });
    trackBrowserEvent("pin_created", { source: "chat" });
    closeHighlightPanel();
    openPinboard();
  };

  const handleHighlight = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    if (!contentRef.current) return

    const selectionRange = getRenderedSelectionRange(contentRef.current, sel)
    if (!selectionRange) return

    const { selectedText: text, startOffset, endOffset } = selectionRange

    addHighlight({ text, messageId: message.id, startOffset, endOffset, chatId })
    trackBrowserEvent("highlight_created", { source: "chat" })
    closePinboard()
    openHighlightPanel()
    sel.removeAllRanges()
    setSelectionOpen(false)
    setSelectionAnchor(null)
  };

  const handleCopySelection = () => {
    const sel = window.getSelection()
    const text = sel?.toString()
    if (text) navigator.clipboard.writeText(text).catch(() => {})
  };

  return (
    <m.div
      data-message-id={message.id}
      role="article"
      aria-label={isUser ? "Your message" : "Assistant response"}
      aria-busy={!isUser && message.isLoading ? true : undefined}
      initial={isNewMessage
        ? (isUser ? { opacity: 0, y: 10, scale: 0.97 } : { opacity: 0, y: 10 })
        : false}
      animate={isUser ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
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
    >
      {isUser ? (
        /* ── User message: right-aligned bubble ── */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: "85%" }}>
          {/* Pin attachment chips - appear above file chips and bubble */}
          {message.mentionedPins && message.mentionedPins.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
              {message.mentionedPins.map((pin) => (
                <div
                  key={pin.id}
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
                  {/* Pin icon */}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24"
                    fill="none" stroke="var(--neutral-500)" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <span
                    style={{
                      fontFamily:   "var(--font-body)",
                      fontSize:     "12px",
                      fontWeight:   500,
                      color:        "var(--neutral-700)",
                      overflow:     "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace:   "nowrap",
                    }}
                  >
                    @{pin.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* File attachment chips - appear above the message bubble */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
              {message.attachments.map((att) => {
                const ext = att.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
                const isImage = att.file_type.startsWith("image/");
                const chip = (
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
                        fontSize: "12px",
                        fontWeight:   500,
                        color:        "var(--neutral-700)",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace:   "nowrap",
                      }}
                    >
                      {att.file_name}
                    </span>
                    {att.uploading ? (
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "12px",
                          color:      "var(--neutral-400)",
                          flexShrink: 0,
                        }}
                      >
                        {att.uploadProgress !== undefined && att.uploadProgress < 100
                          ? `${att.uploadProgress}%`
                          : "Uploading…"}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "12px",
                          color:      "var(--neutral-400)",
                          flexShrink: 0,
                        }}
                      >
                        {ext}
                      </span>
                    )}
                  </div>
                );
                return att.url && !att.uploading ? (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", flexShrink: 0 }}
                  >
                    {chip}
                  </a>
                ) : (
                  <React.Fragment key={att.id}>{chip}</React.Fragment>
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
        <AnimatePresence initial={false}>
          {!hasThinking && !(message.activities && message.activities.length > 0) && (message.modelName || !message.isLoading) && (
            <m.div
              key="model-header"
              initial={{ opacity: 0, y: -4, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "none" }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              draggable={false}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "4px",
                userSelect: "none",
              }}
            >
              <AnimatedLogo
                modelMeta={message.modelMeta}
                modelName={message.modelName || message.model_name || message.model}
                isThinkingInProgress={false}
                justSelected={justModelSelected}
              />
              <AnimatePresence mode="popLayout" initial={false}>
                {modelDisplayName && (
                  <m.span
                    key={modelDisplayName}
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "none" }}
                    transition={{ type: "spring", stiffness: 520, damping: 32 }}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--neutral-600, #524B47)",
                    }}
                  >
                    {modelDisplayName}
                  </m.span>
                )}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>

        {/* Assistant model label when activities exist but no thinking */}
        {!hasThinking && message.activities && message.activities.length > 0 && (
          <StandaloneActivitiesBlock
            modelName={message.modelName || message.model_name || message.model}
            modelMeta={message.modelMeta}
            activities={message.activities}
          />
        )}

        {/* Loading state - shows shimmer label only before model identity is known.
            Once model_selected fires (modelMeta / modelName set), AssistantRoleLabel above takes over. */}
        {message.isLoading && !message.content && !message.thinking && !(message.activities && message.activities.length > 0) &&
         !message.modelMeta && !(message.modelName || message.model_name || message.model) && (
          <div style={{ margin: "4px 0 8px" }}>
            <div draggable={false} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 20, userSelect: "none" }}>
              <ModelLogo modelMeta={message.modelMeta} modelName={message.modelName || message.model_name || message.model} size={16} />
              <span
                className="kaya-label-shimmer"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: "18px",
                }}
              >
                {modelDisplayName ?? "Souvenir"}
              </span>
            </div>
          </div>
        )}

        {/* Waiting indicator — shown while loading before any content or thinking arrives */}
        {message.isLoading && !message.content && !message.thinking && !(message.activities && message.activities.length > 0) && (
          <BreathingDot size="md" style={{ marginLeft: 4, marginTop: 2, backgroundColor: "var(--neutral-400)" }} />
        )}

        {/* Reasoning block — shown when adaptive thinking is enabled */}
        {hasThinking && showReasoning && (
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

        {/* Error state - distinct from a normal assistant reply so a friendly
            error message never reads as if the model itself said it. */}
        {message.isError && message.content ? (
          <div
            style={{
              display:         "flex",
              alignItems:      "flex-start",
              gap:             8,
              padding:         "10px 12px",
              backgroundColor: "var(--color-tag-Red-bg)",
              borderRadius:    10,
            }}
          >
            <AlertCircleIcon size={16} color="var(--color-tag-Red-text)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, lineHeight: "20px", color: "var(--color-tag-Red-text)", margin: 0 }}>
              {message.content}
            </p>
          </div>
        ) : null}

        {/* Message content - assistant only (user handled above) */}
        {/* Text content always renders via ContentRenderer so that markdown
            structure, links, bold, code, math, and citation chips are handled uniformly
            regardless of whether the backend also sends a text responseBlock. */}
        {message.content && !message.isError ? (
          <m.div
            ref={contentRef}
            initial={isNewMessage ? { opacity: 0, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {isNewMessage && message.isLoading
              ? <StreamingTextContent content={message.content} citations={message.webCitations} />
              : <ContentRenderer content={message.content} webCitations={message.webCitations} />}
            {!(isNewMessage && message.isLoading) && (
              <StreamingCursor isVisible={false} />
            )}
          </m.div>
        ) : null}
        {/* Structural blocks (tables, charts, steps, follow-ups, tags, etc.) come
            from responseBlocks. Text blocks are skipped here because message.content
            already carries the full text rendered above. */}
        {structuralBlocks.length > 0 ? (
          <BlockSequenceRenderer
            blocks={structuralBlocks}
            static={!message.isLoading}
            onFollowUp={onFollowUp}
            onRetry={onRetry}
            webCitations={message.webCitations}
          />
        ) : null}

        {/* Citation sources - shown below response when citations are present */}
        {message.webCitations && message.webCitations.length > 0 && !message.isLoading && (
          <SourceList citations={message.webCitations} />
        )}

        {/* Connector connect prompts — inline CTA when a tool needs linking */}
        {message.connectorConnectPrompts && message.connectorConnectPrompts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {message.connectorConnectPrompts.map((prompt) => (
              <ConnectPromptCard key={prompt.request_id} prompt={prompt} />
            ))}
          </div>
        )}

        {/* Connector permission prompts — inline Allow/Block/Allow once buttons */}
        {message.connectorPermissionPrompts && message.connectorPermissionPrompts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {message.connectorPermissionPrompts.map((prompt) => (
              <PermissionPromptCard
                key={prompt.request_id}
                prompt={prompt}
                onDecided={(policy) => {
                  respondToChatPrompt(prompt.request_id, policy, prompt.respond_url).catch(() => {})
                  onPromptDecided?.(message.id, prompt.request_id, policy)
                }}
              />
            ))}
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
              <GeneratedImageCard key={img.url} img={img} index={i} />
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
                <m.div key={`${file.url}-${i}`}
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
                        fontSize: 12,
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
                    {/* View - opens file in new tab (browsers show PDF inline, download DOCX/XLSX etc.) */}
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

                    {/* Download - proxied through /api/download so browser always saves */}
                    <a
                      href={downloadHref}
                      download={file.filename}
                      title="Download"
                      onClick={() => trackFeature("document_download", { file_ext: file.filename?.split(".").pop()?.toLowerCase() })}
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
                </m.div>
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

        {/* Action buttons - always visible; gated only by loading state */}
        <m.div
          animate={{ opacity: !message.isLoading ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{
            display: "flex",
            gap: 2,
            marginTop: 4,
            pointerEvents: !message.isLoading ? "auto" : "none",
          }}
        >
          {!hidePinAction && (
            <ActionIconButton
              icon={<PinIcon size={18} color={pinned ? "var(--brown-700, #683D1B)" : "var(--neutral-400)"} />}
              label={pinned ? "Unpin" : "Pin"}
              onClick={handlePin}
            />
          )}
          <ActionIconButton
            icon={copied ? <TickTwoIcon size={18} color="var(--success-600, #80B707)" /> : <CopyOneIcon size={18} color="var(--neutral-400)" />}
            label={copied ? "Copied" : "Copy"}
            onClick={handleCopy}
          />
          {isLast && onRegenerate && (
            <ActionIconButton
              icon={<RedoIcon size={18} color="var(--neutral-400)" />}
              label="Regenerate"
              onClick={onRegenerate}
            />
          )}
        </m.div>
        </div>
      )}

      {/* ── Text-selection toolbar (assistant messages only) ── */}
      {isAssistant && !disableHighlight && (
        <SelectionPopover
          open={selectionOpen}
          anchorRect={selectionAnchor}
          onHighlight={handleHighlight}
          onCopy={handleCopySelection}
        />
      )}
    </m.div>
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

function areMessagePropsEqual(prev: ChatMessageProps, next: ChatMessageProps): boolean {
  return (
    prev.message === next.message &&
    prev.isLast === next.isLast &&
    prev.isNewMessage === next.isNewMessage &&
    prev.chatId === next.chatId &&
    prev.showReasoning === next.showReasoning &&
    prev.pinned === next.pinned &&
    prev.hidePinAction === next.hidePinAction &&
    // onEdit is a stable ref-backed callback (same identity for the component's
    // lifetime), so we only check null-ness to gate assistant regen button.
    (prev.onEdit == null) === (next.onEdit == null) &&
    // Re-render when regen availability flips (streaming starts/ends).
    (prev.onRegenerate == null) === (next.onRegenerate == null)
  )
}

export const ChatMessageMemo = React.memo(ChatMessage, areMessagePropsEqual)
