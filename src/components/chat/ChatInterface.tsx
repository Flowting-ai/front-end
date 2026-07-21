"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { X } from "lucide-react";
import { ArrowDownOneIcon } from "@strange-huge/icons";
import { IconButton } from "@/components/IconButton";
import { ORG_PLANS_ROUTE } from "@/lib/routes";
import { ChatMessageMemo } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CitationsPanel } from "./CitationsPanel";
import { PinMentionDropdown } from "./PinMentionDropdown";
import { PinChipStrip } from "./PinChipStrip";
import {
  AttachmentManager,
  type PendingAttachment,
} from "./AttachmentManager";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useFileUpload } from "@/hooks/use-file-upload";
import { registerChatScroller } from "@/lib/chat-scroller";
import { trackBrowserEvent, trackFeature } from "@/lib/analytics/events";
import { useChatState, type UseChatStateOptions, type UIMessage } from "@/hooks/use-chat-state";
import {
  useStreamingChat,
  type StreamState,
} from "@/hooks/use-streaming-chat";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { usePinboard, type PinItem } from "@/context/pinboard-context";
import { useAuth } from "@/context/auth-context";
import { useOrg } from "@/context/org-context";
import { useRouter } from "next/navigation";
import { InlineCreditNotice, type CreditNoticeStatus } from "@/components/InlineCreditNotice";
import { ExhaustionBanner } from "@/components/ExhaustionBanner";
import { useCreditStatus } from "@/hooks/use-credit-status";
import type { PinFolder } from "@/lib/api/pins";
import type { PinMentionable } from "./PinMentionDropdown";
import type { Source } from "@/types/chat";
import { ChatMessagesSkeleton } from "@/components/chat/ChatMessagesSkeleton";
import { Upload } from "lucide-react";

// ── Mention chip ──────────────────────────────────────────────────────────────

interface MentionChipProps {
  label: string;
  onRemove: () => void;
}

function MentionChip({ label, onRemove }: MentionChipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "999px",
        backgroundColor: "var(--neutral-100, #F5F5F5)",
        border: "1px solid var(--neutral-200, #E5E5E5)",
        padding: "2px 8px 2px 10px",
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--neutral-700, #444)",
        fontFamily: "var(--font-body)",
        maxWidth: "200px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        @{label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove mention @${label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "none",
          padding: "1px",
          cursor: "pointer",
          color: "var(--neutral-400, #999)",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}

// ── Mentioned pin state type ──────────────────────────────────────────────────

interface MentionedPin {
  id: string;
  label: string;
}

interface ChatInterfaceProps {
  chatId: string | undefined;
  onChatCreated?: (chatId: string) => void;
  onTitleUpdate?: (chatId: string, title: string) => void;
  onChatMoveToTop?: (chatId: string) => void;
  selectedModel?: string;
  selectedModelId?: string | number | null;
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Dropdown content for the `+` add button in ChatInput. */
  addMenu?: React.ReactNode;
  /** Dropdown content for the model selector button in ChatInput. */
  modelMenu?: React.ReactNode;
  /** If provided, ChatInterface auto-sends this message on mount (new chat). */
  initialPrompt?: string | null;
  /** Whether web search is currently enabled (controlled by parent). */
  webSearchEnabled?: boolean;
  /** Whether adaptive reasoning is enabled (sends enable_thinking to backend). */
  enableReasoning?: boolean;
  /** Files selected via the add-menu file picker (controlled by parent). */
  addMenuFiles?: File[];
  /** Called after send to let the parent clear its add-menu file list. */
  onClearAddMenuFiles?: () => void;
  /** Files attached in the new-chat input before the first send (initial prompt only). */
  initialFiles?: File[];
  /** Called after the initial prompt is sent to clear the initial file list. */
  onClearInitialFiles?: () => void;
  /** Chip elements rendered in the ChatInput footer (web search, file chips…). */
  chips?: React.ReactNode;
  /** Pin folders selected in the add menu — their pins are sent as context on every send. */
  selectedFolders?: PinFolder[];
  /**
   * @-mentioned pins (id + label) from the new-chat landing page before the first send.
   * These are one-shot: only used by the initial auto-send when ChatInterface mounts.
   */
  initialMentionedPins?: Array<{ id: string; label: string }>;
  /** Persona version id sent as `persona_id` on the regular /chats endpoint
   *  to apply the persona as an overlay on top of style / web search / etc. */
  selectedPersonaId?: string | null;
  /** System instruction for the selected persona, forwarded explicitly to the backend. */
  selectedPersonaSystemPrompt?: string | null;
  /** Temperature override from the selected persona. */
  selectedPersonaTemperature?: number | null;
  /** Style/tone ID to send with every message (e.g. "professional", "teaching"). */
  selectedStyleId?: string | null;
  /**
   * When set, scrolls to the message with this ID once the chat finishes
   * loading. Navigated here from the pinboard "Show in chat" button.
   */
  scrollToMessageId?: string | null;
  /**
   * When true, the model selector button is shown but non-interactive.
   * Use when a persona's model is locked and should not be changed.
   */
  disabledModelSelector?: boolean;
  /**
   * Override the SSE proxy endpoint. Defaults to "/api/chat".
   * Set to "/api/persona-chat" for persona-scoped chats.
   */
  endpoint?: string;
  /**
   * Custom backend stop handler. When provided, called instead of the default
   * POST /chats/{id}/stop. Use for persona or brain stop endpoints.
   */
  onStopBackend?: (chatId: string) => void;
  /**
   * Connector slugs forwarded to the backend on every send.
   * Used by persona chats that have connectors wired to a specific version.
   */
  connectorSlugs?: string[];
  /**
   * Rendered when the message list is empty and not loading.
   * Use to show a persona avatar / greeting instead of nothing.
   */
  emptyState?: React.ReactNode;
  /**
   * Override the default message fetcher (getChatMessages).
   * When provided, called with the chatId on mount; must return UIMessage[].
   * Pagination is disabled when this is set.
   */
  loadMessages?: (chatId: string) => Promise<UIMessage[]>;
  /**
   * When true, hide the pin @-mention dropdown and chips.
   * Persona chats don't use pins.
   */
  hidePinActions?: boolean;
  /** Readable shared chat whose original is owned by somebody else. */
  readOnly?: boolean;
  /**
   * When true, model_selected SSE events are ignored so the agent's pre-seeded
   * model is not overwritten by the backend during streaming. Pass when a persona
   * is active so the model name/logo in the reasoning section stays correct.
   */
  skipModelSelected?: boolean;
}

export function ChatInterface({
  chatId,
  onChatCreated,
  onTitleUpdate,
  onChatMoveToTop,
  selectedModel,
  selectedModelId,
  onModelClick,
  addMenu,
  modelMenu,
  initialPrompt,
  webSearchEnabled,
  enableReasoning,
  addMenuFiles,
  onClearAddMenuFiles,
  initialFiles,
  onClearInitialFiles,
  chips,
  selectedFolders,
  initialMentionedPins,
  selectedPersonaId,
  selectedPersonaSystemPrompt,
  selectedPersonaTemperature,
  selectedStyleId,
  scrollToMessageId,
  disabledModelSelector,
  endpoint,
  onStopBackend,
  connectorSlugs,
  emptyState,
  loadMessages,
  hidePinActions = false,
  readOnly = false,
  skipModelSelected,
}: ChatInterfaceProps) {
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [inputValue, setInputValue] = useState("");

  // Listen for pin:insert events dispatched by the Pinboard sidebar / expanded modal.
  // Appends the pin's content to the current input value.
  useEffect(() => {
    const handler = (e: Event) => {
      const content = (e as CustomEvent<{ content: string }>).detail?.content;
      if (content) setInputValue((prev) => prev ? `${prev}\n\n${content}` : content);
    };
    window.addEventListener("pin:insert", handler);
    return () => window.removeEventListener("pin:insert", handler);
  }, []);

  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [citationsSources, setCitationsSources] = useState<Source[]>([]);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(
    null,
  );

  // ── @-mention / pin state ─────────────────────────────────────────────────
  const [showPinDropdown, setShowPinDropdown] = useState(false);
  const [pinQuery, setPinQuery] = useState("");
  const [highlightedPinIndex, setHighlightedPinIndex] = useState(0);
  const [mentionedPins, setMentionedPins] = useState<MentionedPin[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  // True during the brief window after messages load while the virtualizer
  // measures all rendered items. Keeps the spinner up and content hidden so
  // the first visible frame is already at settled positions (no jitter).
  const [isSettling, setIsSettling] = useState(false);
  // Mirror of atBottom as a ref so the streaming scroll effect can read the
  // latest value without needing it as a dependency (which would re-fire the
  // effect on every scroll event, defeating the purpose).
  const atBottomRef = useRef(true);

  // Reset composed-but-unsent input whenever the user switches to a different chat.
  // Safe on new-chat creation: handleSend already clears inputValue before onChatCreated fires.
  const prevChatIdRef = useRef<string | null | undefined>(chatId)
  useEffect(() => {
    const prev = prevChatIdRef.current
    prevChatIdRef.current = chatId ?? null
    // Switching to a different real chat: reset streamState so the new chat's
    // input doesn't inherit a streaming indicator from the previous chat's
    // background stream. Exclude the null→realId transition for new chats.
    if (prev !== chatId && prev !== null && prev !== undefined) {
      setStreamState("idle")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run when chatId identity changes
  }, [chatId])

  useEffect(() => {
    setInputValue("");
    setAttachments([]);
    setMentionedPins([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run when chatId identity changes
  }, [chatId]);

  // Ref always pointing to the currently displayed chatId.
  // Passed to useStreamingChat to suppress setStreamState calls for background streams.
  const currentChatIdRef = useRef<string | undefined>(chatId ?? undefined)
  currentChatIdRef.current = chatId ?? undefined

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamingTopMessageIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  // Tracks which attachment IDs already have an active simulation interval
  // — simulation ref removed; upload progress now comes from real XHR in useStreamingChat —

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT } = useFileUpload();

  // Muse framework state — consumed from context to compute algorithm for API calls
  const { museActive, museAdvanced, selectedModel: contextModel } = useModelSelectorContext();

  // Auth context — refreshUser for updating usage after stream completes
  const { user, refreshUser } = useAuth();

  // Org context — pool status drives InlineCreditNotice above input
  const { plan, orgId, currentUserRole: orgRole } = useOrg();
  // Individual credit/topup status — drives the warning banner + hard send-gate.
  const creditStatus = useCreditStatus();

  const router = useRouter();
  const [dismissedCreditStatus, setDismissedCreditStatus] = useState<CreditNoticeStatus | null>(null);

  const CREDIT_NOTICE_STATUSES = new Set<string>(['warning_95', 'grace', 'locked']);
  const creditNoticeStatus: CreditNoticeStatus | null =
    plan?.poolStatus && CREDIT_NOTICE_STATUSES.has(plan.poolStatus) && plan.poolStatus !== dismissedCreditStatus
      ? (plan.poolStatus as CreditNoticeStatus)
      : null;

  // Pin data for the @-mention dropdown — read from context (no extra fetch).
  const { pins, isPinned } = usePinboard();

  const filteredPins = useMemo<PinItem[]>(() => {
    if (!pinQuery.trim()) return pins.slice(0, 10);
    const q = pinQuery.toLowerCase();
    return pins.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [pins, pinQuery]);

  const chatStateOptions = useMemo<UseChatStateOptions | undefined>(
    () => loadMessages ? { loadMessages } : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMessages identity is stable per render of the caller
    [loadMessages],
  )

  const {
    messages: rawMessages,
    setMessages,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    addOptimisticUserMessage,
    addLoadingAssistantMessage,
    rollbackLast,
    markChatAsOptimistic,
    refreshMessages,
  } = useChatState(chatId, chatStateOptions);

  const messages = rawMessages ?? [];

  // Seed model logo + name on assistant messages that have thinking content but no
  // model identity. Covers project chat where model_selected may not fire or the
  // history API doesn't return model_name — same pattern as PersonaChatInterface.
  // When Muse is active, contextModel is null (it is not an AIModel), so we derive
  // the identity from museActive/museAdvanced instead.
  useEffect(() => {
    const isMuse = museActive && !contextModel;
    if (!isMuse && !contextModel) return;
    setMessages(prev => {
      const needsPatch = prev.some(m => m.role === 'assistant' && m.thinking && !m.modelName && !m.modelMeta);
      if (!needsPatch) return prev;
      let modelName: string;
      let modelId: string;
      let company: string;
      let complexity: string | undefined;
      if (isMuse) {
        complexity = museAdvanced ? 'advanced' : 'basic';
        modelName  = museAdvanced ? 'Souvenir Muse (Advanced)' : 'Souvenir Muse (Basic)';
        modelId    = `muse-${complexity}`;
        company    = 'Souvenir';
      } else {
        modelName = contextModel!.modelName;
        company   = contextModel!.companyName;
        modelId   = String(contextModel!.modelId ?? contextModel!.id ?? '');
      }
      return prev.map(m => {
        if (m.role !== 'assistant' || !m.thinking || m.modelName || m.modelMeta) return m;
        return { ...m, modelName, modelMeta: { modelId, modelName, company, ...(complexity ? { complexity } : {}) } };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, contextModel, museActive, museAdvanced]);

  // Estimate how much of the model's context window is currently in use.
  // 1 token ≈ 4 chars — good enough for the 90%+ ring trigger.
  const contextUsedPct = useMemo(() => {
    const limit = contextModel?.inputLimit;
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
    if (!limit || limit <= 0) return Math.min(1, totalChars / (200_000 * 4));
    return Math.min(1, totalChars / (limit * 4));
  }, [messages, contextModel]);

  // ── Tab / page-reload resilience ──────────────────────────────────────────

  // Warn before page reload when a stream is active so the user doesn't
  // accidentally lose a response that's still being generated.
  useEffect(() => {
    const isActive = streamState === "streaming" || streamState === "waiting"
    if (!isActive) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [streamState])

  // When the browser tab regains focus, check if the SSE connection died
  // silently while the tab was hidden (e.g. server timeout, proxy close).
  // If there's a stuck loading message but no active stream, reload from the
  // API so the user sees whatever the backend managed to save.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const hasStuckMsg = messages.some((m) => m.isLoading)
      const streamNotActive = streamState !== "streaming" && streamState !== "waiting"
      if (hasStuckMsg && streamNotActive) {
        void refreshMessages()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshMessages is stable; messages/streamState intentional deps
  }, [messages, streamState, refreshMessages])

  const msgVirtualizer = useVirtualizer({
    count:            messages.length,
    getScrollElement: () => messagesContainerRef.current,
    // Role-aware size estimates so corrections when items are first measured
    // are small, preventing scroll-position jumps when scrolling upward.
    // User bubbles: short (≈80px base). AI messages scale with content length.
    // These are estimates only — measureElement always wins once rendered.
    estimateSize: (i) => {
      const msg = messages[i]
      if (!msg) return 200
      if (msg.role === "user") {
        // Base height for the bubble + padding; add ~16px per 80 chars
        return 80 + Math.ceil((msg.content?.length ?? 0) / 80) * 16
      }
      // Assistant: base 120px + rough line estimate from content length
      const contentLen = msg.content?.length ?? 0
      const hasBlocks = (msg.responseBlocks?.length ?? 0) > 0
      return Math.min(120 + Math.ceil(contentLen / 60) * 20 + (hasBlocks ? 300 : 0), 2000)
    },
    overscan:         10,
  });

  const { moveToTop } = { moveToTop: onChatMoveToTop ?? (() => {}) };

  // Register the virtualizer-backed scroller so jump-gutter / highlight-panel
  // can bring virtualized messages into view before querying the DOM.
  useEffect(() => {
    registerChatScroller((messageId, onRendered) => {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return
      msgVirtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
      // Poll until the row renders in the DOM (up to 40 × 50 ms = 2 s)
      let attempts = 0
      const poll = setInterval(() => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`)
        if (el || attempts++ >= 40) {
          clearInterval(poll)
          if (el) onRendered(el)
        }
      }, 50)
    })
    return () => registerChatScroller(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, msgVirtualizer])

  // Wrap onChatCreated to mark the new ID as optimistic BEFORE the parent
  // updates the URL/chatId prop - prevents useChatState from wiping messages.
  const handleChatCreated = (newChatId: string) => {
    markChatAsOptimistic(newChatId);
    onChatCreated?.(newChatId);
  };

  const { fetchAiResponse, handleStopGeneration } = useStreamingChat({
    setMessages,
    onChatCreated: handleChatCreated,
    onTitleUpdate,
    onChatMoveToTop: (id) => moveToTop(id),
    setStreamState,
    onStreamDone: refreshUser,
    currentChatIdRef,
    ...(endpoint ? { endpoint } : {}),
    ...(onStopBackend ? { onStopBackend } : {}),
    ...(skipModelSelected ? { skipModelSelected } : {}),
  });

  const isStreaming = streamState === "streaming" || streamState === "waiting";

  // Synchronous reentrancy guard for handleSend/handleRegenerate. `isStreaming` is
  // state-derived and lands a render behind the click, so a double-click (or an
  // Enter-then-click race) within the same tick can slip two fetchAiResponse calls
  // through before the button disables — this ref closes that gap.
  const isSendingRef = useRef(false);

  // Auto-send initial prompt on mount (for new chats triggered from landing page)
  const initialPromptSentRef = useRef(false);
  const sendInitialPrompt = useRef<((prompt: string) => void) | null>(null);

  // Store the send function in a ref so it's always current (closes over latest props)
  sendInitialPrompt.current = async (prompt: string) => {
    const content = prompt.trim();
    if (content && !chatId) {
      // Use initialFiles if provided, otherwise fall back to addMenuFiles.
      // The landing page passes files via addMenuFiles (not initialFiles), so
      // we must check both to avoid sending the message without attachments.
      const files = (initialFiles && initialFiles.length > 0)
        ? [...initialFiles]
        : (addMenuFiles && addMenuFiles.length > 0)
          ? [...addMenuFiles]
          : [];
      const initialMentionedPinObjects = initialMentionedPins ?? [];
      const userMsgId = addOptimisticUserMessage(
        content,
        files.length > 0 ? files : undefined,
        initialMentionedPinObjects.length > 0 ? initialMentionedPinObjects : undefined,
      );
      const loadingId = addLoadingAssistantMessage();
      setAttachments([]);
      onClearInitialFiles?.();
      onClearAddMenuFiles?.();
      const algorithm = museActive ? (museAdvanced ? 'pro' : 'base') : null;
      const folderPinIds = selectedFolders && selectedFolders.length > 0
        ? pins.filter(p => p.folderId && selectedFolders.some(f => f.id === p.folderId)).map(p => p.id)
        : [];
      const allInitialPinIds = [...new Set([...folderPinIds, ...initialMentionedPinObjects.map(p => p.id)])];
      fetchAiResponse(content, null, loadingId, algorithm ? null : selectedModelId, {
        webSearch: webSearchEnabled,
        enableReasoning,
        files: files.length > 0 ? files : undefined,
        algorithm: algorithm ?? undefined,
        userMessageId: userMsgId,
        pinIds: allInitialPinIds.length > 0 ? allInitialPinIds : undefined,
        personaId: selectedPersonaId ?? undefined,
        systemPrompt: selectedPersonaSystemPrompt ?? undefined,
        temperature: selectedPersonaTemperature ?? undefined,
        toneId: selectedStyleId ?? undefined,
        connectorSlugs: connectorSlugs && connectorSlugs.length > 0 ? connectorSlugs : undefined,
        onUploadProgress: files.length > 0 ? (pct) => {
          setMessages((prev) => prev.map((msg) =>
            msg.id !== userMsgId ? msg : {
              ...msg,
              attachments: msg.attachments?.map((att) => ({
                ...att,
                uploadProgress: pct,
                uploading: pct < 100,
              })),
            }
          ));
        } : undefined,
      });
    }
  };

  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      sendInitialPrompt.current?.(initialPrompt);
    }
  }, [initialPrompt]);

  // Scroll to bottom instantly when a chat finishes loading (opening an existing chat).
  // We track the previous loading state so we fire exactly once on the
  // false→true transition, not on every subsequent message change.
  const prevIsLoadingRef = useRef(false);
  const scrolledToMessageRef = useRef<string | null>(null);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoadingMessages;
    if (wasLoading && !isLoadingMessages && messages.length > 0) {
      // Enter settling: keep spinner up while the virtualizer renders and
      // measures all initial items. Two RAF frames give the browser time to
      // complete its layout pass so the first visible frame has no jitter.
      setIsSettling(true);

      // Scroll to target position while content is still hidden so the
      // virtualizer places items at correct offsets before reveal.
      if (scrollToMessageId && scrolledToMessageRef.current !== scrollToMessageId) {
        const idx = messages.findIndex((m) => m.id === scrollToMessageId);
        if (idx !== -1) {
          scrolledToMessageRef.current = scrollToMessageId;
          msgVirtualizer.scrollToIndex(idx, { align: 'start', behavior: 'auto' });
        }
      } else {
        msgVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' });
      }

      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setIsSettling(false);
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [isLoadingMessages, messages, scrollToMessageId, msgVirtualizer]);

  // Scroll to bottom as new streaming content arrives — but only when the
  // user is already at (or near) the bottom. If they scrolled up to read
  // earlier messages while the model is generating, we must NOT force them
  // back down. atBottomRef always reflects the latest scroll position without
  // creating a dependency cycle.
  useEffect(() => {
    if (!isStreaming) {
      streamingTopMessageIdRef.current = null;
      return;
    }
    if (isLoadingMessages || messages.length === 0) return;

    const idx = messages.findLastIndex((m) => m.role === "assistant");
    if (idx === -1) return;

    const messageId = messages[idx]?.id;
    if (!messageId || streamingTopMessageIdRef.current === messageId) return;

    // Only treat the user as "scrolled away" when the content actually
    // overflows the viewport. Otherwise (e.g. the first short reply in a new
    // chat) there is nothing to scroll, no scroll event fires to correct the
    // flag, and the scroll-to-bottom button lingers with nowhere to go. Don't
    // mark this message as handled until it's scrollable, so this re-evaluates
    // as more streamed content arrives.
    const container = messagesContainerRef.current;
    const isScrollable = container
      ? container.scrollHeight - container.clientHeight > 80
      : false;
    if (!isScrollable) return;

    streamingTopMessageIdRef.current = messageId;
    atBottomRef.current = false;
    setAtBottom(false);
    msgVirtualizer.scrollToIndex(idx, { align: 'start', behavior: 'auto' });
  }, [isStreaming, messages, isLoadingMessages, msgVirtualizer]);

  // Scroll-to-top for pagination + track whether user is at bottom.
  // We gate setAtBottom behind a threshold comparison against the ref value
  // to avoid triggering React re-renders on every scroll pixel during streaming.
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nowAtBottom = dist < 80;
    // Always update the ref synchronously so the streaming effect sees it immediately.
    atBottomRef.current = nowAtBottom;
    // Only update state (and trigger a re-render) when the boolean value flips.
    setAtBottom((prev) => (prev === nowAtBottom ? prev : nowAtBottom));
  };

  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) return;
    atBottomRef.current = true;
    setAtBottom(true);
    msgVirtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
  }, [messages.length, msgVirtualizer]);

  // File drop (drag-and-drop into the chat area)
  const { isDragging } = useFileDrop({
    onFiles: (files) => {
      setAttachments((prev) => processFiles(files, prev));
    },
    disabled: isStreaming,
  });

  // Absorb add-menu files into local attachments so AttachmentManager shows them.
  // onClearAddMenuFiles is intentionally NOT called here — it's called in handleSend
  // so the files stay in addMenuFiles until the user actually sends.
  // Skip only while initialPrompt is still pending: sendInitialPrompt consumes those
  // files directly, so absorbing here would duplicate them. Once initialPrompt is
  // cleared (in handleChatCreated on the page) this guard is lifted and subsequent
  // uploads in the same chat session are absorbed normally.
  useEffect(() => {
    if (!addMenuFiles || addMenuFiles.length === 0) return;
    if (initialPrompt) return;
    setAttachments((prev) => processFiles(addMenuFiles, prev));
  }, [addMenuFiles, initialPrompt]);

  // ── Pin-mention handlers ────────────────────────────────────────────────────

  // Reset highlighted index whenever the filtered list changes.
  useEffect(() => {
    setHighlightedPinIndex(0);
  }, [filteredPins]);

  // Close the dropdown when the user clicks outside the input wrapper.
  useEffect(() => {
    if (!showPinDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(e.target as Node)
      ) {
        setShowPinDropdown(false);
        setPinQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPinDropdown]);

  const handleMentionChange = useCallback((query: string | null) => {
    if (query === null) {
      setShowPinDropdown(false);
      setPinQuery("");
    } else {
      setShowPinDropdown(true);
      setPinQuery(query);
    }
  }, []);

  const handlePinSelect = useCallback((pin: PinMentionable) => {
    const label = (pin.title || pin.content).slice(0, 50) || pin.id;
    // Strip the `@query` fragment that the user typed from the input value.
    setInputValue((prev) => {
      const lastAt = prev.lastIndexOf("@");
      return lastAt !== -1 ? prev.substring(0, lastAt) : prev;
    });
    setMentionedPins((prev) =>
      prev.some((m) => m.id === pin.id)
        ? prev
        : [...prev, { id: pin.id, label }],
    );
    setShowPinDropdown(false);
    setPinQuery("");
  }, []);

  const handleRemoveMention = useCallback((pinId: string) => {
    setMentionedPins((prev) => prev.filter((m) => m.id !== pinId));
  }, []);

  const handlePinNavigate = useCallback(
    (action: "up" | "down" | "select" | "close") => {
      switch (action) {
        case "down":
          setHighlightedPinIndex((i) =>
            i < filteredPins.length - 1 ? i + 1 : 0,
          );
          break;
        case "up":
          setHighlightedPinIndex((i) =>
            i > 0 ? i - 1 : filteredPins.length - 1,
          );
          break;
        case "select":
          if (filteredPins[highlightedPinIndex]) {
            handlePinSelect(filteredPins[highlightedPinIndex]);
          }
          break;
        case "close":
          setShowPinDropdown(false);
          setPinQuery("");
          break;
      }
    },
    [filteredPins, highlightedPinIndex, handlePinSelect],
  );

  // Send message - uses local attachments (which include add-menu files after absorption)
  const handleSend = async (text: string) => {
    const allFiles = attachments.map((a) => a.file);
    if (!text.trim() && allFiles.length === 0) return;

    // Hard-stop backstop: an exhausted credit/topup user cannot send. The input is
    // already disabled and the CreditStatusBanner explains why, so block silently.
    if (creditStatus.blocked) return;

    // Reentrancy guard: see isSendingRef declaration above.
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    const content = text.trim();
    // Capture mentionedPins before clearing so they're stored on the optimistic message.
    const capturedMentionedPins = mentionedPins;
    const userMsgId = addOptimisticUserMessage(
      content,
      allFiles.length > 0 ? allFiles : undefined,
      capturedMentionedPins.length > 0 ? capturedMentionedPins : undefined,
    );
    const loadingId = addLoadingAssistantMessage();
    setInputValue("");
    setAttachments([]);
    setMentionedPins([]);
    onClearAddMenuFiles?.();

    const folderPinIds = selectedFolders && selectedFolders.length > 0
      ? pins.filter(p => p.folderId && selectedFolders.some(f => f.id === p.folderId)).map(p => p.id)
      : [];
    const mentionedPinIds = capturedMentionedPins.map(m => m.id);
    const allPinIds = [...new Set([...folderPinIds, ...mentionedPinIds])];

    // Analytics: baseline activity + trust in auto-routing (cost story). Metadata only.
    trackBrowserEvent("chat_message_sent", {
      has_agent: !!selectedPersonaId,
      model_pick: museActive ? "auto" : "manual",
      model_id: !museActive && selectedModelId != null ? String(selectedModelId) : undefined,
      web_search: webSearchEnabled,
      reasoning: enableReasoning,
      attachment_count: allFiles.length,
      pin_count: allPinIds.length,
    });

    try {
      const algorithm = museActive ? (museAdvanced ? 'pro' : 'base') : null;
      await fetchAiResponse(content, chatId ?? null, loadingId, algorithm ? null : selectedModelId, {
        webSearch: webSearchEnabled,
        enableReasoning,
        files: allFiles.length > 0 ? allFiles : undefined,
        algorithm: algorithm ?? undefined,
        userMessageId: userMsgId,
        pinIds: allPinIds.length > 0 ? allPinIds : undefined,
        personaId: selectedPersonaId ?? undefined,
        systemPrompt: selectedPersonaSystemPrompt ?? undefined,
        temperature: selectedPersonaTemperature ?? undefined,
        toneId: selectedStyleId ?? undefined,
        connectorSlugs: connectorSlugs && connectorSlugs.length > 0 ? connectorSlugs : undefined,
        onUploadProgress: allFiles.length > 0 ? (pct) => {
          setMessages((prev) => prev.map((msg) =>
            msg.id !== userMsgId ? msg : {
              ...msg,
              attachments: msg.attachments?.map((att) => ({
                ...att,
                uploadProgress: pct,
                uploading: pct < 100,
              })),
            }
          ));
        } : undefined,
      });
    } catch {
      rollbackLast(2);
    } finally {
      isSendingRef.current = false;
    }
  };

  // Regenerate last assistant message
  const handleRegenerate = () => {
    if (isSendingRef.current) return;

    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMsg) return;

    isSendingRef.current = true;

    setMessages((prev) => {
      const lastAssistantIdx = prev.findLastIndex(
        (m) => m.role === "assistant",
      );
      if (lastAssistantIdx >= 0) {
        return prev.filter((_, i) => i !== lastAssistantIdx);
      }
      return prev;
    });

    const loadingId = addLoadingAssistantMessage();
    // Analytics: part of the override rate (earliest answer-quality warning).
    trackFeature("regenerate", {
      model_pick: museActive ? "auto" : "manual",
      model_id: !museActive && selectedModelId != null ? String(selectedModelId) : undefined,
      reasoning: enableReasoning,
    });
    const algorithm = museActive ? (museAdvanced ? 'pro' : 'base') : null;
    fetchAiResponse(
      lastUserMsg.content,
      chatId ?? null,
      loadingId,
      algorithm ? null : selectedModelId,
      algorithm ? { algorithm } : undefined,
    ).finally(() => {
      isSendingRef.current = false;
    });
  };

  // Permission-prompt answers live on the message, not in card-local state —
  // otherwise the message_saved id swap remounts the row and resurrects
  // already-answered cards.
  const handlePromptDecided = useCallback((messageId: string, requestId: string, decision: string) => {
    setMessages((prev) => prev.map((msg) =>
      msg.id === messageId
        ? {
            ...msg,
            connectorPermissionPrompts: msg.connectorPermissionPrompts?.map((p) =>
              p.request_id === requestId ? { ...p, decision } : p,
            ),
          }
        : msg,
    ));
  }, [setMessages]);

  // Edit user message — replaces the message content, removes all subsequent
  // messages, then re-streams an assistant response using the backend's
  // replace_message_id edit API.
  //
  // Stable-ref pattern: the useCallback wrapper always has the same identity so
  // ChatMessageMemo never gets a stale onEdit=undefined due to memoization.
  // The real impl is stored in a ref and refreshed every render, so it always
  // closes over the latest isStreaming, chatId, model settings, etc.
  const _handleEditMessageImpl = useRef<(messageId: string, newContent: string) => void>(() => {})
  // Update the ref synchronously during render (safe: only read in event handlers)
  _handleEditMessageImpl.current = (messageId: string, newContent: string) => {
    if (isStreaming) return  // never edit while a stream is in-flight

    // User messages loaded from history have IDs like "{uuid}-prompt" (added by
    // normalizeMessages). The backend requires a bare UUID for replace_message_id,
    // so we strip the "-prompt" suffix before forwarding.
    const bareMessageId = messageId.endsWith("-prompt")
      ? messageId.slice(0, messageId.length - "-prompt".length)
      : messageId
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const replaceMessageId =
      bareMessageId &&
      !bareMessageId.startsWith("temp-") &&
      !bareMessageId.startsWith("optimistic-") &&
      UUID_RE.test(bareMessageId)
        ? bareMessageId
        : undefined

    // findIndex runs inside the functional updater so it always sees the current
    // messages array — not a stale snapshot from the render closure.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId)
      if (idx === -1) return prev
      return prev
        .map((m, i) => (i === idx ? { ...m, content: newContent } : m))
        .slice(0, idx + 1)
    })
    const loadingId = addLoadingAssistantMessage()
    const algorithm = museActive ? (museAdvanced ? "pro" : "base") : null

    fetchAiResponse(newContent, chatId ?? null, loadingId, algorithm ? null : selectedModelId, {
      webSearch: webSearchEnabled,
      enableReasoning,
      algorithm: algorithm ?? undefined,
      personaId: selectedPersonaId ?? undefined,
      systemPrompt: selectedPersonaSystemPrompt ?? undefined,
      temperature: selectedPersonaTemperature ?? undefined,
      toneId: selectedStyleId ?? undefined,
      connectorSlugs: connectorSlugs && connectorSlugs.length > 0 ? connectorSlugs : undefined,
      ...(replaceMessageId ? { replaceMessageId } : {}),
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable wrapper; impl updates via ref
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => _handleEditMessageImpl.current(messageId, newContent),
    [],
  )

  // Citations
  const handleCitationsClick = (sources: Source[]) => {
    setCitationsSources(sources);
    setCitationsOpen(true);
  };

  // Attachment via hidden file input (triggered by onAdd on the ChatInput)
  const handleAdd = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => processFiles(e.target.files!, prev));
      e.target.value = "";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        position: "relative",
      }}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.9)",
            border: "2px dashed var(--blue-400)",
            borderRadius: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              color: "var(--blue-600)",
            }}
          >
            <Upload size={32} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-body-md)",
                fontWeight: "var(--font-weight-medium)",
              }}
            >
              Drop files here
            </span>
          </div>
        </div>
      )}

      {/* Messages area + scroll-to-bottom button, wrapped so the button can be absolutely positioned at the bottom of the scroll area */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {isStreaming ? "Assistant is responding." : "Assistant response complete."}
        </div>
        <div
          ref={messagesContainerRef}
          className="kaya-scrollbar"
          role="region"
          aria-label="Conversation"
          aria-busy={isLoadingMessages || isStreaming ? true : undefined}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: "720px" }}>
          {/* Loading skeleton — shown while fetching AND while the virtualizer
              settles its initial measurements so the first visible frame is jitter-free */}
          {(isLoadingMessages || isSettling) && <ChatMessagesSkeleton />}

          {/* Empty state — shown when no messages and not loading */}
          {!isLoadingMessages && !isSettling && messages.length === 0 && emptyState}

          {/* Messages — virtualised: only renders visible rows.
              Hidden (not unmounted) during settling so the virtualizer can
              measure items while the spinner is still shown. */}
          <div style={{ position: 'relative', height: msgVirtualizer.getTotalSize(), visibility: isSettling ? 'hidden' : 'visible' }}>
            {msgVirtualizer.getVirtualItems().map((vRow) => {
              const message = messages[vRow.index];
              const idx     = vRow.index;
              return (
                <div
                  key={message.id}
                  data-index={vRow.index}
                  ref={msgVirtualizer.measureElement}
                  style={{
                    position:   'absolute',
                    top:        0,
                    left:       0,
                    width:      '100%',
                    transform:  `translateY(${vRow.start}px)`,
                    // Promote each row to its own compositor layer so
                    // translateY updates don't trigger a full-page repaint.
                    willChange: 'transform',
                    // Contain layout so height changes to this row (e.g. the
                    // last streaming message growing) don't cause ancestor
                    // reflows that disturb the scroll position of other rows.
                    contain:    'layout',
                  }}
                >
                  <ChatMessageMemo
                    message={message}
                    isLast={idx === messages.length - 1}
                    isNewMessage={idx === messages.length - 1 && isStreaming}
                    chatId={chatId}
                    showReasoning={enableReasoning}
                    pinned={message.role === 'assistant' ? isPinned(message.id) : false}
                    onRegenerate={
                      idx === messages.length - 1 &&
                      message.role === "assistant" &&
                      !isStreaming
                        ? handleRegenerate
                        : undefined
                    }
                    onEdit={
                      message.role === "user"
                        ? handleEditMessage
                        : undefined
                    }
                    onCitationsClick={
                      message.sources && message.sources.length > 0
                        ? () => handleCitationsClick(message.sources!)
                        : undefined
                    }
                    onPromptDecided={handlePromptDecided}
                  />
                </div>
              );
            })}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {!atBottom && (
          <m.div
            key="scroll-to-bottom"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              x: '-50%',
              zIndex: 10,
            }}
          >
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Scroll to bottom"
              icon={<ArrowDownOneIcon size={16} />}
              onClick={scrollToBottom}
            />
          </m.div>
        )}
      </AnimatePresence>
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "16px 16px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Workspace credit notice — team plan only, dismissible per status level */}
        <AnimatePresence>
          {creditNoticeStatus && (
            <InlineCreditNotice
              key={creditNoticeStatus}
              status={creditNoticeStatus}
              isAdmin={orgRole === 'admin'}
              onAdminAction={() => router.push(ORG_PLANS_ROUTE)}
              onDismiss={() => setDismissedCreditStatus(creditNoticeStatus)}
            />
          )}
        </AnimatePresence>

        {/* Chat input wrapper */}
        <div
          style={{
            width:    '100%',
            maxWidth: '754px',
          }}
        >
          <ExhaustionBanner>
          {/* position:relative wrapper lets PinMentionDropdown use absolute positioning */}
          <div
            ref={inputWrapperRef}
            style={{ width: "100%", position: "relative", zIndex: 1 }}
          >
          {!hidePinActions && (
            <PinMentionDropdown
              isOpen={showPinDropdown}
              pins={filteredPins}
              query={pinQuery}
              highlightedIndex={highlightedPinIndex}
              onHighlight={setHighlightedPinIndex}
              onSelect={handlePinSelect}
            />
          )}

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStopGeneration}
            onAdd={handleAdd}
            onFilePaste={(files) => setAttachments((prev) => processFiles(files, prev))}
            hasAttachments={attachments.length > 0}
            onModelClick={onModelClick}
            modelName={selectedModel ?? "Souvenir"}
            addMenu={addMenu}
            modelMenu={modelMenu}
            disabledModelSelector={disabledModelSelector}
            chips={chips}
            attachmentsSlot={
              !hidePinActions && mentionedPins.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <PinChipStrip>
                    {mentionedPins.map((mp) => (
                      <MentionChip
                        key={mp.id}
                        label={mp.label}
                        onRemove={() => handleRemoveMention(mp.id)}
                      />
                    ))}
                  </PinChipStrip>
                  <AttachmentManager
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    disabled={isStreaming}
                  />
                </div>
              ) : (
                <AttachmentManager
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  disabled={isStreaming}
                />
              )
            }
            isStreaming={isStreaming}
            disabled={readOnly || isStreaming || plan?.poolStatus === 'locked' || creditStatus.blocked}
            placeholder={
              readOnly
                ? 'Create your own copy to continue this chat.'
                : plan?.poolStatus === 'locked'
                ? 'Workspace locked. Contact your admin.'
                : creditStatus.blocked
                  ? 'Credits exhausted. Buy a top-up to continue.'
                  : 'How can I help you today?'
            }
            onMentionChange={hidePinActions ? undefined : handleMentionChange}
            isPinDropdownOpen={hidePinActions ? false : showPinDropdown}
            onPinNavigate={hidePinActions ? undefined : handlePinNavigate}
            contextUsedPct={contextUsedPct}
          />
          </div>
          </ExhaustionBanner>
        </div>

        {/* Hidden file input for drag-drop fallback via onAdd */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>

      {/* Citations panel */}
      <CitationsPanel
        sources={citationsSources}
        isOpen={citationsOpen}
        onClose={() => setCitationsOpen(false)}
        highlightedIndex={highlightedCitation}
      />
    </div>
  );
}
