"use client";

/**
 * useStreamingChat — encapsulates the full SSE (Server-Sent Events) streaming
 * response loop that was previously embedded inside `chat-interface.tsx`.
 *
 * Responsibilities:
 *   - Owns `messageBufferRef`, `abortControllerRef`, `stopRequestedRef`.
 *   - Exposes `fetchAiResponse` — builds the request body, opens the SSE
 *     stream, parses all event types, and applies RAF-batched message updates.
 *   - Exposes `handleStopGeneration` — aborts the current stream and marks the
 *     interrupted message as stopped.
 *
 * NOT in scope:
 *   - UI/interaction state (owned by `useChatState`).
 *   - Sending a new message (orchestrated by `handleSend` in the component).
 *   - Regeneration / delete / pin logic (remain in component until Phase 4).
 *
 * Design notes:
 *   - `fetchAiResponse` is intentionally NOT memoised with `useCallback`.
 *     Re-creating it on every render ensures it always closes over the current
 *     values of `webSearchEnabled`, `selectedTone`, `useMistralOcr`, and
 *     `layoutContext` without requiring ref gymnastics.  The function is only
 *     ever called from event handlers (never inside a `useEffect` dep array),
 *     so the identity change does not trigger unwanted effects.
 *   - Internal streaming helpers (`applyAiMessageUpdate`, `queueAiMessageUpdate`,
 *     etc.) are defined inside `fetchAiResponse` because they need to close
 *     over per-call state (`loadingMessageId`, `currentChatId`, RAF handles).
 *     Moving them outside would require threading many arguments.
 */

import { useRef } from "react";
import type { Message, MessageSource } from "@/components/chat/chat-message";
import type { AIModel } from "@/types/ai-model";
import type { TonePreset } from "@/components/chat/chat-tones";
import type { AppLayoutContextType, ChatBoard } from "@/components/layout/app-layout";
import { extractThinkingContent } from "@/lib/parsers/content-parser";
import { mergeStreamingText } from "@/lib/streaming";
import { getModelIcon } from "@/lib/model-icons";
import { normalizeUrl, normalizeUuidReference } from "@/lib/normalizers/normalize-utils";
import { API_BASE_URL } from "@/lib/config";
import { getAuthHeaders, ensureFreshToken } from "@/lib/jwt-utils";
import { friendlyApiError } from "@/lib/api/client";
import { fetchChatBoards } from "@/lib/api/chat";
import { toast } from "@/lib/toast-helper";

// ─── Private types (SSE payload shapes) ───────────────────────────────────────

type ClarificationSuggestion = {
  label: string;
  description?: string;
};

type ClarificationPromptPayload = {
  question: string;
  suggestions: ClarificationSuggestion[];
};

type WebSearchPayload = {
  query: string;
  links: string[];
};

type GeneratedFilePayload = {
  url: string;
  s3Key?: string;
  filename?: string;
  mimeType?: string;
};

/** Avatar subset carried on each message — used when building loading messages. */
export type MessageAvatar = Pick<Message, "avatarUrl" | "avatarHint">;

// ─── Private pure helpers ──────────────────────────────────────────────────────

const toOptionalTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeGeneratedFilePayload = (
  raw: unknown,
): GeneratedFilePayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    url?: unknown;
    file_link?: unknown;
    link?: unknown;
    s3_key?: unknown;
    s3Key?: unknown;
    filename?: unknown;
    file_name?: unknown;
    fileName?: unknown;
    name?: unknown;
    mime_type?: unknown;
    mimeType?: unknown;
  };

  const rawUrl = item.url ?? item.file_link ?? item.link;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!url) return null;

  const filenameRaw = item.filename ?? item.file_name ?? item.fileName ?? item.name;
  const filename =
    typeof filenameRaw === "string" && filenameRaw.trim().length > 0
      ? filenameRaw.trim()
      : undefined;

  const s3KeyRaw = item.s3_key ?? item.s3Key;
  const s3Key =
    typeof s3KeyRaw === "string" && s3KeyRaw.trim().length > 0
      ? s3KeyRaw.trim()
      : undefined;

  const mimeTypeRaw = item.mime_type ?? item.mimeType;
  const mimeType =
    typeof mimeTypeRaw === "string" && mimeTypeRaw.trim().length > 0
      ? mimeTypeRaw.trim()
      : undefined;

  return { url, s3Key, filename, mimeType };
};

const dedupeGeneratedFiles = (
  files: GeneratedFilePayload[],
): GeneratedFilePayload[] => {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = file.url.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeImageUrlForDedup = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
};

const shouldReplaceImageUrl = (
  existingUrl: string,
  incomingUrl: string,
): boolean => {
  const existing = existingUrl.trim();
  const incoming = incomingUrl.trim();
  if (!existing) return true;
  const isEphemeral = (v: string) =>
    v.startsWith("blob:") || v.startsWith("data:");
  if (isEphemeral(existing) && !isEphemeral(incoming)) return true;
  if (!isEphemeral(existing) && isEphemeral(incoming)) return false;
  try {
    const existingHasQuery = new URL(existing).search.length > 0;
    const incomingHasQuery = new URL(incoming).search.length > 0;
    if (existingHasQuery && !incomingHasQuery) return true;
  } catch {
    // ignore URL parse errors
  }
  return false;
};

const normalizeClarificationPrompt = (
  raw: unknown,
): ClarificationPromptPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const question =
    toOptionalTrimmedString(payload.question) ??
    toOptionalTrimmedString(payload.prompt) ??
    toOptionalTrimmedString(payload.clarification_question) ??
    "Could you clarify your request?";
  const rawSuggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : Array.isArray(payload.options)
      ? payload.options
      : [];
  const suggestions = rawSuggestions
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? ({ label } as ClarificationSuggestion) : null;
      }
      if (!item || typeof item !== "object") return null;
      const option = item as Record<string, unknown>;
      const label =
        toOptionalTrimmedString(option.label) ??
        toOptionalTrimmedString(option.option) ??
        toOptionalTrimmedString(option.title) ??
        toOptionalTrimmedString(option.text);
      if (!label) return null;
      const description =
        toOptionalTrimmedString(option.description) ??
        toOptionalTrimmedString(option.detail) ??
        toOptionalTrimmedString(option.subtitle) ??
        undefined;
      return { label, description };
    })
    .filter((item): item is ClarificationSuggestion => Boolean(item));

  return { question, suggestions };
};

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  doc_execute: "Generating document...",
  csv_execute: "Analyzing spreadsheet...",
  web_search: "Searching the web...",
};

const formatToolDisplayName = (toolName: string): string =>
  TOOL_DISPLAY_NAMES[toolName] ?? `Running ${toolName}...`;

const normalizeWebSearchPayload = (raw: unknown): WebSearchPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const query =
    toOptionalTrimmedString(payload.query) ??
    toOptionalTrimmedString(payload.search_query) ??
    toOptionalTrimmedString(payload.searchQuery) ??
    "";
  if (!query) return null;

  const rawLinks = Array.isArray(payload.links)
    ? payload.links
    : Array.isArray(payload.urls)
      ? payload.urls
      : Array.isArray(payload.results)
        ? payload.results
        : [];

  const links = rawLinks
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return (
          toOptionalTrimmedString(obj.url) ??
          toOptionalTrimmedString(obj.link) ??
          ""
        );
      }
      return "";
    })
    .filter(Boolean);

  return { query, links };
};

/** Normalise backend sources/citations into the `MessageSource` shape. */
function normalizeMessageSources(
  raw: unknown,
): MessageSource[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: MessageSource[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url: unknown }).url === "string"
    ) {
      const o = item as Record<string, unknown>;
      const url = o.url as string;
      const title = [o.title, o.name].find((v) => typeof v === "string") as
        | string
        | undefined;
      const snippet = typeof o.snippet === "string" ? o.snippet : undefined;
      const authorOrPublisher = [o.authorOrPublisher, o.author, o.publisher].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      const publicationOrAccessDate = [
        o.publicationOrAccessDate,
        o.publicationDate,
        o.date,
        o.accessDate,
        o.publishedDate,
      ].find((v) => typeof v === "string") as string | undefined;
      const relevanceScore =
        typeof o.relevanceScore === "number"
          ? o.relevanceScore
          : typeof o.relevance === "number"
            ? o.relevance
            : typeof o.confidence === "number"
              ? o.confidence
              : typeof o.score === "number"
                ? o.score
                : undefined;
      const num =
        relevanceScore != null
          ? Math.min(100, Math.max(0, Number(relevanceScore)))
          : undefined;
      const imageUrl = [o.imageUrl, o.image, o.ogImage].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      const description = [o.description, o.ogDescription].find(
        (v) => typeof v === "string",
      ) as string | undefined;
      out.push({
        url,
        title: title || undefined,
        snippet: snippet || undefined,
        authorOrPublisher: authorOrPublisher || undefined,
        publicationOrAccessDate: publicationOrAccessDate || undefined,
        relevanceScore: num,
        imageUrl: imageUrl || undefined,
        description: description || undefined,
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

// ─── Hook parameters ───────────────────────────────────────────────────────────

export interface UseStreamingChatParams {
  /**
   * Message list updater — matches the `setMessages` prop from `ChatInterface`.
   * Called with the new message list (or a reducer) during streaming.
   */
  setMessages: (
    updater: Message[] | ((prev: Message[]) => Message[]),
    chatIdOverride?: string,
  ) => void;
  /** AppLayout context — supplies chat/board management helpers. */
  layoutContext: AppLayoutContextType | null;
  /** When present, switches the streaming endpoint to the persona-test path. */
  personaTestConfig?: {
    personaId?: string;
    prompt?: string;
    modelId?: number | string | null;
  };
  /**
   * Called before the very first persona test message to persist the persona.
   * Must resolve to the persona ID or `null` on failure.
   */
  onBeforePersonaTest?: () => Promise<string | null>;
  /** Controls the "responding" spinner and disables the composer input. */
  setIsResponding: React.Dispatch<React.SetStateAction<boolean>>;
  /** Tracks the backend ID of the last successfully completed AI message. */
  setLastMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Tracks whether a regeneration is in progress. */
  setIsRegeneratingResponse: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether web search is enabled for the current send. */
  webSearchEnabled: boolean;
  /** Active tone/style preset — injects a system instruction into the request. */
  selectedTone: TonePreset | null;
  /** Whether to use Mistral OCR for document processing. */
  useMistralOcr: boolean;
}

// ─── Hook implementation ───────────────────────────────────────────────────────

export function useStreamingChat({
  setMessages,
  layoutContext,
  personaTestConfig,
  onBeforePersonaTest,
  setIsResponding,
  setLastMessageId,
  setIsRegeneratingResponse,
  webSearchEnabled,
  selectedTone,
  useMistralOcr,
}: UseStreamingChatParams) {
  /**
   * Synchronized mirror of the active message list.
   * Written before every `setMessages` call so that `adoptResolvedChatId`
   * can re-apply the current messages when the chat ID changes mid-stream.
   */
  const messageBufferRef = useRef<Message[]>([]);
  /** Active AbortController — replaced on every new `fetchAiResponse` call. */
  const abortControllerRef = useRef<AbortController | null>(null);
  /**
   * Set to `true` the moment the user clicks Stop, so that the catch block can
   * distinguish a deliberate cancellation from a network/server error.
   */
  const stopRequestedRef = useRef(false);

  // ── handleStopGeneration ────────────────────────────────────────────────────

  const handleStopGeneration = () => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    setIsResponding(false);

    // Mark the in-progress AI message as no longer loading
    setMessages(
      (prev = []) => {
        const next = prev.map((msg) =>
          msg.sender === "ai" && msg.isLoading
            ? { ...msg, isLoading: false, isThinkingInProgress: false }
            : msg,
        );
        messageBufferRef.current = next;
        return next;
      },
      layoutContext?.activeChatId ?? undefined,
    );
  };

  // ── fetchAiResponse ─────────────────────────────────────────────────────────
  //
  // Intentionally NOT wrapped in useCallback — see module-level doc comment.

  const fetchAiResponse = async (
    userMessage: string,
    loadingMessageId: string,
    chatId: string | null,
    userMessageId: string | undefined,
    modelForRequest: AIModel | null,
    avatarForRequest: MessageAvatar,
    referencedMessageId?: string | null,
    regenerateMessageId?: string | null,
    userMessageBackendId?: string | null,
    pinIds?: string[],
    personaChatHistory?: Array<{ role: "user" | "assistant"; content: string }>,
    replyToMessageId?: string | null,
    files?: File[],
  ): Promise<void> => {
    stopRequestedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      let currentChatId = chatId;
      const isPersonaTest = Boolean(personaTestConfig);

      // ── Chat ID helpers ────────────────────────────────────────────────────

      const getResolvedChatId = (payload: unknown): string | null => {
        if (!payload || typeof payload !== "object") return null;
        const candidate = payload as {
          chat_id?: string | number | null;
          chatId?: string | number | null;
        };
        const raw = candidate.chat_id ?? candidate.chatId ?? null;
        if (raw === null || raw === undefined) return null;
        const resolved = String(raw).trim();
        return resolved.length > 0 ? resolved : null;
      };

      const adoptResolvedChatId = (resolved: string) => {
        if (isPersonaTest || !layoutContext?.setActiveChatId) return;
        const previousChatId = currentChatId;
        if (previousChatId === resolved) return;

        currentChatId = resolved;
        layoutContext.setActiveChatId(resolved);

        if (messageBufferRef.current.length > 0) {
          setMessages(messageBufferRef.current, resolved);
        }

        if (
          previousChatId &&
          previousChatId.startsWith("temp-") &&
          layoutContext.setChatBoards
        ) {
          layoutContext.setChatBoards((prev: ChatBoard[]) => {
            const tempBoard = prev.find((b: ChatBoard) => b.id === previousChatId);
            if (!tempBoard) return prev;
            return prev.map((b: ChatBoard) =>
              b.id === previousChatId ? { ...tempBoard, id: resolved } : b,
            );
          });
        }
      };

      /**
       * For new chats, poll the server until a real chat ID becomes available.
       * Falls back to the most-recently-created chat if the title hint doesn't
       * match exactly.
       */
      const tryResolveTempChatIdFromServer = (
        titleHint?: string,
        retries = 2,
      ) => {
        if (
          isPersonaTest ||
          !currentChatId ||
          !currentChatId.startsWith("temp-")
        ) {
          return;
        }
        const tempIdSnapshot = currentChatId;
        const normalizedTitleHint = (titleHint || "").trim().toLowerCase();
        const inputPrefix = userMessage.trim().slice(0, 50).toLowerCase();

        void fetchChatBoards()
          .then(({ chats }) => {
            if (!chats || chats.length === 0) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }
            if (currentChatId !== tempIdSnapshot) return;

            const candidates = chats.map((chat) => ({
              id: String(chat.id),
              title: (
                chat.chat_title ||
                (chat as { title?: string }).title ||
                (chat as { name?: string }).name ||
                ""
              ).trim(),
            }));

            let matched =
              normalizedTitleHint.length > 0
                ? candidates.find(
                    (c) => c.title.toLowerCase() === normalizedTitleHint,
                  )
                : undefined;

            if (!matched && inputPrefix.length > 0) {
              matched = candidates.find((c) =>
                c.title.toLowerCase().startsWith(inputPrefix),
              );
            }

            const resolvedId = (matched ?? candidates[0])?.id;
            if (!resolvedId) {
              if (retries > 0) {
                setTimeout(
                  () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                  500,
                );
              }
              return;
            }
            if (currentChatId === tempIdSnapshot) {
              adoptResolvedChatId(resolvedId);
            }
          })
          .catch(() => {
            if (retries > 0) {
              setTimeout(
                () => tryResolveTempChatIdFromServer(titleHint, retries - 1),
                500,
              );
            }
          });
      };

      // ── Request setup ──────────────────────────────────────────────────────

      if (!modelForRequest) {
        console.warn("[useStreamingChat] No model selected — backend may use a default.");
      }

      let resolvedPersonaId = personaTestConfig?.personaId ?? null;
      if (isPersonaTest && !resolvedPersonaId && onBeforePersonaTest) {
        resolvedPersonaId = await onBeforePersonaTest();
      }

      const isExistingChat = Boolean(
        !isPersonaTest && chatId && !chatId.startsWith("temp-"),
      );
      const endpoint =
        isPersonaTest && resolvedPersonaId
          ? `${API_BASE_URL}/persona/${resolvedPersonaId}/test`
          : isExistingChat && chatId
            ? `${API_BASE_URL}/chats/${chatId}/stream`
            : `${API_BASE_URL}/chats/create`;

      const modelId =
        modelForRequest?.id ??
        modelForRequest?.modelId ??
        personaTestConfig?.modelId ??
        null;
      const useAlgorithm =
        (modelId === null || modelId === undefined) &&
        Boolean(layoutContext?.useFramework);
      const algorithmValue = useAlgorithm
        ? layoutContext?.frameworkType === "pro"
          ? "pro"
          : "base"
        : null;
      const memoryPct = layoutContext?.memoryPercentage ?? 0.2;

      const headers: Record<string, string> = { Accept: "text/event-stream" };
      const nonImageFiles =
        files?.filter((f) => !f.type.startsWith("image/")) ?? [];
      const imageFiles =
        files?.filter((f) => f.type.startsWith("image/")) ?? [];

      let body: FormData | string;

      if (isPersonaTest) {
        if ((files?.length ?? 0) > 0) {
          const fd = new FormData();
          fd.append("input", userMessage);
          if (modelId !== null && modelId !== undefined)
            fd.append("model_id", String(modelId));
          if (webSearchEnabled) fd.append("web_search", "true");
          if (selectedTone) fd.append("system_instruction", selectedTone.system_prompt);
          if (useMistralOcr) fd.append("use_mistral_ocr", "true");
          [...imageFiles, ...nonImageFiles].forEach((f) =>
            fd.append("files", f),
          );
          body = fd;
        } else {
          const params = new URLSearchParams({ input: userMessage });
          if (selectedTone)
            params.append("system_instruction", selectedTone.system_prompt);
          body = params.toString();
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
      } else if (nonImageFiles.length > 0) {
        const fd = new FormData();
        fd.append("input", userMessage);
        if (modelId !== null && modelId !== undefined)
          fd.append("model_id", String(modelId));
        if (algorithmValue) fd.append("algorithm", algorithmValue);
        fd.append("memory_percentage", String(memoryPct));
        if (webSearchEnabled) fd.append("web_search", "true");
        if (selectedTone) fd.append("system_instruction", selectedTone.system_prompt);
        if (useMistralOcr) fd.append("use_mistral_ocr", "true");
        if (pinIds && pinIds.length > 0)
          fd.append("pin_ids", JSON.stringify(pinIds));
        const resolvedRefIdFD = normalizeUuidReference(
          referencedMessageId || replyToMessageId || null,
        );
        if (resolvedRefIdFD && isExistingChat)
          fd.append("reference_message_id", resolvedRefIdFD);
        [...imageFiles, ...nonImageFiles].forEach((f) => fd.append("files", f));
        body = fd;
      } else {
        // Use multipart/form-data even without files — required by the API
        const fd = new FormData();
        fd.append("input", userMessage);
        if (modelId !== null && modelId !== undefined)
          fd.append("model_id", String(modelId));
        if (algorithmValue) fd.append("algorithm", algorithmValue);
        fd.append("memory_percentage", String(memoryPct));
        if (webSearchEnabled) fd.append("web_search", "true");
        if (selectedTone) fd.append("system_instruction", selectedTone.system_prompt);
        if (useMistralOcr) fd.append("use_mistral_ocr", "true");
        if (pinIds && pinIds.length > 0)
          fd.append("pin_ids", JSON.stringify(pinIds));
        const resolvedRefId = normalizeUuidReference(
          referencedMessageId || replyToMessageId || null,
        );
        if (resolvedRefId && isExistingChat)
          fd.append("reference_message_id", resolvedRefId);
        imageFiles.forEach((f) => fd.append("files", f));
        body = fd;
        delete headers["Content-Type"];
      }

      // ── HTTP request ───────────────────────────────────────────────────────

      await ensureFreshToken();
      const authHeaders = getAuthHeaders(headers);

      let response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body,
        signal: controller.signal,
      });

      // One retry on 401 — token may have expired between the freshness check
      // and the request landing at the server.
      if (response.status === 401 && typeof window !== "undefined") {
        const refreshed = await ensureFreshToken();
        if (refreshed) {
          response = await fetch(endpoint, {
            method: "POST",
            headers: getAuthHeaders(headers),
            credentials: "include",
            body,
            signal: controller.signal,
          });
        }
        if (response.status === 401) {
          setMessages(
            (prev = []) =>
              prev.map((msg) =>
                msg.id === loadingMessageId
                  ? {
                      ...msg,
                      content: "Your session has expired. Signing you out\u2026",
                      isLoading: false,
                    }
                  : msg,
              ),
            chatId ?? undefined,
          );
          setIsResponding(false);
          console.error("[useStreamingChat] session expired (401)");
          toast.error("Session expired", { description: "Signing you out\u2026" });
          window.dispatchEvent(new Event("auth:session-expired"));
          return;
        }
      }

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error(
          `[useStreamingChat] API ${response.status} ${endpoint}:`,
          errorText || "empty response",
        );
        throw new Error(
          friendlyApiError(errorText || "API request failed", response.status),
        );
      }

      // Adopt a chat ID from the response headers for new chats
      if (!isPersonaTest && layoutContext?.setActiveChatId) {
        const headerChatId =
          response.headers.get("X-Chat-Id") ||
          response.headers.get("x-chat-id");
        if (headerChatId && (!currentChatId || currentChatId.startsWith("temp-"))) {
          adoptResolvedChatId(String(headerChatId));
        }
      }

      // ── Stream reading setup ───────────────────────────────────────────────

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let reasoningContent = "";
      let streamMetadata: Record<string, unknown> | null = null;
      let streamFinished = false;
      let shouldStopReading = false;

      // RAF-batched message update queue — targets ~60 fps
      const AI_UPDATE_INTERVAL_MS = 16;
      let pendingAiFields: Partial<Message> | null = null;
      let aiUpdateRafId: number | null = null;
      let aiUpdateTimer: ReturnType<typeof setTimeout> | null = null;
      let lastAiFlushAt = 0;

      const applyAiMessageUpdate = (fields: Partial<Message>) => {
        setMessages(
          (prev = []) => {
            const next = prev.map((msg) => {
              if (msg.id !== loadingMessageId) return msg;
              const { metadata: nextMeta, ...rest } = fields;
              const merged: Message = { ...msg, ...rest };
              if (nextMeta !== undefined) {
                merged.metadata = { ...(msg.metadata || {}), ...nextMeta };
              }
              return merged;
            });
            messageBufferRef.current = next;
            return next;
          },
          currentChatId ?? undefined,
        );
      };

      const clearScheduledAiUpdate = () => {
        if (aiUpdateRafId !== null) {
          cancelAnimationFrame(aiUpdateRafId);
          aiUpdateRafId = null;
        }
        if (aiUpdateTimer !== null) {
          clearTimeout(aiUpdateTimer);
          aiUpdateTimer = null;
        }
      };

      const flushQueuedAiUpdate = () => {
        if (!pendingAiFields) return;
        const nextFields = pendingAiFields;
        pendingAiFields = null;
        clearScheduledAiUpdate();
        lastAiFlushAt = Date.now();
        applyAiMessageUpdate(nextFields);
      };

      const queueAiMessageUpdate = (
        fields: Partial<Message>,
        immediate = false,
      ) => {
        if (pendingAiFields) {
          const { metadata: newMeta, ...newRest } = fields;
          const { metadata: pendingMeta, ...pendingRest } = pendingAiFields;
          pendingAiFields = {
            ...pendingRest,
            ...newRest,
            metadata:
              newMeta === undefined
                ? pendingMeta
                : { ...(pendingMeta || {}), ...newMeta },
          };
        } else {
          pendingAiFields = fields;
        }

        if (immediate) {
          flushQueuedAiUpdate();
          return;
        }

        if (aiUpdateRafId !== null || aiUpdateTimer !== null) return;

        const elapsed = Date.now() - lastAiFlushAt;
        if (elapsed >= AI_UPDATE_INTERVAL_MS) {
          aiUpdateRafId = requestAnimationFrame(() => {
            aiUpdateRafId = null;
            flushQueuedAiUpdate();
          });
        } else {
          aiUpdateTimer = setTimeout(() => {
            aiUpdateTimer = null;
            flushQueuedAiUpdate();
          }, AI_UPDATE_INTERVAL_MS - elapsed);
        }
      };

      const appendAiImages = (
        incoming: Array<{ url: string; alt?: string }>,
      ) => {
        if (incoming.length === 0) return;
        setMessages(
          (prev = []) => {
            const next = prev.map((msg) => {
              if (msg.id !== loadingMessageId) return msg;
              const existing = Array.isArray(msg.images)
                ? msg.images
                : msg.imageUrl
                  ? [{ url: msg.imageUrl, alt: msg.imageAlt }]
                  : [];
              const merged = [...existing];
              const indexByKey = new Map<string, number>();
              merged.forEach((img, idx) => {
                const key = normalizeImageUrlForDedup(img.url);
                if (key) indexByKey.set(key, idx);
              });
              incoming.forEach((img) => {
                const key = normalizeImageUrlForDedup(img.url);
                if (!key) return;
                const existingIndex = indexByKey.get(key);
                if (existingIndex === undefined) {
                  merged.push(img);
                  indexByKey.set(key, merged.length - 1);
                  return;
                }
                const existingImg = merged[existingIndex];
                if (shouldReplaceImageUrl(existingImg.url, img.url)) {
                  merged[existingIndex] = {
                    ...existingImg,
                    ...img,
                    alt: img.alt ?? existingImg.alt,
                  };
                } else if (!existingImg.alt && img.alt) {
                  merged[existingIndex] = { ...existingImg, alt: img.alt };
                }
              });
              return {
                ...msg,
                images: merged,
                imageUrl: merged[0]?.url,
                imageAlt: merged[0]?.alt,
              };
            });
            messageBufferRef.current = next;
            return next;
          },
          currentChatId ?? undefined,
        );
      };

      const appendGeneratedFiles = (incoming: GeneratedFilePayload[]) => {
        if (incoming.length === 0) return;
        setMessages(
          (prev = []) => {
            const next = prev.map((msg) => {
              if (msg.id !== loadingMessageId) return msg;
              const existing = Array.isArray(msg.metadata?.generatedFiles)
                ? msg.metadata.generatedFiles
                : [];
              const merged = dedupeGeneratedFiles([...existing, ...incoming]);
              return {
                ...msg,
                metadata: { ...(msg.metadata || {}), generatedFiles: merged },
              };
            });
            messageBufferRef.current = next;
            return next;
          },
          currentChatId ?? undefined,
        );
      };

      const applyClarificationPrompt = (
        clarification: ClarificationPromptPayload,
      ) => {
        setMessages(
          (prev = []) => {
            const next = prev.map((msg) =>
              msg.id === loadingMessageId
                ? {
                    ...msg,
                    content: clarification.question,
                    thinkingContent: null,
                    isThinkingInProgress: false,
                    isLoading: false,
                    metadata: { ...msg.metadata, clarification },
                  }
                : msg,
            );
            messageBufferRef.current = next;
            return next;
          },
          currentChatId ?? undefined,
        );
      };

      // ── SSE chunk parser ───────────────────────────────────────────────────

      const streamReader = response.body.getReader();
      reader = streamReader;

      const processChunk = (value: Uint8Array) => {
        buffer += decoder.decode(value, { stream: true });

        // Standard SSE uses \n\n between events; split there first.
        const rawChunks = buffer.split("\n\n");
        buffer = rawChunks.pop() ?? "";

        // Some backends use \n between events instead — further split where a
        // newline is directly followed by "event:" so we get one chunk per event.
        const events: string[] = [];
        for (const chunk of rawChunks) {
          for (const s of chunk.split(/\n(?=event:)/)) events.push(s);
        }

        for (const eventChunk of events) {
          const lines = eventChunk.split("\n");
          let eventName = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              // Handle "event: NAMEdata: {json}" — non-standard but observed.
              const inlineDataIdx = line.indexOf("data:", 6);
              if (inlineDataIdx !== -1) {
                eventName = line.slice(6, inlineDataIdx).trim();
                dataStr += line.slice(inlineDataIdx + 5).trim();
              } else {
                eventName = line.slice(6).trim();
              }
            } else if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim();
            }
          }

          if (!dataStr) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let parsed: any;
          try {
            parsed = JSON.parse(dataStr);
          } catch (err) {
            console.warn("[useStreamingChat] Failed to parse SSE data", err, dataStr);
            continue;
          }

          // Normalise type-field format (no `event:` field, uses `parsed.type`)
          if (!eventName && parsed.type) {
            if (parsed.type === "content") {
              eventName = "chunk";
              if (typeof parsed.content === "string" && !("delta" in parsed)) {
                parsed = { ...parsed, delta: parsed.content };
              }
            } else {
              eventName = parsed.type;
            }
          }

          if (
            eventName === "content" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content };
            eventName = "chunk";
          }

          if (
            eventName === "reasoning" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content };
          }

          // ── Event handlers ───────────────────────────────────────────────

          if (eventName === "metadata") {
            streamMetadata = parsed;
            const metadataChatId = getResolvedChatId(parsed);
            if (metadataChatId) {
              adoptResolvedChatId(metadataChatId);
              if (layoutContext?.setChatBoards) {
                layoutContext.setChatBoards((prev: ChatBoard[]) =>
                  prev.map((b: ChatBoard) =>
                    b.id === metadataChatId
                      ? {
                          ...b,
                          name: parsed.title || parsed.chat_title || b.name,
                        }
                      : b,
                  ),
                );
              }
            }
            const chatTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              chatTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(chatTitle),
              );
            }
            continue;
          }

          if (eventName === "web_search") {
            const webSearch = normalizeWebSearchPayload(parsed);
            if (webSearch) queueAiMessageUpdate({ metadata: { webSearch } }, true);
            continue;
          }

          if (eventName === "tool_executing") {
            const toolName =
              typeof parsed.content === "string"
                ? parsed.content
                : typeof (parsed.tool_call as Record<string, unknown> | undefined)?.name === "string"
                  ? (parsed.tool_call as Record<string, unknown>).name as string
                  : "";
            queueAiMessageUpdate({ toolStatus: formatToolDisplayName(toolName) });
            continue;
          }

          if (eventName === "tool_calls_streaming") {
            const toolName =
              typeof parsed.content === "string" && parsed.content
                ? parsed.content
                : typeof (parsed.tool_call as Record<string, unknown> | undefined)?.name === "string"
                  ? (parsed.tool_call as Record<string, unknown>).name as string
                  : "";
            if (toolName) {
              queueAiMessageUpdate({ toolStatus: `Preparing ${toolName}...` });
            }
            continue;
          }

          if (eventName === "tool_complete") {
            queueAiMessageUpdate({ toolStatus: null });
            continue;
          }

          if (eventName === "tool_progress") {
            const tool = typeof parsed.tool === "string" ? parsed.tool : "";
            const filename =
              typeof parsed.filename === "string" ? parsed.filename : "";
            const status = typeof parsed.status === "string" ? parsed.status : "";
            const message = typeof parsed.message === "string" ? parsed.message : "";
            const displayName = formatToolDisplayName(tool);
            const label = filename
              ? `${status === "executing" ? "Running" : displayName} ${tool} for ${filename}...`
              : message || displayName;
            queueAiMessageUpdate({ toolStatus: label });
            continue;
          }

          if (eventName === "docx_progress") {
            const step = typeof parsed.step === "string" ? parsed.step : "";
            const message = typeof parsed.message === "string" ? parsed.message : "";
            const filename = typeof parsed.filename === "string" ? parsed.filename : "";
            if (step === "done") {
              queueAiMessageUpdate({ toolStatus: null });
            } else {
              const label = filename
                ? `${message || step}: ${filename}`
                : message || step;
              queueAiMessageUpdate({ toolStatus: label || "Processing document..." });
            }
            continue;
          }

          if (eventName === "reasoning") {
            const delta =
              typeof parsed.delta === "string" ? parsed.delta : "";
            reasoningContent = mergeStreamingText(reasoningContent, delta);
            queueAiMessageUpdate({
              thinkingContent: reasoningContent,
              isThinkingInProgress: true,
              isLoading: false,
            });
            continue;
          }

          if (eventName === "model_selected") {
            const modelName =
              typeof parsed.model_name === "string"
                ? parsed.model_name
                : typeof parsed.modelName === "string"
                  ? parsed.modelName
                  : undefined;
            const providerName =
              typeof parsed.company === "string"
                ? parsed.company
                : typeof parsed.provider_name === "string"
                  ? parsed.provider_name
                  : typeof parsed.providerName === "string"
                    ? parsed.providerName
                    : undefined;
            const avatarUrl = getModelIcon(providerName, modelName);
            const avatarHint = [modelName, providerName]
              .filter(Boolean)
              .join(" ")
              .trim();
            queueAiMessageUpdate(
              {
                avatarUrl,
                avatarHint: avatarHint || undefined,
                metadata: {
                  modelName,
                  providerName,
                  llmModelId:
                    parsed.model_id ??
                    parsed.modelId ??
                    parsed.llm_model_id ??
                    parsed.llmModelId ??
                    null,
                },
              },
              true,
            );
            continue;
          }

          if (eventName === "chunk") {
            const delta =
              typeof parsed.delta === "string" ? parsed.delta : "";
            assistantContent = mergeStreamingText(assistantContent, delta);
            const sanitized = extractThinkingContent(assistantContent);
            const hasOpenThink = /<think>/i.test(assistantContent);
            const hasCloseThink = /<\/think>/i.test(assistantContent);
            const stillThinking = hasOpenThink && !hasCloseThink;
            queueAiMessageUpdate({
              content: sanitized.visibleText || "",
              thinkingContent: reasoningContent || sanitized.thinkingText,
              isThinkingInProgress: stillThinking && !reasoningContent,
              isLoading: false,
            });
            continue;
          }

          if (eventName === "image") {
            const eventImages = Array.isArray(parsed.images)
              ? parsed.images
              : typeof parsed.url === "string" && parsed.url
                ? [parsed.url]
                : [];
            const normalizedImages = eventImages
              .map((img: unknown): { url: string; alt?: string } | null => {
                if (typeof img === "string") {
                  const trimmed = img.trim();
                  return trimmed ? { url: trimmed } : null;
                }
                if (img && typeof img === "object") {
                  const obj = img as { url?: unknown; alt?: unknown };
                  const url =
                    typeof obj.url === "string" ? obj.url.trim() : "";
                  if (!url) return null;
                  return {
                    url,
                    alt: typeof obj.alt === "string" ? obj.alt : undefined,
                  };
                }
                return null;
              })
              .filter(
                (img: { url: string; alt?: string } | null): img is { url: string; alt?: string } =>
                  Boolean(img),
              );

            appendAiImages(normalizedImages);
            if (normalizedImages.length > 0) {
              queueAiMessageUpdate({ metadata: { isImageGeneration: true } });
            }
            continue;
          }

          if (eventName === "generated_file") {
            const generatedFile = normalizeGeneratedFilePayload(parsed);
            if (generatedFile) {
              appendGeneratedFiles([generatedFile]);
              queueAiMessageUpdate({ isLoading: false });
            }
            continue;
          }

          if (eventName === "title") {
            const titleChatId = getResolvedChatId(parsed);
            if (titleChatId) adoptResolvedChatId(titleChatId);
            const titleCandidate =
              typeof parsed.title === "string"
                ? parsed.title
                : typeof parsed.chat_title === "string"
                  ? parsed.chat_title
                  : "";
            const streamTitle = titleCandidate.trim();
            if (
              !isPersonaTest &&
              streamTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(currentChatId, streamTitle);
            }
            if (!titleChatId) tryResolveTempChatIdFromServer(streamTitle);
            continue;
          }

          if (eventName === "ask_user") {
            const clarification = normalizeClarificationPrompt(parsed);
            if (!clarification) continue;

            const askUserChatId = getResolvedChatId(parsed);
            if (askUserChatId) adoptResolvedChatId(askUserChatId);

            const askUserTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              askUserTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(askUserTitle),
              );
            }

            applyClarificationPrompt(clarification);

            if (!isPersonaTest && currentChatId && layoutContext?.moveChatToTop) {
              layoutContext.moveChatToTop(currentChatId);
            }

            setLastMessageId(loadingMessageId);
            setIsResponding(false);
            streamFinished = true;
            shouldStopReading = true;
            continue;
          }

          if (eventName === "message_saved") {
            const savedMessageId = normalizeUuidReference(
              parsed.message_id ?? parsed.messageId ?? null,
            );
            if (savedMessageId) {
              queueAiMessageUpdate({ chatMessageId: savedMessageId }, true);
            }
            continue;
          }

          if (eventName === "done") {
            const messageText =
              typeof parsed.response === "string"
                ? parsed.response
                : assistantContent;
            const messageMeta =
              parsed.metadata && typeof parsed.metadata === "object"
                ? parsed.metadata
                : null;
            // Also read from parsed.usage (spec field for token counts)
            const usageObj =
              parsed.usage && typeof parsed.usage === "object"
                ? (parsed.usage as Record<string, unknown>)
                : null;
            const resolvedMessageId =
              parsed.message_id ?? parsed.messageId ?? null;
            const webSearchFromDone =
              normalizeWebSearchPayload(
                (parsed as { web_search?: unknown; webSearch?: unknown })
                  .web_search ??
                  (parsed as { web_search?: unknown; webSearch?: unknown })
                    .webSearch ??
                  (messageMeta as { web_search?: unknown; webSearch?: unknown })
                    ?.web_search ??
                  (messageMeta as { web_search?: unknown; webSearch?: unknown })
                    ?.webSearch ??
                  null,
              ) ?? undefined;

            const metadataBase: Message["metadata"] | undefined = messageMeta
              ? {
                  modelName:
                    (messageMeta as { modelName?: string }).modelName ??
                    (messageMeta as { model_name?: string }).model_name,
                  providerName:
                    (messageMeta as { providerName?: string }).providerName ??
                    (messageMeta as { provider_name?: string }).provider_name,
                  inputTokens:
                    (messageMeta as { inputTokens?: number }).inputTokens ??
                    (messageMeta as { input_tokens?: number }).input_tokens ??
                    (usageObj?.input_tokens as number | undefined) ??
                    (usageObj?.prompt_tokens as number | undefined),
                  outputTokens:
                    (messageMeta as { outputTokens?: number }).outputTokens ??
                    (messageMeta as { output_tokens?: number }).output_tokens ??
                    (usageObj?.output_tokens as number | undefined) ??
                    (usageObj?.completion_tokens as number | undefined),
                  createdAt:
                    (messageMeta as { createdAt?: string }).createdAt ??
                    (messageMeta as { created_at?: string }).created_at,
                  llmModelId:
                    (messageMeta as { llmModelId?: string | number | null })
                      .llmModelId ??
                    (messageMeta as { llm_model_id?: string | number | null })
                      .llm_model_id ??
                    null,
                  pinIds: Array.isArray(
                    (messageMeta as { pinIds?: unknown[] }).pinIds,
                  )
                    ? (
                        (messageMeta as { pinIds: unknown[] }).pinIds as unknown[]
                      ).map(String)
                    : Array.isArray(
                          (messageMeta as { pin_ids?: unknown[] }).pin_ids,
                        )
                      ? (
                          (messageMeta as { pin_ids: unknown[] })
                            .pin_ids as unknown[]
                        ).map(String)
                      : undefined,
                  userReaction:
                    (messageMeta as { userReaction?: string | null })
                      .userReaction ??
                    (messageMeta as { user_reaction?: string | null })
                      .user_reaction ??
                    null,
                  documentId:
                    (messageMeta as { documentId?: string | null }).documentId ??
                    (messageMeta as { document_id?: string | null }).document_id ??
                    null,
                  documentUrl:
                    (messageMeta as { documentUrl?: string | null })
                      .documentUrl ??
                    (messageMeta as { document_url?: string | null })
                      .document_url ??
                    null,
                  sources: normalizeMessageSources(
                    (messageMeta as { sources?: unknown }).sources ??
                      (messageMeta as { citations?: unknown }).citations,
                  ),
                }
              : usageObj
                ? {
                    inputTokens:
                      (usageObj.input_tokens as number | undefined) ??
                      (usageObj.prompt_tokens as number | undefined),
                    outputTokens:
                      (usageObj.output_tokens as number | undefined) ??
                      (usageObj.completion_tokens as number | undefined),
                  }
                : undefined;

            const metadata: Message["metadata"] | undefined =
              metadataBase || webSearchFromDone
                ? {
                    ...(metadataBase || {}),
                    ...(webSearchFromDone ? { webSearch: webSearchFromDone } : {}),
                  }
                : undefined;

            const sanitized = extractThinkingContent(
              messageText || assistantContent || "API didn't respond",
            );

            // Extract images from the done payload
            const doneImages = Array.isArray(parsed.images)
              ? parsed.images
                  .map(
                    (img: unknown): { url: string; alt?: string } | null => {
                      if (typeof img === "string") {
                        const trimmed = img.trim();
                        return trimmed ? { url: trimmed } : null;
                      }
                      if (img && typeof img === "object") {
                        const obj = img as { url?: unknown; alt?: unknown };
                        const url =
                          typeof obj.url === "string" ? obj.url.trim() : "";
                        if (!url) return null;
                        return {
                          url,
                          alt: typeof obj.alt === "string" ? obj.alt : undefined,
                        };
                      }
                      return null;
                    },
                  )
                  .filter(
                    (img: { url: string; alt?: string } | null): img is {
                      url: string;
                      alt?: string;
                    } => Boolean(img),
                  )
              : [];

            type GeneratedAttachmentPayloadItem = {
              url: string;
              name?: string;
              isImage: boolean;
              s3Key?: string;
              mimeType?: string;
            };

            const generatedAttachmentPayload: GeneratedAttachmentPayloadItem[] =
              Array.isArray(parsed.file_attachments)
                ? parsed.file_attachments
                    .map((item: unknown) => {
                      if (!item || typeof item !== "object") return null;
                      const att = item as {
                        file_link?: unknown;
                        url?: unknown;
                        link?: unknown;
                        origin?: unknown;
                        s3_key?: unknown;
                        s3Key?: unknown;
                        mime_type?: unknown;
                        mimeType?: unknown;
                        file_name?: unknown;
                        fileName?: unknown;
                        name?: unknown;
                      };
                      const rawUrl = att.file_link ?? att.url ?? att.link;
                      const url =
                        typeof rawUrl === "string" ? rawUrl.trim() : "";
                      if (!url) return null;
                      const origin =
                        typeof att.origin === "string"
                          ? att.origin.trim().toLowerCase()
                          : "";
                      if (origin !== "generated") return null;
                      const mimeRaw = att.mime_type ?? att.mimeType;
                      const mimeType =
                        typeof mimeRaw === "string"
                          ? mimeRaw.trim().toLowerCase()
                          : "";
                      const rawName =
                        att.file_name ?? att.fileName ?? att.name;
                      const name =
                        typeof rawName === "string" &&
                        rawName.trim().length > 0
                          ? rawName.trim()
                          : undefined;
                      const isImage =
                        mimeType.startsWith("image/") ||
                        /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(
                          url.toLowerCase(),
                        );
                      return {
                        url,
                        name,
                        isImage,
                        s3Key:
                          typeof att.s3_key === "string"
                            ? att.s3_key
                            : undefined,
                        mimeType: mimeType || undefined,
                      };
                    })
                    .filter(
                      (
                        item: GeneratedAttachmentPayloadItem | null,
                      ): item is GeneratedAttachmentPayloadItem => Boolean(item),
                    )
                : [];

            // Extract uploaded (user) file attachments from done event to
            // replace blob URLs with permanent server URLs.
            const uploadedAttachmentsFromDone: Array<{
              id: string;
              type: "document" | "image";
              name: string;
              url: string;
            }> = Array.isArray(parsed.file_attachments)
              ? parsed.file_attachments
                  .map((item: unknown, idx: number) => {
                    if (!item || typeof item !== "object") return null;
                    const att = item as Record<string, unknown>;
                    const origin =
                      typeof att.origin === "string"
                        ? att.origin.trim().toLowerCase()
                        : "";
                    if (
                      origin !== "uploaded" &&
                      origin !== "upload" &&
                      origin !== "user"
                    )
                      return null;
                    const rawUrl = att.file_link ?? att.url ?? att.link;
                    const url =
                      typeof rawUrl === "string" ? rawUrl.trim() : "";
                    if (!url) return null;
                    const rawName = att.file_name ?? att.fileName ?? att.name;
                    const name =
                      typeof rawName === "string" && rawName.trim().length > 0
                        ? rawName.trim()
                        : (() => {
                            try {
                              const seg = new URL(url).pathname
                                .split("/")
                                .filter(Boolean)
                                .pop();
                              return seg
                                ? decodeURIComponent(seg)
                                : `Document ${idx + 1}`;
                            } catch {
                              return `Document ${idx + 1}`;
                            }
                          })();
                    const mimeRaw = att.mime_type ?? att.mimeType;
                    const mimeType =
                      typeof mimeRaw === "string"
                        ? mimeRaw.trim().toLowerCase()
                        : "";
                    const isImage =
                      mimeType.startsWith("image/") ||
                      /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(
                        url.toLowerCase(),
                      );
                    return {
                      id: `uploaded-${idx}`,
                      type: isImage ? ("image" as const) : ("document" as const),
                      name,
                      url,
                    };
                  })
                  .filter(
                    (
                      item: {
                        id: string;
                        type: "document" | "image";
                        name: string;
                        url: string;
                      } | null,
                    ): item is {
                      id: string;
                      type: "document" | "image";
                      name: string;
                      url: string;
                    } => Boolean(item),
                  )
              : [];

            const generatedAttachmentImages = generatedAttachmentPayload
              .filter((item) => item.isImage)
              .map((item) => ({ url: item.url, alt: item.name }));

            const generatedFilesFromDone = Array.isArray(parsed.generated_files)
              ? parsed.generated_files
                  .map((item: unknown) => normalizeGeneratedFilePayload(item))
                  .filter(
                    (item: GeneratedFilePayload | null): item is GeneratedFilePayload =>
                      Boolean(item),
                  )
              : Array.isArray(parsed.generatedFiles)
                ? parsed.generatedFiles
                    .map((item: unknown) => normalizeGeneratedFilePayload(item))
                    .filter(
                      (
                        item: GeneratedFilePayload | null,
                      ): item is GeneratedFilePayload => Boolean(item),
                    )
                : [];

            const generatedFilesFromAttachments = generatedAttachmentPayload.map(
              (item) => ({
                url: item.url,
                filename: item.name,
                s3Key: item.s3Key,
                mimeType: item.mimeType,
              }),
            );

            const mergedGeneratedFiles = dedupeGeneratedFiles([
              ...(generatedFilesFromDone || []),
              ...generatedFilesFromAttachments,
            ]);

            const mergedDoneImages = [
              ...doneImages,
              ...generatedAttachmentImages,
            ];

            const generatedFileUrls = new Set(
              mergedGeneratedFiles.map((f) => f.url.trim().toLowerCase()),
            );
            const mergedSources = [
              ...((metadata?.sources as MessageSource[] | undefined) || []),
            ].filter((source, index, arr) => {
              if (!source || typeof source.url !== "string") return false;
              if (generatedFileUrls.has(source.url.trim().toLowerCase()))
                return false;
              return (
                arr.findIndex((c) => c.url === source.url) === index
              );
            });

            const finalMetadata: Message["metadata"] | undefined =
              metadata || mergedSources.length > 0 || mergedGeneratedFiles.length > 0
                ? {
                    ...(metadata || {}),
                    ...(mergedSources.length > 0
                      ? { sources: mergedSources }
                      : {}),
                    ...(mergedGeneratedFiles.length > 0
                      ? { generatedFiles: mergedGeneratedFiles }
                      : {}),
                  }
                : undefined;

            const reasoningFromMeta =
              (messageMeta as { reasoning?: string; thoughts?: string })
                ?.reasoning ??
              (messageMeta as { thinking?: string; analysis?: string })
                ?.thinking ??
              (messageMeta as { analysis?: string })?.analysis ??
              (messageMeta as { thoughts?: string })?.thoughts ??
              undefined;
            const reasoningFromDone =
              typeof parsed.reasoning === "string"
                ? parsed.reasoning
                : typeof reasoningFromMeta === "string"
                  ? reasoningFromMeta
                  : undefined;
            const finalReasoning =
              reasoningContent || reasoningFromDone || sanitized.thinkingText;

            flushQueuedAiUpdate();
            queueAiMessageUpdate(
              {
                content:
                  sanitized.visibleText ||
                  (finalReasoning ? "" : "API didn't respond"),
                thinkingContent: finalReasoning || null,
                isThinkingInProgress: false,
                chatMessageId:
                  resolvedMessageId !== null && resolvedMessageId !== undefined
                    ? String(resolvedMessageId)
                    : undefined,
                metadata: finalMetadata,
                isLoading: false,
                toolStatus: null,
              },
              true,
            );

            if (mergedDoneImages.length > 0) {
              appendAiImages(mergedDoneImages);
              queueAiMessageUpdate({ metadata: { isImageGeneration: true } }, true);
            }

            // Replace blob URLs on the user message with permanent server URLs
            if (uploadedAttachmentsFromDone.length > 0 && userMessageId) {
              setMessages(
                (prev = []) => {
                  const next = prev.map((msg) => {
                    if (msg.id !== userMessageId) return msg;
                    return {
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        attachments: uploadedAttachmentsFromDone,
                      },
                    };
                  });
                  messageBufferRef.current = next;
                  return next;
                },
                currentChatId ?? undefined,
              );
            }

            const doneChatId = getResolvedChatId(parsed);
            if (doneChatId) {
              adoptResolvedChatId(doneChatId);
              if (layoutContext?.setChatBoards) {
                layoutContext.setChatBoards((prev: ChatBoard[]) =>
                  prev.map((b: ChatBoard) =>
                    b.id === doneChatId
                      ? {
                          ...b,
                          name: parsed.title || parsed.chat_title || b.name,
                        }
                      : b,
                  ),
                );
              }
            } else {
              const doneTitleHint =
                typeof parsed.title === "string"
                  ? parsed.title
                  : typeof parsed.chat_title === "string"
                    ? parsed.chat_title
                    : "";
              tryResolveTempChatIdFromServer(doneTitleHint);
            }

            const doneTitle = parsed.title || parsed.chat_title;
            if (
              !isPersonaTest &&
              doneTitle &&
              currentChatId &&
              layoutContext?.updateChatTitleWithAnimation
            ) {
              layoutContext.updateChatTitleWithAnimation(
                currentChatId,
                String(doneTitle),
              );
            }

            if (
              !isPersonaTest &&
              currentChatId &&
              layoutContext?.moveChatToTop
            ) {
              layoutContext.moveChatToTop(currentChatId);
            }

            setLastMessageId(loadingMessageId);
            setIsResponding(false);
            streamFinished = true;
          }

          if (eventName === "error") {
            const rawError =
              typeof parsed.error === "string"
                ? parsed.error
                : "Unexpected error from model";

            const lower = rawError.toLowerCase();
            if (
              lower.includes("token expired") ||
              lower.includes("not authenticated") ||
              lower.includes("unauthorized")
            ) {
              flushQueuedAiUpdate();
              queueAiMessageUpdate(
                {
                  content: "Your session has expired. Signing you out\u2026",
                  isLoading: false,
                },
                true,
              );
              setIsResponding(false);
              streamFinished = true;
              shouldStopReading = true;
              console.error("[useStreamingChat] session expired via SSE error event");
              window.dispatchEvent(new Event("auth:session-expired"));
            } else {
              const errorMessage = friendlyApiError(rawError);
              console.error("[useStreamingChat] SSE stream error:", rawError);
              flushQueuedAiUpdate();
              queueAiMessageUpdate(
                {
                  content: errorMessage,
                  thinkingContent: null,
                  isLoading: false,
                  toolStatus: null,
                },
                true,
              );
              setIsResponding(false);
              streamFinished = true;
              shouldStopReading = true;
            }
          }
        }
      }; // end processChunk

      // ── Main read loop ─────────────────────────────────────────────────────

      while (true) {
        const { value, done } = await streamReader.read();
        if (value) processChunk(value);
        if (done || shouldStopReading) break;
      }

      // Flush any data left in the buffer (stream may end without trailing \n\n)
      if (buffer.trim()) {
        buffer += "\n\n";
        processChunk(new Uint8Array(0));
      }

      streamReader.cancel().catch(() => {});
      flushQueuedAiUpdate();

      // Stream closed without a `done` or `error` event — treat accumulated
      // content as the complete response
      if (!streamFinished) {
        if (assistantContent) {
          const sanitized = extractThinkingContent(assistantContent);
          const finalReasoning = reasoningContent || sanitized.thinkingText;
          queueAiMessageUpdate(
            {
              content: sanitized.visibleText || assistantContent,
              thinkingContent: finalReasoning || null,
              isThinkingInProgress: false,
              isLoading: false,
            },
            true,
          );
        } else {
          queueAiMessageUpdate(
            {
              content: "Generation interrupted. Please retry.",
              thinkingContent: null,
              isLoading: false,
            },
            true,
          );
        }
        setIsResponding(false);
      }
    } catch (error) {
      // User-initiated stop — graceful cancellation, not an error
      if (stopRequestedRef.current) {
        try {
          reader?.cancel();
        } catch {
          // ignore
        }
        setMessages(
          (prev = []) =>
            prev.map((msg) => {
              if (msg.id !== loadingMessageId) return msg;
              const baseContent = msg.content || "";
              const marker = "Generation Stopped By User";
              const hasMarker = baseContent.includes(marker);
              const suffix =
                baseContent.length > 0
                  ? hasMarker
                    ? ""
                    : `\n\n${marker}`
                  : marker;
              return {
                ...msg,
                content: `${baseContent}${suffix}`,
                isLoading: false,
                isThinkingInProgress: false,
                metadata: { ...msg.metadata, stoppedByUser: true },
              };
            }),
          chatId ?? undefined,
        );
        setIsResponding(false);
        return;
      }

      try {
        reader?.cancel();
      } catch {
        // ignore
      }
      console.error("[useStreamingChat] error:", error);

      const rawMsg =
        error instanceof Error && error.message
          ? error.message
          : "Failed to connect to AI service";

      const lower = rawMsg.toLowerCase();
      if (
        lower.includes("token expired") ||
        lower.includes("session has expired") ||
        lower.includes("not authenticated") ||
        lower.includes("unauthorized") ||
        lower.includes("401")
      ) {
        console.error("[useStreamingChat] session expired (catch)");
        setIsResponding(false);
        window.dispatchEvent(new Event("auth:session-expired"));
        return;
      }

      const errorMessage = friendlyApiError(rawMsg);
      console.error("[useStreamingChat] chat request failed:", rawMsg);

      const errorResponse: Message = {
        id: loadingMessageId,
        sender: "ai",
        content: errorMessage,
        avatarUrl: avatarForRequest.avatarUrl,
        avatarHint: avatarForRequest.avatarHint,
      };

      setMessages(
        (prev = []) =>
          prev.map((msg) =>
            msg.id === loadingMessageId ? errorResponse : msg,
          ),
        chatId ?? undefined,
      );

      toast.error("Unable to reach model", { description: errorMessage });
      setIsResponding(false);
    }

  };

  // ── Return value ───────────────────────────────────────────────────────────

  return {
    messageBufferRef,
    fetchAiResponse,
    handleStopGeneration,
  };
}

/** Convenience type alias. */
export type StreamingChatReturn = ReturnType<typeof useStreamingChat>;
