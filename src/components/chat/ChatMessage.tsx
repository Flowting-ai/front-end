"use client";

import { LibraryCitationsProvider } from "@/components/Library/chat/library-citations";
import { messageCopyText } from "@/lib/copy-text";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ReasoningBlock } from "./ReasoningBlock";
import { BreathingDot } from "@/components/BreathingDot";
import { BlockSequenceRenderer } from "./ResponseBlocks";
import { SourceList } from "./CitationChip";
import { ImageGenerationPreview, findPendingImageGeneration } from "./ImageGenerationPreview";
import { deriveCitationsFromSources } from "@/lib/citations";
import { PINS_ENABLED, HIGHLIGHTS_ENABLED } from "@/lib/feature-flags";
import { usePinboardActions } from "@/context/pinboard-context";
import { useHighlight } from "@/context/highlight-context";
import { trackBrowserEvent } from "@/lib/analytics/events";
import { SelectionPopover } from "@/components/SelectionPopover";
import type { UIMessage } from "@/types/chat";
import { GeneratedImageCard } from "./message/GeneratedImageCard";
import { StandaloneActivitiesBlock } from "./message/StandaloneActivitiesBlock";
import { StreamingTextContent } from "./message/StreamingTextContent";
import { ErrorNotice } from "./message/ErrorNotice";
import { UserMessageBody } from "./message/UserMessageBody";
import { AssistantPrompts } from "./message/AssistantPrompts";
import { GeneratedFilesList } from "./message/GeneratedFilesList";
import { MessageActionBar } from "./message/MessageActionBar";
import { useMessageSelection } from "./message/use-message-selection";
import { useUnmountTimeouts } from "@/hooks/use-unmount-timeouts";

// The message's parts live in ./message/; this file is the row itself (state,
// effects, layout) plus the memo comparator. StreamingTextContent is
// re-exported so existing importers keep working.
export { StreamingTextContent };

// Static styles live at module level: this row re-renders on every streamed
// frame, so they shouldn't be allocated again each time.
const assistantColumnStyle: React.CSSProperties = { width: "100%", minWidth: 0 };

const waitingDotStyle: React.CSSProperties = { marginLeft: 4, marginTop: 2, backgroundColor: "var(--neutral-500)" };

const imagesRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "12px",
};

const stoppedStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: "8px",
  fontFamily: "var(--font-body)",
  fontSize: "12px",
  color: "var(--neutral-500)",
  fontStyle: "italic",
};

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
  /** When true, hides the hover action bar on both user (edit/copy/retry) and
   *  assistant (pin/copy/regenerate) messages — this chat is archived and can
   *  no longer be edited or added to. */
  archived?: boolean;
  onRegenerate?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onFollowUp?: (prompt: string) => void;
  onRetry?: () => void;
  /** Records a permission-prompt answer in the owning messages state so the
   *  card stays hidden across remounts (message-id swap, virtualizer). */
  onPromptDecided?: (messageId: string, requestId: string, decision: string) => void;
  /** Continues a turn parked on a prompt whose respond_url is `/chats/{id}/resume`.
   *  The memo comparator ignores it, so pass a stable function. */
  onPromptFollowUp?: (message: string) => void;
  /** Called once per message when it has stopped loading and its text reveal
   *  has finished (straight away for a message that isn't animated). The memo
   *  comparator only tracks whether it is set, so pass a stable function. */
  onRevealSettled?: (messageId: string) => void;
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
  archived = false,
  onRegenerate,
  onEdit,
  onFollowUp,
  onRetry,
  onPromptDecided,
  onPromptFollowUp,
  onRevealSettled,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  // The "Copied" reset is cleared if the row unmounts first.
  const later = useUnmountTimeouts();
  const contentRef = useRef<HTMLDivElement>(null);
  const { addPin, removePinByMessage, open: openPinboard, close: closePinboard } = usePinboardActions();
  const { addHighlight, open: openHighlightPanel, close: closeHighlightPanel, highlights } = useHighlight();

  // Stable reference so BlockSequenceRenderer (React.memo) doesn't re-render
  // on every text token during streaming — only recomputes when responseBlocks changes.
  const structuralBlocks = useMemo(
    () => (message.responseBlocks ?? []).filter(b => b.kind !== 'text'),
    [message.responseBlocks],
  )

  // While streaming, a freshly generated image is preloaded before it takes
  // the preview's place — otherwise the preview leaves on the URL and an empty
  // frame sits there for the second or two the download takes.
  const [loadedImageUrls, setLoadedImageUrls] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (!message.isLoading || !message.images) return
    for (const { url } of message.images) {
      if (loadedImageUrls.has(url)) continue
      const probe = new window.Image()
      probe.onload = probe.onerror = () => setLoadedImageUrls((prev) => new Set(prev).add(url))
      probe.src = url
    }
  }, [message.isLoading, message.images, loadedImageUrls])
  const visibleImages = useMemo(
    () => (message.isLoading ? message.images?.filter((img) => loadedImageUrls.has(img.url)) : message.images),
    [message.isLoading, message.images, loadedImageUrls],
  )

  const imageGenActivity = useMemo(
    () => (message.isLoading ? findPendingImageGeneration(message.activities, visibleImages?.length ?? 0) : undefined),
    [message.isLoading, message.activities, visibleImages?.length],
  )

  // Question-card decisions by prompt id, for the reasoning trace's markers.
  const promptDecisions = useMemo(
    () => Object.fromEntries(
      (message.chatPrompts ?? []).flatMap((prompt) => prompt.decision ? [[prompt.request_id, prompt.decision]] : []),
    ) as Record<string, string>,
    [message.chatPrompts],
  )

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasThinking = Boolean(message.thinking || message.reasoning_sections?.length);
  // Whether ReasoningBlock actually renders below. The model-header and
  // StandaloneActivitiesBlock blocks key off `!showReasoningBlock` (not
  // `!hasThinking`) so exactly one of the three always renders — a message
  // with thinking data doesn't go attribution-less just because adaptive
  // thinking is currently toggled off.
  const showReasoningBlock = hasThinking && showReasoning;
  const canUseContentActions = Boolean(message.content.trim()) && !message.isError;
  const pinned = isAssistant && pinnedProp;

  // The model ends a web-sourced answer with its own "Sources:" block. Parsed,
  // it backs the [N] chips and gives way to the SourceList below; citations
  // the backend sends itself still win.
  const sourcesBlock = useMemo(
    () => isAssistant && !message.isError
      ? deriveCitationsFromSources(message.content, { streaming: Boolean(message.isLoading) })
      : null,
    [isAssistant, message.isError, message.content, message.isLoading],
  );
  const answerText = sourcesBlock?.contentWithoutSourcesBlock ?? message.content;
  const citations = message.webCitations?.length
    ? message.webCitations
    : sourcesBlock?.citations.length ? sourcesBlock.citations : undefined;

  // Whether the answer text reveals progressively. Decided while the message
  // is still empty so it can't flip part-way through a reveal.
  const reduceMotion = useReducedMotion() ?? false;
  const [revealsText, setRevealsText] = useState(isNewMessage);
  if (isNewMessage && !revealsText && !message.content) setRevealsText(true);
  const animateText = revealsText && !reduceMotion;
  // A fresh reply mounts empty and reveals from the start. A row that mounts
  // with text already there (remounted mid-stream, e.g. scrolled back into
  // view) showed that text before, so its reveal picks up from there.
  const [revealFrom] = useState(answerText);

  // The answer is complete on screen: the stream is over and the reveal has
  // caught up (or was frozen by Stop). Completion UI — actions, sources,
  // the error notice, aria-busy — waits for this rather than the stream.
  const [caughtUpText, setCaughtUpText] = useState<string | null>(null);
  const revealSettled = !message.isLoading &&
    (!animateText || Boolean(message.stoppedByUser) || !answerText || caughtUpText === answerText);

  const onRevealSettledRef = useRef(onRevealSettled);
  const revealReportedRef = useRef(false);
  const hasRevealListener = Boolean(onRevealSettled);
  useEffect(() => {
    onRevealSettledRef.current = onRevealSettled;
  });
  useEffect(() => {
    if (message.isLoading) {
      revealReportedRef.current = false;
      return;
    }
    if (!revealSettled || revealReportedRef.current || !onRevealSettledRef.current) return;
    revealReportedRef.current = true;
    onRevealSettledRef.current(message.id);
  }, [revealSettled, message.isLoading, message.id, hasRevealListener]);

  const retry = onRetry ?? onRegenerate;

  // Selection popover + highlight marks; its effects run after the ones above.
  const { selectionOpen, selectionAnchor, handleHighlight, handleCopySelection } = useMessageSelection({
    messageId: message.id,
    chatId,
    isAssistant,
    disableHighlight,
    contentRef,
    highlights,
    addHighlight,
    openHighlightPanel,
    closePinboard,
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageCopyText(message.content));
      setCopied(true);
      later(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handlePin = () => {
    if (!PINS_ENABLED) return;
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

  return (
    <m.div
      data-message-id={message.id}
      role="article"
      aria-label={isUser ? "Your message" : "Assistant response"}
      aria-busy={!isUser && !revealSettled ? true : undefined}
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
        <UserMessageBody message={message} archived={archived} onRegenerate={onRegenerate} onEdit={onEdit} />
      ) : (
        /* ── Assistant message: left-aligned, no bubble ── */
        <div style={assistantColumnStyle}>

        {/* No model name/logo row: answers no longer say which model wrote them. */}

        {/* Activities summary line — shown when there are activities but
            ReasoningBlock isn't the one rendering them (no thinking data, or
            thinking is toggled off). The model-attribution header above
            already covers logo/name, so this only renders the activities
            summary + chevron underneath it, on its own line. */}
        {!showReasoningBlock && message.activities && message.activities.length > 0 && (
          <StandaloneActivitiesBlock activities={message.activities} />
        )}

        {/* Waiting indicator — shown while loading before any content or thinking arrives */}
        {message.isLoading && !message.content && !message.thinking && !(message.activities && message.activities.length > 0) && (
          <BreathingDot size="md" style={waitingDotStyle} />
        )}

        {/* Reasoning block — shown when adaptive thinking is enabled */}
        {showReasoningBlock && (
          <ReasoningBlock
            thinkingContent={message.thinking!}
            isNewMessage={isNewMessage}
            isThinkingInProgress={message.isThinkingInProgress}
            modelName={message.modelName || message.model_name || message.model}
            modelMeta={message.modelMeta}
            activities={message.activities}
            reasoningSections={message.reasoning_sections}
            reasoningTimeline={message.reasoningTimeline}
            durationMs={message.reasoningDurationMs}
            isTurnActive={message.isLoading}
            promptDecisions={promptDecisions}
          />
        )}

        {/* Message content - assistant only (user handled above) */}
        {/* Text content always renders via ContentRenderer so that markdown
            structure, links, bold, code, math, and citation chips are handled uniformly
            regardless of whether the backend also sends a text responseBlock. */}
        {answerText ? (
          <m.div
            ref={contentRef}
            initial={isNewMessage ? { opacity: 0, y: 5 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <LibraryCitationsProvider citations={message.libraryCitations}>
            <StreamingTextContent
              content={answerText}
              citations={citations}
              animate={animateText}
              isLoading={!!message.isLoading}
              stopped={!!message.stoppedByUser}
              revealFrom={revealFrom}
              onCaughtUp={setCaughtUpText}
            />
            </LibraryCitationsProvider>
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
            webCitations={citations}
          />
        ) : null}

        {/* Citation sources - shown once the answer is fully on screen. */}
        {citations && revealSettled && (
          <SourceList citations={citations} />
        )}

        <AssistantPrompts message={message} onPromptDecided={onPromptDecided} onPromptFollowUp={onPromptFollowUp} />

        {/* Image generation preview — while an image tool is still running */}
        {/* popLayout: the exiting preview floats in place, so the real image
            slides into its spot and sharpens underneath the dissolve. */}
        <AnimatePresence mode="popLayout">
          {imageGenActivity && (
            <ImageGenerationPreview key="image-gen-preview" activity={imageGenActivity} />
          )}
        </AnimatePresence>

        {/* Generated images */}
        {visibleImages && visibleImages.length > 0 && (
          <div style={imagesRowStyle}>
            {visibleImages.map((img, i) => (
              <GeneratedImageCard key={img.url} img={img} index={i} />
            ))}
          </div>
        )}

        {/* Generated files */}
        {message.generatedFiles && message.generatedFiles.length > 0 && (
          <GeneratedFilesList files={message.generatedFiles} />
        )}

        {/* Stopped indicator */}
        {message.stoppedByUser && (
          <span style={stoppedStyle}>
            Generation stopped
          </span>
        )}

        {/* The turn failed after part of the answer was shown: the part stays
            (Copy/Pin work on it) and the failure sits below it. */}
        {message.errorNotice && revealSettled && (
          <ErrorNotice message={message.errorNotice} onRetry={archived ? undefined : retry} />
        )}

        {/* Content actions require an actual answer; errors can still regenerate.
            Hidden entirely on an archived chat — nothing here should be actionable. */}
        {!archived && (canUseContentActions || (isLast && onRegenerate)) && (
          <MessageActionBar
            revealSettled={revealSettled}
            canUseContentActions={canUseContentActions}
            showPin={!hidePinAction}
            pinned={pinned}
            copied={copied}
            showRegenerate={isLast}
            onPin={handlePin}
            onCopy={handleCopy}
            onRegenerate={onRegenerate}
          />
        )}
        </div>
      )}

      {/* ── Text-selection toolbar (assistant messages only) ── */}
      {isAssistant && !disableHighlight && (
        <SelectionPopover
          open={selectionOpen}
          anchorRect={selectionAnchor}
          onHighlight={HIGHLIGHTS_ENABLED ? handleHighlight : undefined}
          onCopy={handleCopySelection}
        />
      )}
    </m.div>
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
    prev.archived === next.archived &&
    // onEdit is a stable ref-backed callback (same identity for the component's
    // lifetime), so we only check null-ness to gate assistant regen button.
    (prev.onEdit == null) === (next.onEdit == null) &&
    // Re-render when regen availability flips (streaming starts/ends).
    (prev.onRegenerate == null) === (next.onRegenerate == null) &&
    (prev.onRevealSettled == null) === (next.onRevealSettled == null)
  )
}

export const ChatMessageMemo = React.memo(ChatMessage, areMessagePropsEqual)
