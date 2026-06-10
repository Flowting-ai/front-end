"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatAddMenu } from "@/components/chat/AddMenu";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { ChatMessageMemo } from "@/components/chat/ChatMessage";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import { stableKey } from "@/hooks/use-model-selection";
import { useStreamingChat, type StreamState } from "@/hooks/use-streaming-chat";
import type { UIMessage } from "@/hooks/use-chat-state";
import {
  getPersona,
  getVersion,
  listVersions,
  fetchPersonaChatMessages,
  type Persona,
} from "@/lib/api/personas";
import {
  emitPersonaChatCreated,
  emitPersonaChatTitleUpdated,
} from "@/hooks/use-sidebar-events";
import { apiFetch } from "@/lib/api/client";
import { PERSONA_CHAT_STOP_ENDPOINT } from "@/lib/config";
import { logger } from "@/lib/logger";

// ── Props ─────────────────────────────────────────────────────────────────────

/** Extract a clean filename from a URL, stripping query params (which may contain AWS credentials). */
function safeFilenameFromUrl(url: string | undefined): string {
  if (!url) return "file";
  try {
    const pathname = new URL(url).pathname;
    const segment = decodeURIComponent(pathname.split("/").pop() || "");
    // Strip leading UUID prefix if present (e.g. "abc123ef-report.pdf" → "report.pdf")
    const cleaned = segment.replace(/^[0-9a-f]{8,}-/i, "");
    return cleaned || "file";
  } catch {
    // If URL parsing fails, just strip everything after ? and take last segment
    const withoutQuery = url.split("?")[0];
    const segment = decodeURIComponent(withoutQuery.split("/").pop() || "");
    return segment || "file";
  }
}

export interface PersonaChatInterfaceProps {
  personaId: string;
  initialChatId?: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626",
  "#D97706", "#0891B2", "#BE185D", "#65A30D",
];

function PersonaAvatar({ imageUrl, name, size = 32 }: { imageUrl: string | null; name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const rad = size * 0.4;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element
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

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonaChatInterface({
  personaId,
  initialChatId,
}: PersonaChatInterfaceProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(initialChatId);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!initialChatId);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [personaImageUrl, setPersonaImageUrl] = useState<string | null>(null);
  const [latestVersionModelId, setLatestVersionModelId] = useState<string | null>(null);
  // Becomes true once listVersions resolves (or errors) — prevents models[0] being
  // selected as a "default" while the version's model_id is still being fetched.
  const [versionsLoaded, setVersionsLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const justCreatedChatRef = useRef(false);
  const optimisticChatIdsRef = useRef<Set<string>>(new Set());

  const { models, selectModel, selectedModel } = useModelSelectorContext();
  const { processFiles, FILE_ACCEPT } = useFileUpload();

  const selectModelRef = useRef(selectModel);
  selectModelRef.current = selectModel;

  const personaIdRef = useRef(personaId);
  personaIdRef.current = personaId;

  const isStreaming = streamState === "streaming" || streamState === "waiting";

  // ── useStreamingChat — same infrastructure as main chat ───────────────────

  const handleChatCreated = useCallback((chatId: string) => {
    optimisticChatIdsRef.current.add(chatId);
    justCreatedChatRef.current = true;
    setActiveChatId(chatId);
    window.history.replaceState(null, "", `/agents/${personaIdRef.current}/chat?chatId=${chatId}`);
    emitPersonaChatCreated({ personaId: personaIdRef.current, chatId, title: "New chat" });
  }, []);

  const handleTitleUpdate = useCallback((chatId: string, title: string) => {
    emitPersonaChatTitleUpdated({ personaId: personaIdRef.current, chatId, title });
  }, []);

  const handleStopBackend = useCallback((chatId: string) => {
    void apiFetch(PERSONA_CHAT_STOP_ENDPOINT(personaIdRef.current, chatId), { method: "POST" }).catch(() => {});
  }, []);

  const { fetchAiResponse, handleStopGeneration } = useStreamingChat({
    setMessages,
    onChatCreated: handleChatCreated,
    onTitleUpdate: handleTitleUpdate,
    setStreamState,
    endpoint: "/api/persona-chat",
    onStopBackend: handleStopBackend,
  });

  // ── Persona load + model sync ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    // Load persona first (fast — single object) so the name/avatar render
    // immediately, then fire listVersions in parallel for the latest version's
    // connectors/model without blocking the persona display.
    getPersona(personaId).then(p => {
      if (cancelled) return;
      setPersona(p);
      if (p.imageUrl) setPersonaImageUrl(p.imageUrl);
    }).catch(err => logger.error("[PersonaChat] Failed to load persona", err));

    listVersions(personaId).then(versionList => {
      if (cancelled) return;
      // Pick the latest version (highest created_at) — matches how the
      // configure test chat resolves persona configuration.
      const sorted = versionList.slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const latest = sorted[0];

      // Fetch full version for image URL + authoritative model_id.
      // Mark versionsLoaded only after getVersion resolves so the model sync
      // effect always has v.model_id (list items may omit model_id).
      const versionIdToLoad = latest?.id ?? null;
      if (versionIdToLoad) {
        getVersion(personaId, versionIdToLoad)
          .then(v => {
            if (cancelled) return;
            if (v.image_url) setPersonaImageUrl(prev => prev ?? v.image_url);
            if (v.model_id) setLatestVersionModelId(v.model_id);
            setVersionsLoaded(true);
          })
          .catch(() => {
            // getVersion failed — best-effort: use list item's model_id if present
            if (!cancelled) {
              if (latest?.model_id) setLatestVersionModelId(latest.model_id);
              setVersionsLoaded(true);
            }
          });
      } else {
        // No versions — nothing to load; allow model sync to fall back
        if (!cancelled) setVersionsLoaded(true);
      }
    }).catch(() => {
      // listVersions failed — image URL fallback via active version; still mark loaded
      // so the model sync effect can fall back to persona.modelId or models[0].
      if (!cancelled) setVersionsLoaded(true);
      getPersona(personaId).then(p => {
        if (cancelled || !p.activeVersionId) return;
        getVersion(p.id, p.activeVersionId)
          .then(v => {
            if (cancelled) return;
            if (v.image_url) setPersonaImageUrl(prev => prev ?? v.image_url);
          })
          .catch(() => {});
      }).catch(() => {});
    });

    return () => { cancelled = true; };
  }, [personaId]);

  useEffect(() => {
    // Don't select any model until listVersions has resolved — prevents models[0]
    // being picked as a premature "default" while latestVersionModelId is still loading.
    if (!versionsLoaded) return;
    if (!models.length) return;

    // Prefer the latest version's model_id; fall back to the active version's
    // model from the persona object if the version list returned nothing.
    const target = latestVersionModelId ?? persona?.modelId;

    if (!target) {
      // No model stored at all — use first available.
      if (!selectedModel) selectModelRef.current(models[0]);
      return;
    }

    const current = selectedModel
      ? (selectedModel.modelId != null && String(selectedModel.modelId) !== "undefined"
          ? String(selectedModel.modelId)
          : selectedModel.id != null ? String(selectedModel.id) : null)
      : null;
    if (current === target) return;

    // Tier 1 — exact ID match
    const byId = models.find(m =>
      (m.modelId != null && String(m.modelId) !== "undefined" && String(m.modelId) === target) ||
      (m.id      != null && String(m.id)      !== "undefined" && String(m.id)      === target),
    );
    if (byId) { selectModelRef.current(byId); return; }

    // Tier 2 — sessionStorage name+company cache written by the Instructions tab
    try {
      const raw = typeof window !== "undefined"
        ? sessionStorage.getItem(`persona_model_cache_${personaId}`)
        : null;
      if (raw) {
        const cached = JSON.parse(raw) as { modelName?: string; companyName?: string };
        if (cached?.modelName && cached?.companyName) {
          const byName = models.find(
            m => m.modelName === cached.modelName && m.companyName === cached.companyName,
          );
          if (byName) { selectModelRef.current(byName); return; }
        }
      }
    } catch { /* ignore */ }

    // Tier 3 — model no longer offered; fall back to first available
    selectModelRef.current(models[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestVersionModelId, persona?.modelId, models, selectedModel, versionsLoaded, personaId]);

  // ── Load chat history ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialChatId) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    if (justCreatedChatRef.current) {
      justCreatedChatRef.current = false;
      return;
    }

    if (optimisticChatIdsRef.current.has(initialChatId)) {
      optimisticChatIdsRef.current.delete(initialChatId);
      return;
    }

    let cancelled = false;
    setIsLoadingMessages(true);
    setMessages([]);

    fetchPersonaChatMessages(personaId, initialChatId)
      .then(msgs => {
        if (cancelled) return;
        const uiMessages: UIMessage[] = msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content ?? "",
          created_at: m.created_at ?? "",
          chat_id: initialChatId,
          // Map backend file_attachments to UI Attachment objects (user uploads)
          attachments: m.role === "user" && m.file_attachments && m.file_attachments.length > 0
            ? m.file_attachments.map((a, i) => ({
                id: `hist-att-${m.id}-${i}`,
                file_name: a.file_name || a.name || safeFilenameFromUrl(a.file_link),
                file_type: a.mime_type || "application/octet-stream",
                file_size: 0,
                url: a.file_link,
              }))
            : undefined,
          // Map generated file_attachments to generatedFiles (assistant)
          generatedFiles: m.role === "assistant" && m.file_attachments && m.file_attachments.length > 0
            ? m.file_attachments.map(a => ({
                url: a.file_link,
                filename: a.file_name || a.name || safeFilenameFromUrl(a.file_link),
                mimeType: a.mime_type,
              }))
            : undefined,
        }));
        setMessages(uiMessages);
      })
      .catch(err => logger.error("[PersonaChat] Failed to load messages", err))
      .finally(() => { if (!cancelled) setIsLoadingMessages(false); });

    return () => { cancelled = true; };
  }, [personaId, initialChatId]);

  // ── Scroll management ─────────────────────────────────────────────────────

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

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    const filesToSend = attachments.map(a => a.file);

    setInput("");
    setAttachments([]);

    const userMsgId = `optimistic-user-${Date.now()}`;
    const userMsg: UIMessage = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
      chat_id: activeChatId ?? "",
      attachments: filesToSend.length > 0
        ? filesToSend.map((f, i) => ({
            id: `opt-att-${i}-${Date.now()}`,
            file_name: f.name,
            file_type: f.type || "application/octet-stream",
            file_size: f.size,
            uploading: true,
            uploadProgress: 0,
          }))
        : undefined,
    };

    const loadingMsgId = `loading-assistant-${Date.now()}`;
    const loadingMsg: UIMessage = {
      id: loadingMsgId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      chat_id: activeChatId ?? "",
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      await fetchAiResponse(
        trimmed,
        activeChatId ?? null,
        loadingMsgId,
        null,
        {
          files: filesToSend.length > 0 ? filesToSend : undefined,
          userMessageId: userMsgId,
          personaId: personaId,
          onUploadProgress: filesToSend.length > 0 ? (pct) => {
            setMessages(prev => prev.map(msg =>
              msg.id !== userMsgId ? msg : {
                ...msg,
                attachments: msg.attachments?.map(att => ({
                  ...att,
                  uploadProgress: pct,
                  uploading: pct < 100,
                })),
              },
            ));
          } : undefined,
        },
      );
    } catch {
      setMessages(prev => prev.slice(0, prev.length - 2));
    }
  }, [personaId, activeChatId, isStreaming, attachments, fetchAiResponse]);

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

          {isLoadingMessages && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
              <LoadingSpinner size={20} />
            </div>
          )}

          {!isLoadingMessages && messages.length === 0 && (
            <EmptyState persona={persona ? { ...persona, imageUrl: personaImageUrl } : null} />
          )}

          {messages.map((msg, idx) => (
            <ChatMessageMemo
              key={msg.id}
              message={msg}
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
            onStop={handleStopGeneration}
            onFilePaste={(files) => setAttachments((prev) => processFiles(files, prev))}
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
            modelName={selectedModel?.modelName ?? persona?.name ?? ""}
            disabledModelSelector
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