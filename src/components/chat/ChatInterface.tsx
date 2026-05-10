"use client";

import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CitationsPanel } from "./CitationsPanel";
import {
  AttachmentManager,
  type PendingAttachment,
} from "./AttachmentManager";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useFileUpload, startUploadSimulation } from "@/hooks/use-file-upload";
import { useChatState } from "@/hooks/use-chat-state";
import {
  useStreamingChat,
  type StreamState,
} from "@/hooks/use-streaming-chat";
import type { Source } from "@/types/chat";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Upload } from "lucide-react";

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
  /** Files selected via the add-menu file picker (controlled by parent). */
  addMenuFiles?: File[];
  /** Called after send to let the parent clear its add-menu file list. */
  onClearAddMenuFiles?: () => void;
  /** Chip elements rendered in the ChatInput footer (web search, file chips…). */
  chips?: React.ReactNode;
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
  addMenuFiles,
  onClearAddMenuFiles,
  chips,
}: ChatInterfaceProps) {
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [citationsSources, setCitationsSources] = useState<Source[]>([]);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks which attachment IDs already have an active simulation interval
  const simulationCleanups = useRef<Map<string, () => void>>(new Map());

  const { processFiles, removeAttachment: removeOne, FILE_ACCEPT } = useFileUpload();

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

  const { moveToTop } = { moveToTop: onChatMoveToTop ?? (() => {}) };

  // Wrap onChatCreated to mark the new ID as optimistic BEFORE the parent
  // updates the URL/chatId prop — prevents useChatState from wiping messages.
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

  // Start upload-progress simulation for any newly added uploading attachment.
  // Runs whenever the attachment list changes (new IDs appear).
  useEffect(() => {
    const currentIds = new Set(attachments.map((a) => a.id));
    // Cancel simulations for removed attachments
    for (const [id, cancel] of simulationCleanups.current.entries()) {
      if (!currentIds.has(id)) {
        cancel();
        simulationCleanups.current.delete(id);
      }
    }
    // Start simulation for new uploading attachments
    for (const att of attachments) {
      if (att.uploading && !simulationCleanups.current.has(att.id)) {
        const cancel = startUploadSimulation(att.id, att.file.size, setAttachments);
        simulationCleanups.current.set(att.id, cancel);
      }
    }
  }, [attachments]);

  // Cancel all simulations on unmount
  useEffect(() => {
    return () => {
      for (const cancel of simulationCleanups.current.values()) cancel();
    };
  }, []);

  // Auto-send initial prompt on mount (for new chats triggered from landing page)
  const initialPromptSentRef = useRef(false);
  const sendInitialPrompt = useRef<((prompt: string) => void) | null>(null);

  // Store the send function in a ref so it's always current (closes over latest props)
  sendInitialPrompt.current = (prompt: string) => {
    const content = prompt.trim();
    if (content && !chatId) {
      addOptimisticUserMessage(content);
      const loadingId = addLoadingAssistantMessage();
      const files = [...(addMenuFiles ?? [])];
      onClearAddMenuFiles?.();
      fetchAiResponse(content, null, loadingId, selectedModelId, {
        webSearch: webSearchEnabled,
        files: files.length > 0 ? files : undefined,
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
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoadingMessages;
    if (wasLoading && !isLoadingMessages && messages.length > 0) {
      // Use instant scroll — smooth scroll can leave the user mid-thread.
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoadingMessages, messages.length]);

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

  // Absorb add-menu files into local attachments so AttachmentManager shows them
  useEffect(() => {
    if (!addMenuFiles || addMenuFiles.length === 0) return;
    setAttachments((prev) => processFiles(addMenuFiles, prev));
    onClearAddMenuFiles?.();
  }, [addMenuFiles]);

  // Send message — uses local attachments (which include add-menu files after absorption)
  const handleSend = async (text: string) => {
    const allFiles = attachments.map((a) => a.file);
    if (!text.trim() && allFiles.length === 0) return;
    // Block send while files are still simulating upload
    if (attachments.some((a) => a.uploading)) return;

    const content = text.trim();
    addOptimisticUserMessage(content, allFiles.length > 0 ? allFiles : undefined);
    const loadingId = addLoadingAssistantMessage();
    setInputValue("");
    setAttachments([]);
    onClearAddMenuFiles?.();

    try {
      await fetchAiResponse(content, chatId ?? null, loadingId, selectedModelId, {
        webSearch: webSearchEnabled,
        files: allFiles.length > 0 ? allFiles : undefined,
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
    fetchAiResponse(
      lastUserMsg.content,
      chatId ?? null,
      loadingId,
      selectedModelId,
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

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((message, idx) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLast={idx === messages.length - 1}
                isNewMessage={idx === messages.length - 1 && isStreaming}
                chatId={chatId}
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
            ))}
          </AnimatePresence>

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
        <div style={{ width: "100%", maxWidth: "754px" }}>
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
            chips={chips}
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
