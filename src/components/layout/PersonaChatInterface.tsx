"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatAddMenu } from "@/components/chat/AddMenu";
import { AttachmentManager, type PendingAttachment } from "@/components/chat/AttachmentManager";
import { ChatMessageMemo } from "@/components/chat/ChatMessage";
import { ChatMessagesSkeleton } from "@/components/chat/ChatMessagesSkeleton";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useModelSelectorContext } from "@/context/model-selector-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import { stableKey } from "@/hooks/use-model-selection";
import { useStreamingChat, type StreamState } from "@/hooks/use-streaming-chat";
import type { UIMessage } from "@/hooks/use-chat-state";
import {
  getPersona,
  getVersion,
  fetchPersonaChatMessages,
  type Persona,
} from "@/lib/api/personas";
import {
  emitPersonaChatCreated,
  emitPersonaChatTitleUpdated,
} from "@/hooks/use-sidebar-events";
import { apiFetch } from "@/lib/api/client";
import { fetchAllModels } from "@/lib/api/models";
import {
  PERSONA_CHAT_STOP_ENDPOINT,
  PERSONA_CHATS_CREATE_ENDPOINT,
  PERSONA_CHAT_STREAM_ENDPOINT,
} from "@/lib/config";
import { getStreamCompletion, consumeInterruptedStreamMarker } from "@/lib/stream-registry";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { useCreditStatus } from "@/hooks/use-credit-status";
import { CreditStatusBanner } from "@/components/CreditStatusBanner";

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
      // eslint-disable-next-line @next/next/no-img-element
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

function EmptyState({ persona, error }: { persona: Persona | null; error?: string | null }) {
  if (error) {
    return (
      <div style={{ flex: "1 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "60px 32px", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "var(--color-tag-Red-bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "var(--color-tag-Red-text)", display: "block" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 400 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-title)", fontWeight: 400, fontSize: 20, lineHeight: "28px", color: "var(--neutral-900)" }}>
            Agent unavailable
          </p>
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontWeight: "var(--font-weight-regular)", fontSize: "var(--font-size-body)", lineHeight: "var(--line-height-body)", color: "var(--neutral-500)" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

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
  const [activeVersionModelId, setActiveVersionModelId] = useState<string | null>(null);
  // Becomes true once the active version resolves (or errors) — prevents models[0]
  // being selected as a "default" while the version's model_id is still being fetched.
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  // Set when the persona fails to load (404, 409, network error, etc.).
  const [personaLoadError, setPersonaLoadError] = useState<string | null>(null);
  // Set when the agent's configured model is blocked/disabled — stores the display
  // name (or ID) of the unavailable model so a notice can be shown to the user.
  const [unavailableModelName, setUnavailableModelName] = useState<string | null>(null);
  // Set when the model is specifically disabled in Settings (blocked=true) — distinct
  // from unavailableModelName which covers models that have been retired entirely.
  // When set, the chat input is blocked and the user is guided to fix the config.
  const [disabledModelName, setDisabledModelName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTopMessageIdRef = useRef<string | null>(null);
  const justCreatedChatRef = useRef(false);
  const optimisticChatIdsRef = useRef<Set<string>>(new Set());

  const { models, selectModel, selectedModel } = useModelSelectorContext();
  const { processFiles, FILE_ACCEPT } = useFileUpload();

  const selectModelRef = useRef(selectModel);
  selectModelRef.current = selectModel;

  // Ref so handleSend always reads the latest resolved model without being
  // recreated on every model change (selectedModel is not in handleSend's deps).
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

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
    directEndpoints: {
      create: PERSONA_CHATS_CREATE_ENDPOINT(personaId),
      stream: (chatId) => PERSONA_CHAT_STREAM_ENDPOINT(personaId, chatId),
    },
    onStopBackend: handleStopBackend,
    // Persona model is pre-seeded from the agent's configured version; ignore
    // backend model_selected events so the correct name/logo always shows.
    skipModelSelected: true,
  });

  // ── Persona load + model sync ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    // Load persona first (fast — single object) so the name/avatar render
    // immediately, then fetch the ACTIVE version for the authoritative model_id
    // and image. The chat must use the repo's active version — not the latest
    // by date — so the model here always matches what the backend will run.
    getPersona(personaId).then(p => {
      if (cancelled) return;
      setPersona(p);
      if (p.imageUrl) setPersonaImageUrl(p.imageUrl);

      if (!p.activeVersionId) {
        // No active version — allow model sync to fall back to persona.modelId / models[0].
        setVersionsLoaded(true);
        return;
      }
      getVersion(personaId, p.activeVersionId)
        .then(v => {
          if (cancelled) return;
          if (v.image_url) setPersonaImageUrl(prev => prev ?? v.image_url);
          if (v.model_id) setActiveVersionModelId(v.model_id);
          setVersionsLoaded(true);
        })
        .catch(() => {
          // getVersion failed — persona.modelId (active version's model from the
          // repo object) remains the fallback in the model sync effect.
          if (!cancelled) setVersionsLoaded(true);
        });
    }).catch(err => {
      logger.error("[PersonaChat] Failed to load persona", err);
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : "This agent isn't available.";
        setPersonaLoadError(msg);
        setVersionsLoaded(true);
      }
    });

    return () => { cancelled = true; };
  }, [personaId]);

  useEffect(() => {
    // Don't select any model until the active version has resolved — prevents
    // models[0] being picked as a premature "default" while it is still loading.
    if (!versionsLoaded) return;
    if (!models.length) return;

    // Prefer the active version's model_id; fall back to the model from the
    // persona object (also the active version's) if getVersion failed.
    const target = activeVersionModelId ?? persona?.modelId;

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
    if (byId) { setUnavailableModelName(null); setDisabledModelName(null); selectModelRef.current(byId); return; }

    // Tier 2 — sessionStorage name+company cache written by the Instructions tab
    let cachedModelName: string | undefined;
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
          if (byName) { setUnavailableModelName(null); setDisabledModelName(null); selectModelRef.current(byName); return; }
          cachedModelName = cached.modelName;
        }
      }
    } catch { /* ignore */ }

    // Tier 3 — model not in the available (non-blocked) list.
    // Check the full model list (including blocked) to distinguish between a model that the
    // user disabled in Settings vs one that has been retired entirely. Disabled models block
    // the chat and prompt the user to fix the config; retired models fall back silently.
    const displayName = cachedModelName ?? target;
    selectModelRef.current(models[0]);
    let cancelled = false;
    void fetchAllModels().then(all => {
      if (cancelled) return;
      const found = all.find(m => m.model_id === target);
      if (found?.blocked) {
        setDisabledModelName(displayName);
        setUnavailableModelName(null);
      } else {
        setUnavailableModelName(displayName);
        setDisabledModelName(null);
      }
    }).catch(() => {
      if (cancelled) return;
      setUnavailableModelName(displayName);
      setDisabledModelName(null);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersionModelId, persona?.modelId, models, selectedModel, versionsLoaded, personaId]);

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

    const loadHistory = () => fetchPersonaChatMessages(personaId, initialChatId)
      .then(msgs => {
        if (cancelled) return;
        // Snapshot model at callback time — selectedModelRef is always current,
        // so if the model resolved before history finished loading, we apply it
        // immediately rather than relying on the patch effect firing later.
        const model = selectedModelRef.current;
        const modelPatch = model ? {
          modelName: model.modelName,
          modelMeta: { modelId: stableKey(model) ?? "", modelName: model.modelName, company: model.companyName },
        } : {};
        const uiMessages: UIMessage[] = msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content ?? "",
          created_at: m.created_at ?? "",
          chat_id: initialChatId,
          // Seed model info on assistant messages so name/logo show on reload.
          ...(m.role === "assistant" ? modelPatch : {}),
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
        // If a stream for this chat was still running when the tab last saw
        // it (i.e. the page reloaded/crashed mid-generation), reinterpret the
        // interrupted turn as "Generation stopped" instead of it silently
        // looking finished — or, if nothing was saved yet, showing nothing.
        if (consumeInterruptedStreamMarker(initialChatId)) {
          const last = uiMessages[uiMessages.length - 1];
          if (last && last.role === "assistant") {
            uiMessages[uiMessages.length - 1] = {
              ...last,
              isLoading: false,
              stoppedByUser: true,
              content: last.content || "Generation stopped.",
            };
          } else {
            uiMessages.push({
              id: `interrupted-${Date.now()}`,
              role: "assistant",
              content: "Generation stopped.",
              created_at: new Date().toISOString(),
              chat_id: initialChatId,
              isLoading: false,
              stoppedByUser: true,
            });
          }
        }
        setMessages(uiMessages);
      })
      .catch(err => {
        logger.error("[PersonaChat] Failed to load messages", err);
        toast.error(err instanceof Error ? err.message : "Failed to load messages");
      })
      .finally(() => { if (!cancelled) setIsLoadingMessages(false); });

    // If a background stream is still running for this chat (the user navigated
    // away while it was generating), wait for it to finish before reloading from
    // the API so the complete response is shown instead of a partial/stale one.
    const pendingStream = getStreamCompletion(initialChatId);
    if (pendingStream) {
      // Cap the wait at 90s so a hung stream never blocks the UI indefinitely.
      const streamTimeout = new Promise<void>((resolve) => setTimeout(resolve, 90_000));
      void Promise.race([pendingStream, streamTimeout]).then(() => {
        if (!cancelled) void loadHistory();
      });
    } else {
      void loadHistory();
    }

    return () => { cancelled = true; };
  }, [personaId, initialChatId]);

  // Warn before a full page reload/close while a stream is active so the user
  // doesn't accidentally lose a response that's still being generated.
  useEffect(() => {
    if (!isStreaming) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // pagehide fires right before the page tears down, even after the user
    // confirms the beforeunload dialog above — abort the in-flight request
    // immediately so the backend notices the disconnect and saves whatever
    // partial content exists right away instead of racing the reload.
    const handlePageHide = () => {
      handleStopGeneration();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isStreaming, handleStopGeneration]);

  // ── Scroll management ─────────────────────────────────────────────────────

  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoadingMessages;
    if (wasLoading && !isLoadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoadingMessages, messages.length]);

  useEffect(() => {
    if (!isStreaming) {
      streamingTopMessageIdRef.current = null;
      return;
    }
    if (isLoadingMessages || messages.length === 0) return;

    const message = [...messages].reverse().find((m) => m.role === "assistant");
    if (!message || streamingTopMessageIdRef.current === message.id) return;

    streamingTopMessageIdRef.current = message.id;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }, [isStreaming, messages, isLoadingMessages]);

  // ── Patch model info onto messages that don't have it ────────────────────
  // Covers two cases:
  //   1. Reload: historical messages loaded before selectedModel resolves.
  //   2. New message: loadingMsg was created before model sync completed.
  // Runs whenever selectedModel changes; skips messages that already have info.
  useEffect(() => {
    if (!selectedModel) return;
    const { modelName, companyName } = selectedModel;
    const modelId = stableKey(selectedModel) ?? "";
    setMessages(prev => {
      const needsPatch = prev.some(m => m.role === "assistant" && !m.modelName && !m.modelMeta);
      if (!needsPatch) return prev;
      return prev.map(m => {
        if (m.role !== "assistant" || m.modelName || m.modelMeta) return m;
        return { ...m, modelName, modelMeta: { modelId, modelName, company: companyName } };
      });
    });
  }, [selectedModel]);

  // Permission-prompt answers live on the message, not in card-local state —
  // otherwise the message_saved id swap remounts the row and resurrects
  // already-answered cards.
  const handlePromptDecided = useCallback((messageId: string, requestId: string, decision: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? {
            ...msg,
            connectorPermissionPrompts: msg.connectorPermissionPrompts?.map(p =>
              p.request_id === requestId ? { ...p, decision } : p,
            ),
          }
        : msg,
    ));
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  // Individual credit/topup status — warning banner + hard send-gate.
  const creditStatus = useCreditStatus();
  // A Super Link agent (source_share_id set) is billed to the SHARER's credit
  // pool, not this user's balance — the backend's require_persona_budget preflight
  // resolves the sharer for this /persona/{repoId}/chats path. So the individual
  // exhaustion hard-stop must not apply when chatting with a share-funded agent.
  const shareFunded = !!persona?.sourceShareId;
  const sendBlocked = (creditStatus.blocked && !shareFunded) || !!personaLoadError || !!disabledModelName;

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    // Hard-stop backstop: an exhausted credit/topup user cannot send. The input is
    // already disabled and the CreditStatusBanner explains why, so block silently.
    // Share-funded (Super Link) agents bill the sharer, so they bypass this gate.
    if (sendBlocked) return;

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
      // Seed model info from the resolved persona model so the reasoning block
      // shows the correct name/logo immediately. model_selected SSE events will
      // overwrite this if the backend emits them.
      // Use selectedModelRef (not selectedModel) — handleSend's closure is stale.
      ...(selectedModelRef.current ? {
        modelName: selectedModelRef.current.modelName,
        modelMeta: {
          modelId: stableKey(selectedModelRef.current) ?? "",
          modelName: selectedModelRef.current.modelName,
          company: selectedModelRef.current.companyName,
        },
      } : {}),
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
  }, [personaId, activeChatId, isStreaming, attachments, fetchAiResponse, sendBlocked]);

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

          {isLoadingMessages && <ChatMessagesSkeleton />}

          {!isLoadingMessages && messages.length === 0 && (
            <EmptyState
              persona={persona ? { ...persona, imageUrl: personaImageUrl } : null}
              error={personaLoadError}
            />
          )}

          {messages.map((msg, idx) => (
            <ChatMessageMemo
              key={msg.id}
              message={msg}
              isLast={idx === messages.length - 1}
              isNewMessage={idx === messages.length - 1 && isStreaming}
              chatId={chatId || undefined}
              hidePinAction
              disableHighlight
              onPromptDecided={handlePromptDecided}
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
          {disabledModelName && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 10,
              backgroundColor: "var(--color-tag-Red-bg-soft)",
              border: "1px solid var(--color-tag-Red-text)",
              marginBottom: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--color-tag-Red-text)", flexShrink: 0, marginTop: 7 }} />
              <p style={{ flex: "1 0 0", minWidth: 0, margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 13, lineHeight: "20px", color: "var(--color-tag-Red-text)" }}>
                The <strong>{disabledModelName}</strong> model assigned to this agent is disabled.{" "}
                {!persona?.sourceShareId
                  ? (<>To continue, <a href={`/agent/configure/instructions?repoId=${personaId}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>assign an enabled model</a> in the agent configure page, or <a href="/settings/ai" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>enable it in Settings</a>.</>)
                  : (<><a href="/settings/ai" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>Enable it in Settings</a> to continue.</>)
                }
              </p>
            </div>
          )}
          {unavailableModelName && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 10,
              backgroundColor: "var(--color-tag-Yellow-bg-soft)",
              border: "1px solid var(--color-tag-Yellow-text)",
              marginBottom: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--color-tag-Yellow-text)", flexShrink: 0 }} />
              <p style={{ flex: "1 0 0", minWidth: 0, margin: 0, fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 13, lineHeight: "20px", color: "var(--color-tag-Yellow-text)" }}>
                {`The ${unavailableModelName} model is no longer available. This agent is using ${selectedModel?.modelName ?? "an available model"} instead.`}
              </p>
            </div>
          )}
          <CreditStatusBanner suppress={shareFunded || !!personaLoadError} />
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStopGeneration}
            onFilePaste={(files) => setAttachments((prev) => processFiles(files, prev))}
            hasAttachments={attachments.length > 0}
            isStreaming={isStreaming}
            disabled={isStreaming || sendBlocked}
            placeholder={
              personaLoadError
                ? "This agent is unavailable."
                : disabledModelName
                  ? "Model disabled — update the agent config to continue."
                  : creditStatus.blocked && !shareFunded
                    ? "Credits exhausted. Buy a top-up to continue."
                    : `Message ${persona?.name || "agent"}…`
            }
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
