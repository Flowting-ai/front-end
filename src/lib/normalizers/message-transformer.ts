/**
 * message-transformer.ts
 *
 * Shared normalizers that convert raw backend API messages into the typed
 * `Message` shape used throughout the UI.
 *
 * These are pure, side-effect-free functions. They contain no React or
 * browser-specific code and may be called from any component or hook.
 *
 * Consumers:
 *   - extractMetadata        → app-layout.tsx (3 call sites)
 *   - normalizeBackendMessage → app-layout.tsx (1 call site)
 */

import type { BackendMessage } from "@/lib/api/chat";
import type { Message } from "@/components/chat/chat-message";
import { extractThinkingContent } from "@/lib/parsers/content-parser";

// ---------------------------------------------------------------------------
// Internal helpers  (module-private)
// ---------------------------------------------------------------------------

/**
 * Returns the trimmed string value, or `null` if the value is not a non-empty
 * string after trimming.
 * @internal
 */
function toOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Shape of a single web-search result entry. @internal */
interface WebSearchPayload {
  query: string;
  links: string[];
}

/**
 * Coerces an arbitrary API value into a `WebSearchPayload`, or `null` if
 * the payload lacks a usable query string.
 * @internal
 */
function normalizeWebSearchPayload(raw: unknown): WebSearchPayload | null {
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
}

/**
 * Accepts a single payload object or an array and returns a normalised
 * `WebSearchPayload | WebSearchPayload[] | undefined`.
 * @internal
 */
function normalizeWebSearchInput(
  raw: unknown,
): WebSearchPayload | WebSearchPayload[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const items = raw
      .map((entry) => normalizeWebSearchPayload(entry))
      .filter((item): item is WebSearchPayload => Boolean(item));
    return items.length > 0 ? items : undefined;
  }
  return normalizeWebSearchPayload(raw) ?? undefined;
}

/**
 * Extracts a string pin ID from whatever shape the backend sends:
 * a bare string/number, or an object with `id`/`pin_id`/`pinId`.
 * @internal
 */
function extractPinId(p: unknown): string | null {
  if (p === undefined || p === null) return null;
  if (typeof p === "string" || typeof p === "number") return String(p) || null;
  if (typeof p === "object") {
    const o = p as Record<string, unknown>;
    const id = o.id ?? o.pin_id ?? o.pinId;
    return id !== undefined && id !== null ? String(id) : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// extractMetadata
// ---------------------------------------------------------------------------

/**
 * Extracts all UI-relevant metadata from a raw backend message object.
 *
 * The backend is inconsistent about field names (snake_case vs camelCase,
 * top-level vs nested in a `metadata` envelope). This function resolves
 * every variant into the flat `Message["metadata"]` shape used by the UI.
 *
 * Fields resolved:
 * - `modelName`, `providerName`, `llmModelId`
 * - `inputTokens`, `outputTokens`, `createdAt`
 * - `documentId`, `documentUrl`
 * - `pinIds`, `mentionedPins`
 * - `webSearch`, `webSearchEnabled`
 * - `userReaction`
 * - `cost`, `latencyMs`
 *
 * @param msg - A raw `BackendMessage` payload from the API.
 * @returns A partial `Message["metadata"]` object (never throws).
 */
export const extractMetadata = (msg: BackendMessage): Message["metadata"] => {
  const meta = (msg as { metadata?: Record<string, unknown> }).metadata ?? {};

  // --- pin IDs ---
  const pinsRaw: unknown[] = Array.isArray(
    (msg as { taggedPins?: unknown[] }).taggedPins,
  )
    ? ((msg as { taggedPins: unknown[] }).taggedPins as unknown[])
    : Array.isArray((msg as { pins_tagged?: unknown[] }).pins_tagged)
      ? ((msg as { pins_tagged: unknown[] }).pins_tagged as unknown[])
      : Array.isArray((msg as { pin_ids?: unknown[] }).pin_ids)
        ? ((msg as { pin_ids: unknown[] }).pin_ids as unknown[])
        : Array.isArray((meta as { pinIds?: unknown[] }).pinIds)
          ? ((meta as { pinIds: unknown[] }).pinIds as unknown[])
          : Array.isArray((meta as { pin_ids?: unknown[] }).pin_ids)
            ? ((meta as { pin_ids: unknown[] }).pin_ids as unknown[])
            : [];

  const pinIds = pinsRaw
    .map(extractPinId)
    .filter((p): p is string => Boolean(p));

  // --- mentioned pins (full pin objects, not bare IDs) ---
  const rawPinsTagged: unknown[] = Array.isArray(
    (msg as { taggedPins?: unknown[] }).taggedPins,
  )
    ? ((msg as { taggedPins: unknown[] }).taggedPins as unknown[])
    : Array.isArray((msg as { pins_tagged?: unknown[] }).pins_tagged)
      ? ((msg as { pins_tagged: unknown[] }).pins_tagged as unknown[])
      : [];

  const mentionedPins: Array<{ id: string; label: string; text: string }> =
    rawPinsTagged
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const o = p as Record<string, unknown>;
        const id = extractPinId(p);
        if (!id) return null;
        const text = String(o.text ?? o.content ?? o.formattedContent ?? "");
        const label =
          String(o.title ?? o.label ?? text).slice(0, 80) || id;
        return { id, label, text };
      })
      .filter(
        (p): p is { id: string; label: string; text: string } => p !== null,
      );

  // --- web search ---
  const webSearchRaw =
    (msg as { web_search?: unknown }).web_search ??
    (msg as { webSearch?: unknown }).webSearch ??
    (msg as { web_searches?: unknown }).web_searches ??
    (msg as { webSearches?: unknown }).webSearches ??
    (meta as { web_search?: unknown }).web_search ??
    (meta as { webSearch?: unknown }).webSearch ??
    (meta as { web_searches?: unknown }).web_searches ??
    (meta as { webSearches?: unknown }).webSearches ??
    null;

  const webSearch = normalizeWebSearchInput(webSearchRaw);

  const webSearchEnabled =
    (msg as { web_search_enabled?: unknown }).web_search_enabled ??
    (msg as { webSearchEnabled?: unknown }).webSearchEnabled ??
    (meta as { web_search_enabled?: unknown }).web_search_enabled ??
    (meta as { webSearchEnabled?: unknown }).webSearchEnabled ??
    undefined;

  return {
    modelName:
      (msg as { model_name?: string }).model_name ??
      (msg as { modelName?: string }).modelName ??
      (msg as { llm_model_name?: string }).llm_model_name ??
      (meta as { modelName?: string }).modelName ??
      (meta as { model_name?: string }).model_name ??
      (meta as { llm_model_name?: string }).llm_model_name,
    providerName:
      (msg as { provider_name?: string }).provider_name ??
      (msg as { providerName?: string }).providerName ??
      (msg as { company_name?: string }).company_name ??
      (msg as { companyName?: string }).companyName ??
      (meta as { providerName?: string }).providerName ??
      (meta as { provider_name?: string }).provider_name ??
      (meta as { companyName?: string }).companyName ??
      (meta as { company_name?: string }).company_name,
    llmModelId:
      (msg as { llm_model_id?: string | number | null }).llm_model_id ??
      (meta as { llmModelId?: string | number | null }).llmModelId ??
      (meta as { llm_model_id?: string | number | null }).llm_model_id ??
      null,
    inputTokens:
      (msg as { tokens_input?: number }).tokens_input ??
      (msg as { input_tokens?: number }).input_tokens ??
      (meta as { inputTokens?: number }).inputTokens ??
      (meta as { input_tokens?: number }).input_tokens,
    outputTokens:
      (msg as { tokens_output?: number }).tokens_output ??
      (msg as { output_tokens?: number }).output_tokens ??
      (meta as { outputTokens?: number }).outputTokens ??
      (meta as { output_tokens?: number }).output_tokens,
    createdAt:
      (msg as { created_at?: string }).created_at ??
      (meta as { createdAt?: string }).createdAt ??
      (meta as { created_at?: string }).created_at,
    documentId:
      (msg as { document_id?: string | null }).document_id ??
      (meta as { documentId?: string | null }).documentId ??
      (meta as { document_id?: string | null }).document_id ??
      null,
    documentUrl:
      (msg as { document_url?: string | null }).document_url ??
      (meta as { documentUrl?: string | null }).documentUrl ??
      (meta as { document_url?: string | null }).document_url ??
      null,
    pinIds,
    mentionedPins: mentionedPins.length > 0 ? mentionedPins : undefined,
    ...(webSearch ? { webSearch } : {}),
    ...(webSearchEnabled !== undefined
      ? { webSearchEnabled: Boolean(webSearchEnabled) }
      : {}),
    userReaction:
      (msg as { user_reaction?: string | null }).user_reaction ??
      (meta as { userReaction?: string | null }).userReaction ??
      (meta as { user_reaction?: string | null }).user_reaction ??
      null,
    cost: (() => {
      const raw =
        (msg as { cost?: number | string }).cost ??
        (meta as { cost?: number | string }).cost;
      if (raw === undefined || raw === null) return undefined;
      const n = typeof raw === "number" ? raw : parseFloat(raw as string);
      return isNaN(n) ? undefined : n;
    })(),
    latencyMs:
      (msg as { latency_ms?: number }).latency_ms ??
      (meta as { latencyMs?: number }).latencyMs ??
      (meta as { latency_ms?: number }).latency_ms,
  };
};

// ---------------------------------------------------------------------------
// normalizeBackendMessage
// ---------------------------------------------------------------------------

/**
 * Transforms a raw `BackendMessage` payload into a fully-typed `Message`
 * object suitable for display in the chat UI.
 *
 * Responsibilities:
 * - Resolves `sender` from `sender` / `role` fields (normalises "assistant" → "ai").
 * - Selects the best available content field (`content`, `message`, `output`, …).
 * - Strips `<think>` reasoning blocks from AI messages via `extractThinkingContent`.
 * - Preserves a dedicated backend `reasoning` / `thinking_content` field when present.
 * - Extracts all metadata via `extractMetadata`.
 * - Parses attachment arrays from the raw payload.
 * - Generates a stable `id` from the backend ID, falling back to `crypto.randomUUID()`.
 *
 * @param msg - A raw `BackendMessage` from `fetchChatMessages` or similar.
 * @returns A fully-populated `Message` object.
 */
export const normalizeBackendMessage = (msg: BackendMessage): Message => {
  const senderRaw = (msg.sender || msg.role || "user").toLowerCase();
  const sender: Message["sender"] =
    senderRaw === "ai" || senderRaw === "assistant" ? "ai" : "user";

  const baseContent =
    msg.content ||
    msg.message ||
    msg.output ||
    msg.input ||
    (msg as { response?: string }).response ||
    (msg as { prompt?: string }).prompt ||
    "";

  const { visibleText, thinkingText } =
    sender === "ai"
      ? extractThinkingContent(baseContent)
      : { visibleText: baseContent, thinkingText: null };

  // Prefer the explicit backend reasoning field; fall back to <think> extraction.
  const backendReasoning =
    (msg as { reasoning?: string | null }).reasoning ??
    (msg as { thinking_content?: string | null }).thinking_content ??
    null;
  const finalReasoning = backendReasoning || thinkingText;

  const metadata: Message["metadata"] = extractMetadata(msg);

  // Parse attachments from the backend payload.
  const rawAttachments = (msg as { attachments?: unknown[] }).attachments;
  if (Array.isArray(rawAttachments) && rawAttachments.length > 0 && metadata) {
    metadata.attachments = rawAttachments
      .filter(
        (a): a is Record<string, unknown> =>
          a !== null && typeof a === "object",
      )
      .map((a, i) => ({
        id: String(a.id ?? `att-${i}`),
        type: (
          String(a.type ?? a.file_type ?? "image").startsWith("image") ||
          Boolean(
            String(a.name ?? a.file_name ?? "").match(
              /\.(png|jpe?g|gif|webp|svg|bmp)$/i,
            ),
          )
        )
          ? ("image" as const)
          : ("pdf" as const),
        name: String(a.name ?? a.file_name ?? a.filename ?? "attachment"),
        url: String(a.url ?? a.file_url ?? a.file ?? ""),
      }))
      .filter((a) => a.url);
  }

  const rawId =
    msg.id !== undefined && msg.id !== null
      ? msg.id
      : (msg as { message_id?: string | number | null }).message_id ?? null;

  const resolvedId =
    rawId !== null && rawId !== undefined
      ? String(rawId)
      : crypto.randomUUID();

  return {
    id: resolvedId,
    sender,
    content: visibleText,
    thinkingContent: finalReasoning,
    isThinkingInProgress: false,
    metadata,
    chatMessageId:
      rawId !== null && rawId !== undefined ? String(rawId) : undefined,
    referencedMessageId:
      (msg as BackendMessage).reference_id ??
      (msg as { referenced_message_id?: string | null })
        .referenced_message_id ??
      null,
  };
};
