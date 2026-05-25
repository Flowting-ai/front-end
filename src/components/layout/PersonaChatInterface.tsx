"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderOneIcon, GlobalSearchIcon, QuillWriteTwoIcon } from "@strange-huge/icons";
import { Chip } from "@/components/Chip";
import { Dropdown } from "@/components/Dropdown";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatAddMenu, USE_STYLE_OPTIONS } from "@/components/chat/AddMenu";
import { ModelMenu, useModelButtonLabel } from "@/components/chat/ModelMenu";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { ChatMessageMemo } from "@/components/chat/ChatMessage";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { UIMessage } from "@/hooks/use-chat-state";
import type { PinFolder } from "@/lib/api/pins";
import {
  getPersona,
  fetchPersonaChatMessages,
  createAndStreamPersonaChat,
  streamPersonaMessage,
  type Persona,
} from "@/lib/api/personas";
import {
  emitPersonaChatCreated,
  emitPersonaChatTitleUpdated,
} from "@/hooks/use-sidebar-events";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocalMessage {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  isStreaming?: boolean;
}

export interface PersonaChatInterfaceProps {
  personaId:      string;
  initialChatId?: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626",
  "#D97706", "#0891B2", "#BE185D", "#65A30D",
];

function PersonaAvatar({ imageUrl, name, size = 32 }: { imageUrl: string | null; name: string; size?: number }) {
  const bg  = AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const rad = size * 0.4;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic user-uploaded avatar URL
      <img src={imageUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, display: "block" }} />
    );
  }

  return (
    <div
      aria-hidden
      style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: rad, userSelect: "none" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ persona }: { persona: Persona | null }) {
  if (!persona) {
    return (
      <div style={{ flex: "1 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner size={24} />
      </div>
    );
  }

  return (
    <div style={{ flex: "1 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "60px 32px", textAlign: "center" }}>
      <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} size={80} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 24, lineHeight: "32px", color: "var(--neutral-900)" }}>
          {persona.name}
        </p>
        {persona.description && (
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: "var(--font-weight-regular)", fontSize: "var(--font-size-body)", lineHeight: "var(--line-height-body)", color: "var(--neutral-500)" }}>
            {persona.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── LocalMessage → UIMessage adapter ─────────────────────────────────────────

function toUIMessage(msg: LocalMessage, chatId: string): UIMessage {
  return {
    id:         msg.id,
    role:       msg.role,
    content:    msg.content ?? "",
    created_at: "",
    chat_id:    chatId,
    isLoading:  msg.isStreaming,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonaChatInterface({
  personaId,
  initialChatId,
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
}: PersonaChatInterfaceProps) {
  const [persona,           setPersona]           = useState<Persona | null>(null);
  const [messages,          setMessages]          = useState<LocalMessage[]>([]);
  // eslint-disable-next-line react-doctor/no-derived-useState, react-doctor/rerender-state-only-in-handlers
  const [activeChatId,      setActiveChatId]      = useState<string | undefined>(initialChatId);
  const [input,             setInput]             = useState("");
  const [isStreaming,       setIsStreaming]        = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!initialChatId);

  // ── Add-menu feature state ────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedStyleId,  setSelectedStyleId]  = useState<string | null>(null);
  const [styleChipOpen,    setStyleChipOpen]    = useState(false);
  const [selectedFolders,  setSelectedFolders]  = useState<PinFolder[]>([]);
  const [attachments,      setAttachments]      = useState<PendingAttachment[]>([]);

  const fileInputRef         = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const abortRef             = useRef<(() => void) | null>(null);
  const streamContentRef     = useRef("");

  const { open: openModelSelector, models, selectModel } = useModelSelectorContext();
  const { processFiles, FILE_ACCEPT } = useFileUpload();
  const modelButtonLabel = useModelButtonLabel();

  const selectModelRef = useRef(selectModel);
  selectModelRef.current = selectModel;

  // ── Persona load + model sync ─────────────────────────────────────────────

  useEffect(() => {
    getPersona(personaId).then(setPersona).catch(console.error);
  }, [personaId]);

  useEffect(() => {
    if (!persona?.modelId || !models.length) return;
    const match = models.find(m => String(m.modelId ?? m.id) === persona.modelId);
    if (match) selectModelRef.current(match);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.modelId, models]);

  // ── Load history ──────────────────────────────────────────────────────────

  // eslint-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (!initialChatId) return;
    setIsLoadingMessages(true);
    fetchPersonaChatMessages(personaId, initialChatId)
      .then(msgs => setMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content ?? "" }))))
      .catch(console.error)
      .finally(() => setIsLoadingMessages(false));
  }, [personaId, initialChatId]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────

  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoadingMessages;
    if (wasLoading && !isLoadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoadingMessages, messages.length]);

  const lastMsgContent = messages.length > 0 ? messages[messages.length - 1]?.content?.length ?? 0 : 0;
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0 && isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isStreaming, messages.length, lastMsgContent, isLoadingMessages]);

  useEffect(() => () => { abortRef.current?.(); }, []);

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    setAttachments([]);

    const userMsgId      = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;
    streamContentRef.current = "";

    setMessages(prev => [
      ...prev,
      { id: userMsgId,      role: "user",      content: trimmed },
      { id: assistantMsgId, role: "assistant",  content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    const currentChatId = activeChatId;

    const callbacks = {
      onChatId: (chatId: string) => {
        setActiveChatId(chatId);
        window.history.replaceState(null, "", `/personas/${personaId}/chat?chatId=${chatId}`);
        emitPersonaChatCreated({ personaId, chatId, title: trimmed.slice(0, 80) });
      },
      onChunk: (delta: string) => {
        streamContentRef.current += delta;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + delta } : m));
      },
      onDone: () => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, isStreaming: false } : m));
        setIsStreaming(false);
        abortRef.current = null;
        if (streamContentRef.current && activeChatId) {
          emitPersonaChatTitleUpdated({ personaId, chatId: activeChatId, title: streamContentRef.current.slice(0, 80) });
        }
        streamContentRef.current = "";
      },
      onError: (err: string) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `Something went wrong: ${err}`, isStreaming: false } : m));
        setIsStreaming(false);
        abortRef.current = null;
      },
    };

    try {
      const abort = currentChatId
        ? await streamPersonaMessage(personaId, currentChatId, trimmed, callbacks)
        : await createAndStreamPersonaChat(personaId, trimmed, callbacks);
      abortRef.current = abort;
    } catch {
      setIsStreaming(false);
    }
  }, [personaId, activeChatId, isStreaming]);

  const handleStop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    setIsStreaming(false);
  }, []);

  // ── Chips ─────────────────────────────────────────────────────────────────

  const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null;

  const chips = useMemo(() => (
    <>
      {activeStyle && (
        <Dropdown.Float open={styleChipOpen} onOpenChange={setStyleChipOpen} placement="top-start"
          trigger={
            <Chip
              label={activeStyle.label}
              icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
              onRemove={() => setSelectedStyleId(null)}
              onExpand={() => setStyleChipOpen(v => !v)}
            />
          }
        >
          <Dropdown size="md">
            <Dropdown.Section fluid>
              {USE_STYLE_OPTIONS.map(opt => (
                <Dropdown.Item
                  key={opt.id} label={opt.label} subLabel={opt.subLabel} fluid
                  selected={opt.id === "none" ? selectedStyleId === null : selectedStyleId === opt.id}
                  onClick={() => { setSelectedStyleId(opt.id === "none" ? null : opt.id); setStyleChipOpen(false); }}
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      )}
      {selectedFolders.map(folder => (
        <Chip key={folder.id} label={folder.name} icon={<FolderOneIcon size={20} color="var(--chip-text)" />}
          onRemove={() => setSelectedFolders(prev => prev.filter(f => f.id !== folder.id))} />
      ))}
      {webSearchEnabled && (
        <Chip size="Medium" icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />} label="Web search" onRemove={() => setWebSearchEnabled(false)} />
      )}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [activeStyle, styleChipOpen, selectedFolders, webSearchEnabled, selectedStyleId]);

  const chatId = activeChatId ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", position: "relative" }}>

      {/* ── Messages area ── */}
      <div
        ref={messagesContainerRef}
        className="kaya-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div style={{ width: "100%", maxWidth: "720px" }}>

          {/* Loading spinner while fetching history */}
          {isLoadingMessages && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
              <LoadingSpinner size={20} />
            </div>
          )}

          {/* Empty state */}
          {!isLoadingMessages && messages.length === 0 && (
            <EmptyState persona={persona} />
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <ChatMessageMemo
              key={msg.id}
              message={toUIMessage(msg, chatId)}
              isLast={idx === messages.length - 1}
              isNewMessage={idx === messages.length - 1 && isStreaming}
              chatId={chatId || undefined}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "754px", position: "relative" }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                setAttachments(prev => processFiles(Array.from(e.target.files!), prev));
                e.target.value = "";
              }
            }}
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            disabled={isStreaming}
            placeholder={`Message ${persona?.name || "persona"}…`}
            modelName={modelButtonLabel}
            onModelClick={e => openModelSelector(e.currentTarget)}
            addMenu={
              <ChatAddMenu
                webSearchEnabled={webSearchEnabled}
                onWebSearchChange={setWebSearchEnabled}
                onAddFilesClick={() => fileInputRef.current?.click()}
                selectedStyleId={selectedStyleId}
                onStyleChange={setSelectedStyleId}
                selectedFolders={selectedFolders}
                onFolderToggle={folder => setSelectedFolders(prev =>
                  prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
                )}
                selectedPersonaId={null}
                onPersonaChange={() => {}}
                hidePersona
              />
            }
            modelMenu={<ModelMenu />}
            chips={chips}
            attachmentsSlot={
              <AttachmentManager
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={isStreaming}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
