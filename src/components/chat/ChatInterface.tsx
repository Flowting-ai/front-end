"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { X } from "lucide-react";
import { ChatMessageMemo } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CitationsPanel } from "./CitationsPanel";
import { PinMentionDropdown } from "./PinMentionDropdown";
import {
  AttachmentManager,
  type PendingAttachment,
} from "./AttachmentManager";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useChatState } from "@/hooks/use-chat-state";
import {
  useStreamingChat,
  type StreamState,
} from "@/hooks/use-streaming-chat";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { usePinboard, type PinItem } from "@/context/pinboard-context";
import type { PinFolder } from "@/lib/api/pins";
import type { PinMentionable } from "./PinMentionDropdown";
import type { Source } from "@/types/chat";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
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
   * Pin IDs from @-mentions made on the new-chat landing page before the first send.
   * These are one-shot: only used by the initial auto-send when ChatInterface mounts.
   */
  initialMentionedPinIds?: string[];
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
  initialMentionedPinIds,
  selectedPersonaId,
  selectedPersonaSystemPrompt,
  selectedPersonaTemperature,
  selectedStyleId,
  scrollToMessageId,
  disabledModelSelector,
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
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

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  // Tracks which attachment IDs already have an active simulation interval
  // — simulation ref removed; upload progress now comes from real XHR in useStreamingChat —

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT } = useFileUpload();

  // Muse framework state — consumed from context to compute algorithm for API calls
  const { museActive, museAdvanced } = useModelSelectorContext();

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
  } = useChatState(chatId);

  const messages = rawMessages ?? [];

  const msgVirtualizer = useVirtualizer({
    count:            messages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize:     () => 200,
    overscan:         3,
  });

  const { moveToTop } = { moveToTop: onChatMoveToTop ?? (() => {}) };

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
  });

  const isStreaming = streamState === "streaming" || streamState === "waiting";

  // Auto-send initial prompt on mount (for new chats triggered from landing page)
  const initialPromptSentRef = useRef(false);
  const sendInitialPrompt = useRef<((prompt: string) => void) | null>(null);

  // Store the send function in a ref so it's always current (closes over latest props)
  sendInitialPrompt.current = async (prompt: string) => {
    const content = prompt.trim();
    if (content && !chatId) {
      // Use initialFiles (passed separately from addMenuFiles) so the absorb
      // effect never sees these files and doesn't show them in the input strip.
      const files = initialFiles && initialFiles.length > 0 ? [...initialFiles] : [];
      const userMsgId = addOptimisticUserMessage(content, files.length > 0 ? files : undefined);
      const loadingId = addLoadingAssistantMessage();
      setAttachments([]);
      onClearInitialFiles?.();
      const algorithm = museActive ? (museAdvanced ? 'pro' : 'base') : null;
      const folderPinIds = selectedFolders && selectedFolders.length > 0
        ? pins.filter(p => p.folderId && selectedFolders.some(f => f.id === p.folderId)).map(p => p.id)
        : [];
      const allInitialPinIds = [...new Set([...folderPinIds, ...(initialMentionedPinIds ?? [])])];
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
      // If a specific message was requested, scroll to it instead of the bottom.
      if (scrollToMessageId && scrolledToMessageRef.current !== scrollToMessageId) {
        const idx = messages.findIndex((m) => m.id === scrollToMessageId);
        if (idx !== -1) {
          scrolledToMessageRef.current = scrollToMessageId;
          msgVirtualizer.scrollToIndex(idx, { align: 'start', behavior: 'smooth' });
          return;
        }
      }
      // Use instant scroll - smooth scroll can leave the user mid-thread.
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoadingMessages, messages, scrollToMessageId, msgVirtualizer]);

  // Scroll to bottom smoothly as new streaming content arrives.
  const lastMessageContent = messages.length > 0
    ? messages[messages.length - 1]?.content?.length ?? 0
    : 0;
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0 && isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isStreaming, messages.length, lastMessageContent, isLoadingMessages]);

  // Scroll-to-top for pagination
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
  };

  // File drop (drag-and-drop into the chat area)
  const { isDragging } = useFileDrop({
    onFiles: (files) => {
      setAttachments((prev) => processFiles(files, prev));
    },
    disabled: isStreaming,
  });

  // Absorb add-menu files into local attachments so AttachmentManager shows them.
  // onClearAddMenuFiles is intentionally NOT called here — it's called in handleSend
  // so the files stay in addMenuFiles until the user actually sends. This also fixes
  // a StrictMode issue where calling clear here would wipe addMenuFiles before the
  // component remounts, preventing the second effect run from absorbing anything.
  useEffect(() => {
    if (!addMenuFiles || addMenuFiles.length === 0) return;
    setAttachments((prev) => processFiles(addMenuFiles, prev));
  }, [addMenuFiles]);

  // ── Pin-mention handlers ────────────────────────────────────────────────────

  // Reset highlighted index whenever the filtered list changes.
  // eslint-disable-next-line react-doctor/no-derived-state-effect -- index reset on filter change; not a component-level key-prop candidate
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

    const content = text.trim();
    const userMsgId = addOptimisticUserMessage(content, allFiles.length > 0 ? allFiles : undefined);
    const loadingId = addLoadingAssistantMessage();
    setInputValue("");
    setAttachments([]);
    setMentionedPins([]);
    onClearAddMenuFiles?.();

    const folderPinIds = selectedFolders && selectedFolders.length > 0
      ? pins.filter(p => p.folderId && selectedFolders.some(f => f.id === p.folderId)).map(p => p.id)
      : [];
    const mentionedPinIds = mentionedPins.map(m => m.id);
    const allPinIds = [...new Set([...folderPinIds, ...mentionedPinIds])];

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
    }
  };

  // Regenerate last assistant message
  const handleRegenerate = () => {
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMsg) return;

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
    const algorithm = museActive ? (museAdvanced ? 'pro' : 'base') : null;
    fetchAiResponse(
      lastUserMsg.content,
      chatId ?? null,
      loadingId,
      algorithm ? null : selectedModelId,
      algorithm ? { algorithm } : undefined,
    );
  };

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

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="kaya-scrollbar"
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
          {/* Loading indicator for pagination */}
          {isLoadingMessages && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px",
              }}
            >
              <LoadingSpinner size={20} />
            </div>
          )}

          {/* Messages — virtualised: only renders visible rows */}
          <div style={{ position: 'relative', height: msgVirtualizer.getTotalSize() }}>
            {msgVirtualizer.getVirtualItems().map((vRow) => {
              const message = messages[vRow.index];
              const idx     = vRow.index;
              return (
                <div
                  key={message.id}
                  data-index={vRow.index}
                  ref={msgVirtualizer.measureElement}
                  style={{
                    position:  'absolute',
                    top:       0,
                    left:      0,
                    width:     '100%',
                    transform: `translateY(${vRow.start}px)`,
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
                      message.role === "user" && !isStreaming
                        ? (_, newContent) => {
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === message.id
                                  ? { ...m, content: newContent }
                                  : m,
                              ),
                            );
                          }
                        : undefined
                    }
                    onCitationsClick={
                      message.sources && message.sources.length > 0
                        ? () => handleCitationsClick(message.sources!)
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>

          <div ref={messagesEndRef} />
        </div>
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
        {/* position:relative wrapper lets PinMentionDropdown use absolute positioning */}
        <div
          ref={inputWrapperRef}
          style={{ width: "100%", maxWidth: "754px", position: "relative" }}
        >
          <PinMentionDropdown
            isOpen={showPinDropdown}
            pins={filteredPins}
            query={pinQuery}
            highlightedIndex={highlightedPinIndex}
            onHighlight={setHighlightedPinIndex}
            onSelect={handlePinSelect}
          />

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStopGeneration}
            onAdd={handleAdd}
            onModelClick={onModelClick}
            modelName={selectedModel ?? "Souvenir"}
            addMenu={addMenu}
            modelMenu={modelMenu}
            disabledModelSelector={disabledModelSelector}
            chips={
              mentionedPins.length > 0 ? (
                <>
                  {mentionedPins.map((mp) => (
                    <MentionChip
                      key={mp.id}
                      label={mp.label}
                      onRemove={() => handleRemoveMention(mp.id)}
                    />
                  ))}
                  {chips}
                </>
              ) : (
                chips
              )
            }
            attachmentsSlot={
              <AttachmentManager
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={isStreaming}
              />
            }
            isStreaming={isStreaming}
            disabled={isStreaming}
            placeholder="How can I help you today?"
            onMentionChange={handleMentionChange}
            isPinDropdownOpen={showPinDropdown}
            onPinNavigate={handlePinNavigate}
          />
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
