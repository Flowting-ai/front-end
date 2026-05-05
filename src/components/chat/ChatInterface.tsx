"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CitationsPanel } from "./CitationsPanel";
import {
  AttachmentManager,
  type PendingAttachment,
} from "./AttachmentManager";
import { useFileDrop } from "@/hooks/use-file-drop";
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
  /** If provided, ChatInterface auto-sends this message on mount (new chat). */
  initialPrompt?: string | null;
}

export function ChatInterface({
  chatId,
  onChatCreated,
  onTitleUpdate,
  onChatMoveToTop,
  selectedModel,
  selectedModelId,
  onModelClick,
  initialPrompt,
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

  // Auto-send initial prompt on mount (for new chats triggered from landing page)
  const initialPromptSentRef = useRef(false);
  const sendInitialPrompt = useRef<((prompt: string) => void) | null>(null);
  
  // Store the send function in a ref so it's always current
  sendInitialPrompt.current = (prompt: string) => {
    const content = prompt.trim();
    if (content && !chatId) {
      addOptimisticUserMessage(content);
      const loadingId = addLoadingAssistantMessage();
      fetchAiResponse(content, null, loadingId, selectedModelId);
    }
  };

  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      // Use the ref to avoid dependency issues
      sendInitialPrompt.current?.(initialPrompt);
    }
  }, [initialPrompt]);

  // Scroll to bottom on new messages
  const lastMessageContent = messages.length > 0 
    ? messages[messages.length - 1]?.content?.length ?? 0 
    : 0;
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, lastMessageContent]);

  // Scroll-to-top for pagination
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
  };

  // File drop
  const { isDragging } = useFileDrop({
    onFiles: (files) => {
      const newAttachments: PendingAttachment[] = files.map((file) => ({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        uploading: false,
      }));
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 10));
    },
    disabled: isStreaming,
  });

  // Send message
  const handleSend = async (text: string) => {
    if (!text.trim() && attachments.length === 0) return;

    const content = text.trim();
    addOptimisticUserMessage(content);
    const loadingId = addLoadingAssistantMessage();
    setInputValue("");
    setAttachments([]);

    try {
      await fetchAiResponse(content, chatId ?? null, loadingId, selectedModelId);
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

    // Remove the last assistant message
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

  // Attachment add
  const handleAdd = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newAttachments: PendingAttachment[] = files.map((file) => ({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        uploading: false,
      }));
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 10));
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
          {messages.map((message, idx) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLast={idx === messages.length - 1}
              isNewMessage={
                idx === messages.length - 1 && isStreaming
              }
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
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div style={{ width: "100%", maxWidth: "674px", marginBottom: "8px" }}>
            <AttachmentManager
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={isStreaming}
            />
          </div>
        )}

        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={handleStopGeneration}
          onAdd={handleAdd}
          onModelClick={onModelClick}
          modelName={selectedModel ?? "Souvenir"}
          isStreaming={isStreaming}
          disabled={isStreaming}
          placeholder="How can I help you today?"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,.docx,text/plain,image/png,image/jpeg,image/webp"
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
