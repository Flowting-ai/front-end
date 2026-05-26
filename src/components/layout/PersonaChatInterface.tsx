"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatAddMenu } from "@/components/chat/AddMenu";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { ChatMessageMemo } from "@/components/chat/ChatMessage";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { UIMessage } from "@/hooks/use-chat-state";
import {
  getPersona,
  getVersion,
  fetchPersonaChatMessages,
  createAndStreamPersonaChat,
  streamPersonaMessage,
  type Persona,
  type PersonaChatStreamCallbacks,
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
  reasoning_sections?: Array<{ heading: string; body: string }>;
  attachments?: Array<{ file_name: string; mime_type: string; url?: string }>;
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
    id:                 msg.id,
    role:               msg.role,
    content:            msg.content ?? "",
    created_at:         "",
    chat_id:            chatId,
    isLoading:          msg.isStreaming,
    reasoning_sections: msg.reasoning_sections,
    file_attachments:   msg.attachments?.map(a => ({
      file_name: a.file_name,
      mime_type: a.mime_type,
      file_link: a.url,
      origin:    "uploaded",
    })),
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

  const [attachments,       setAttachments]       = useState<PendingAttachment[]>([]);
  const [webSearchEnabled,  setWebSearchEnabled]  = useState(false);
  const [selectedStyleId,   setSelectedStyleId]   = useState<string | null>(null);
  // Persona avatar image URL — falls back to fetching the active version when
  // the repo detail endpoint doesn't embed active_version.image_url.
  const [personaImageUrl,   setPersonaImageUrl]   = useState<string | null>(null);

  const fileInputRef         = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const abortRef             = useRef<(() => void) | null>(null);
  const streamContentRef     = useRef("");
  // Set to true inside onChatId so the history-loading effect knows to skip
  // reloading when the component itself just created the chat.
  const justCreatedChatRef   = useRef(false);

  const { models, selectModel, selectedModel } = useModelSelectorContext();
  const { processFiles, FILE_ACCEPT } = useFileUpload();

  const selectModelRef = useRef(selectModel);
  selectModelRef.current = selectModel;

  // ── Persona load + model sync ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    getPersona(personaId).then(p => {
      if (cancelled) return;
      setPersona(p);
      if (p.imageUrl) {
        setPersonaImageUrl(p.imageUrl);
      } else if (p.activeVersionId) {
        // Active version may not be embedded in the repo detail response —
        // fetch it separately to retrieve the profile avatar image.
        getVersion(p.id, p.activeVersionId)
          .then(v => { if (!cancelled && v.image_url) setPersonaImageUrl(v.image_url); })
          .catch(() => {});
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [personaId]);

  // Force the model selector to reflect the persona's active model. We watch
  // `selectedModel` too so any other code path that flips the selection (e.g.
  // useModelSelection restoring from localStorage after we already synced)
  // gets corrected on the next render.
  useEffect(() => {
    const target = persona?.modelId;
    if (!target || !models.length) return;
    const current = selectedModel ? String(selectedModel.modelId ?? selectedModel.id) : null;
    if (current === target) return;
    const match = models.find(m => String(m.modelId ?? m.id) === target);
    if (match) selectModelRef.current(match);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.modelId, models, selectedModel]);

  // ── Load history ──────────────────────────────────────────────────────────

  // eslint-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (!initialChatId) return;
    // When this component creates a new chat, onChatId fires and calls
    // window.history.replaceState — Next.js router updates useSearchParams,
    // which changes initialChatId from undefined to the new id and re-triggers
    // this effect. In that case we must NOT reload because streaming is already
    // in progress and the messages are already in local state.
    if (justCreatedChatRef.current) {
      justCreatedChatRef.current = false;
      return;
    }
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
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    const filesToSend = attachments.map(a => a.file);

    setInput("");
    setAttachments([]);

    const userMsgId      = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;
    let resolvedAssistantId = assistantMsgId;
    streamContentRef.current = "";

    setMessages(prev => [
      ...prev,
      {
        id:          userMsgId,
        role:        "user",
        content:     trimmed,
        attachments: filesToSend.length > 0
          ? filesToSend.map(f => ({ file_name: f.name, mime_type: f.type }))
          : undefined,
      },
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true },
    ]);
    setIsStreaming(true);

    const currentChatId = activeChatId;
    // Tracks the live chatId for this send session (undefined on first send of a
    // new chat, then updated synchronously inside onChatId before onTitle fires).
    let resolvedChatId = currentChatId;

    // Accumulator for streaming reasoning sections; mutated in place and the
    // section list is re-snapshotted into setMessages on every delta so React
    // sees a new array reference each time.
    const reasoningSectionsRef: Array<{ heading: string; body: string }> = [];
    let currentReasoning: { heading: string; body: string } | null = null;
    const flushReasoning = () => {
      const snapshot = currentReasoning
        ? [...reasoningSectionsRef, { ...currentReasoning }]
        : [...reasoningSectionsRef];
      setMessages(prev => prev.map(m =>
        m.id === resolvedAssistantId ? { ...m, reasoning_sections: snapshot } : m,
      ));
    };

    const callbacks: PersonaChatStreamCallbacks = {
      onChatId: (chatId: string) => {
        resolvedChatId = chatId; // update immediately so onTitle sees the real id
        justCreatedChatRef.current = true; // tell history effect not to reload
        setActiveChatId(chatId);
        window.history.replaceState(null, "", `/personas/${personaId}/chat?chatId=${chatId}`);
        emitPersonaChatCreated({ personaId, chatId, title: trimmed.slice(0, 80) || "New chat" });
      },
      onChunk: (delta: string) => {
        if (currentReasoning) {
          reasoningSectionsRef.push(currentReasoning);
          currentReasoning = null;
        }
        streamContentRef.current += delta;
        setMessages(prev => prev.map(m =>
          m.id === resolvedAssistantId ? { ...m, content: m.content + delta } : m,
        ));
      },
      onReasoningHeading: (heading: string) => {
        if (currentReasoning) reasoningSectionsRef.push(currentReasoning);
        currentReasoning = { heading, body: "" };
        flushReasoning();
      },
      onReasoningBody: (delta: string) => {
        if (!currentReasoning) currentReasoning = { heading: "Reasoning", body: "" };
        currentReasoning.body += delta;
        flushReasoning();
      },
      onReasoning: (delta: string) => {
        if (!currentReasoning) currentReasoning = { heading: "Reasoning", body: "" };
        currentReasoning.body += delta;
        flushReasoning();
      },
      onMessageSaved: (messageId: string) => {
        const oldId = resolvedAssistantId;
        resolvedAssistantId = messageId;
        setMessages(prev => prev.map(m => m.id === oldId ? { ...m, id: messageId } : m));
      },
      onTitle: (title: string) => {
        if (resolvedChatId) emitPersonaChatTitleUpdated({ personaId, chatId: resolvedChatId, title });
      },
      onDone: () => {
        setMessages(prev => prev.map(m =>
          m.id === resolvedAssistantId ? { ...m, isStreaming: false } : m,
        ));
        setIsStreaming(false);
        abortRef.current = null;
        streamContentRef.current = "";
      },
      onError: (err: string) => {
        setMessages(prev => prev.map(m =>
          m.id === resolvedAssistantId
            ? { ...m, content: `Something went wrong: ${err}`, isStreaming: false }
            : m,
        ));
        setIsStreaming(false);
        abortRef.current = null;
      },
    };

    const options = filesToSend.length > 0 ? { files: filesToSend } : undefined;

    // Safety net: if neither onDone nor onError fires (e.g. proxy stalls,
    // unawaited rejection), reset the streaming UI after 90s so the input
    // can't get stuck disabled.
    const stallTimer = setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === resolvedAssistantId && m.isStreaming
          ? { ...m, isStreaming: false, content: m.content || "(no response — request timed out)" }
          : m,
      ));
      setIsStreaming(false);
      abortRef.current?.();
      abortRef.current = null;
    }, 90_000);
    // Clear the timer once either terminal callback fires.
    const baseOnDone = callbacks.onDone!;
    const baseOnError = callbacks.onError!;
    callbacks.onDone = (payload) => { clearTimeout(stallTimer); baseOnDone(payload); };
    callbacks.onError = (err) => { clearTimeout(stallTimer); baseOnError(err); };

    try {
      const abort = currentChatId
        ? await streamPersonaMessage(personaId, currentChatId, trimmed, callbacks, options)
        : await createAndStreamPersonaChat(personaId, trimmed, callbacks, options);
      abortRef.current = abort;
    } catch (err) {
      clearTimeout(stallTimer);
      console.error("[PersonaChat] stream call failed", err);
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setMessages(prev => prev.map(m =>
        m.id === resolvedAssistantId
          ? { ...m, content: `Something went wrong: ${msg}`, isStreaming: false }
          : m,
      ));
      setIsStreaming(false);
    }
  }, [personaId, activeChatId, isStreaming, attachments]);

  const handleStop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    setIsStreaming(false);
  }, []);

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
            <EmptyState persona={persona ? { ...persona, imageUrl: personaImageUrl } : null} />
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <ChatMessageMemo
              key={msg.id}
              message={toUIMessage(msg, chatId)}
              isLast={idx === messages.length - 1}
              isNewMessage={idx === messages.length - 1 && isStreaming}
              chatId={chatId || undefined}
              hidePinAction
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
            addMenu={
              <ChatAddMenu
                webSearchEnabled={webSearchEnabled}
                onWebSearchChange={setWebSearchEnabled}
                onAddFilesClick={() => fileInputRef.current?.click()}
                selectedStyleId={selectedStyleId}
                onStyleChange={setSelectedStyleId}
                selectedFolders={[]}
                onFolderToggle={() => {}}
                selectedPersonaId={null}
                onPersonaChange={() => {}}
                hidePersona
                hidePinFolders
              />
            }
            hideModelSelector
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
