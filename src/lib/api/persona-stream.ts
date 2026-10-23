"use client";

import { apiFetch } from "./client";
import type { Connector } from "@/lib/connector";
import { parseChatPrompt, parsePermissionPrompt, type ChatPrompt, type ConnectorPermissionPrompt } from "./prompts";
import { AguiSSEDecoder } from "@/lib/sse-decoder";
import { friendlyModelError } from "@/lib/model-error";
import { normalizeActivityStatus, toolNameToType } from "@/lib/activity";
import type { ActivityType, GeneratedFile } from "@/types/chat";
import { toConnector } from "@/lib/connector";
import { PERSONA_GUIDE_ENDPOINT, PERSONA_VERSION_TEST_ENDPOINT, PERSONA_CHATS_CREATE_ENDPOINT, PERSONA_CHAT_STREAM_ENDPOINT, directUpload } from "@/lib/config";
import type { Persona } from "./persona-model";
import { bustPersonaChatsCache } from "./persona-chats";
import { PERSONA_CREATE_FIELDS, PERSONA_STREAM_FIELDS, keepAcceptedFields } from "@/lib/chat-form-fields";

// ── Persona test chat ─────────────────────────────────────────────────────────

export interface PersonaStreamUsage {
  completion_tokens?: number;
  prompt_tokens?: number;
  total_tokens?: number;
  cost?: number;
  [k: string]: unknown;
}

export interface PersonaDoneEventPayload {
  usage?: PersonaStreamUsage | null;
  reasoning_details?: unknown[] | null;
  tool_calls?: Array<Record<string, unknown>> | null;
  finish_reason?: string | null;
}

export interface PersonaWebSearchEvent {
  query: string;
  links: unknown[];
  results: unknown[];
}

export interface PersonaImageEvent {
  url: string;
  s3_key: string;
}

export type PersonaActivityType = ActivityType

export type PersonaActivityStatus = 'start' | 'executing' | 'reading' | 'done' | 'error' | 'stopped'

export interface PersonaActivityItem {
  id:               string
  type:             PersonaActivityType
  toolName?:        string
  label?:           string
  detail?:          string
  status:           PersonaActivityStatus
  durationS?:       number
  progressMessage?: string
  codePreview?:     string
  filename?:        string
  results?:         { title: string; url?: string; domain?: string }[]
}

/** Canonical connect-prompt shape — aliased so persona stream consumers keep
 *  their existing import. */
export type PersonaConnectPrompt = import('@/types/chat').ConnectorConnectPrompt

/** Canonical permission-prompt shape, zod-parsed in lib/api/prompts.ts —
 *  aliased so persona stream consumers keep their existing import. */
export type PersonaPermissionPrompt = ConnectorPermissionPrompt

export interface PersonaChatStreamCallbacks {
  /** Called with the chatId extracted from the X-Chat-Id response header. */
  onChatId?: (chatId: string) => void;
  /** Called for each streamed assistant text token. */
  onChunk?: (delta: string) => void;
  /** Called with the persisted assistant message id. */
  onMessageSaved?: (messageId: string) => void;
  /** Called when the backend auto-titles a new chat. */
  onTitle?: (title: string) => void;
  /** Called with each delta of a reasoning section's body. */
  onReasoningBody?: (delta: string) => void;
  /** Called when a new reasoning section opens. */
  onReasoningHeading?: (heading: string) => void;
  /** Called when a web search tool runs. */
  onWebSearch?: (event: PersonaWebSearchEvent) => void;
  /** Called when an image is generated. */
  onImage?: (event: PersonaImageEvent) => void;
  /** Called when a tool produces a downloadable file. */
  onGeneratedFile?: (event: GeneratedFile) => void;
  /** Called after user or project memory is updated. */
  onMemoryUpdated?: (event: Record<string, unknown>) => void;
  /** Called when a tool starts executing, progresses, or completes. Upsert by id. */
  onToolActivity?: (item: PersonaActivityItem) => void;
  /** Called when the backend requests the user link a connector. */
  onConnectPrompt?: (prompt: PersonaConnectPrompt) => void;
  /** Called when the backend requests permission to run a connector tool. */
  onPermissionPrompt?: (prompt: PersonaPermissionPrompt) => void;
  /** Called for generic questions, choices, and non-connector approvals. */
  onChatPrompt?: (prompt: ChatPrompt) => void;
  /** Called when the stream finishes successfully. Receives the `done` payload. */
  onDone?: (payload?: PersonaDoneEventPayload) => void;
  /** Called on error (network or stream-level). */
  onError?: (error: string) => void;
}

/**
 * Build the request body + headers for a persona-stream call. Uses
 * `application/x-www-form-urlencoded` when no files are attached and
 * `multipart/form-data` only when binary uploads are present.
 *
 * Multipart bodies POSTed through Next.js dev's streaming proxy can be
 * buffered until the body completes, which breaks SSE — using urlencoded
 * for the text-only path avoids that.
 */
function buildStreamBody(
  input: string,
  options?: {
    files?: File[];
    useMistralOcr?: boolean;
    disabledConnectors?: string[];
    /** Connector slugs enabled for this persona version — forwarded to the backend so
     *  the test/chat endpoint knows which connector tools are in scope. */
    connectorSlugs?: string[];
    /** Model ID override — forwarded so the backend uses the currently selected model
     *  rather than the version's stored model (useful when model changed but not yet saved). */
    modelId?: string | null;
  },
  /** When set, every other field is dropped before sending. */
  accepted?: ReadonlySet<string>,
): { body: BodyInit; headers?: HeadersInit } {
  const hasFiles = (options?.files?.length ?? 0) > 0;
  if (hasFiles) {
    const form = new FormData();
    form.append("input", input);
    if (options?.useMistralOcr) form.append("use_mistral_ocr", "true");
    options!.files!.forEach(f => form.append("files", f));
    options?.disabledConnectors?.forEach(slug => form.append("disabled_connectors", slug));
    options?.connectorSlugs?.forEach(slug => form.append("connector_slugs", slug));
    if (options?.modelId) form.append("model_id", options.modelId);
    return { body: accepted ? keepAcceptedFields(form, accepted) : form };
  }
  const params = new URLSearchParams();
  params.append("input", input);
  if (options?.useMistralOcr) params.append("use_mistral_ocr", "true");
  options?.disabledConnectors?.forEach(slug => params.append("disabled_connectors", slug));
  options?.connectorSlugs?.forEach(slug => params.append("connector_slugs", slug));
  if (options?.modelId) params.append("model_id", options.modelId);
  return {
    body: (accepted ? keepAcceptedFields(params, accepted) : params).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
}

/** Shared SSE reader used by both create-chat and stream-message. */
async function readPersonaSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: PersonaChatStreamCallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  const sseDecoder = new AguiSSEDecoder();
  let doneSeen = false;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const toolCallIdByName = new Map<string, string>();
  const erroredToolNames = new Set<string>();
  // After `done`, give the server a brief window to flush trailing events
  // (`message_saved`, `title`) and then cancel the reader so the fetch is
  // released even if the server keeps the SSE connection idle-open.
  let postDoneTimer: ReturnType<typeof setTimeout> | null = null;
  const armPostDoneCancel = () => {
    if (postDoneTimer) clearTimeout(postDoneTimer);
    postDoneTimer = setTimeout(() => { reader.cancel().catch(() => {}); }, 1500);
  };
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- sequential SSE stream reader; chunks must be processed in order
      const { done, value } = await reader.read();
      const decodedEvents = value
        ? sseDecoder.push(decoder.decode(value, { stream: true }))
        : [];
      if (done) {
        decodedEvents.push(...sseDecoder.push(decoder.decode()), ...sseDecoder.flush());
      }
      for (const decodedEvent of decodedEvents) {
          if (!decodedEvent.appEvent) continue;
          const { eventName, parsed } = decodedEvent.appEvent;
          switch (eventName) {
            case "content":
              callbacks.onChunk?.(str(parsed.content));
              break;
            case "reasoning_heading":
              callbacks.onReasoningHeading?.(str(parsed.content));
              break;
            case "reasoning_body":
              callbacks.onReasoningBody?.(str(parsed.content));
              break;
            case "message_saved":
              if (typeof parsed.message_id === "string") {
                callbacks.onMessageSaved?.(parsed.message_id);
              }
              break;
            case "title":
              if (typeof parsed.title === "string") {
                callbacks.onTitle?.(parsed.title);
              }
              break;
            case "web_search":
              callbacks.onWebSearch?.({
                query: str(parsed.query),
                links: Array.isArray(parsed.links) ? parsed.links : [],
                results: Array.isArray(parsed.results) ? parsed.results : [],
              });
              break;
            case "image":
              if (typeof parsed.url === "string" && typeof parsed.s3_key === "string") {
                callbacks.onImage?.({ url: parsed.url, s3_key: parsed.s3_key });
              }
              break;
            case "generated_file":
              if (typeof parsed.url === "string" && typeof parsed.filename === "string") {
                callbacks.onGeneratedFile?.({
                  url: parsed.url,
                  filename: parsed.filename,
                  s3Key: str(parsed.s3_key) || undefined,
                  mimeType: str(parsed.mime_type) || undefined,
                });
              }
              break;
            case "memory_updated":
              callbacks.onMemoryUpdated?.(parsed);
              break;
            case "done": {
              const finishReason =
                typeof parsed.finish_reason === "string" ? parsed.finish_reason : null;
              if (finishReason === "tool_calls") {
                // Agentic intermediate round — backend is executing tools and will
                // emit more events on this same stream. Mirror use-streaming-chat.ts
                // behaviour and keep reading instead of finalising.
                break;
              }
              doneSeen = true;
              armPostDoneCancel();
              callbacks.onDone?.({
                usage: (parsed.usage as PersonaStreamUsage | null | undefined) ?? null,
                reasoning_details: Array.isArray(parsed.reasoning_details)
                  ? parsed.reasoning_details
                  : null,
                tool_calls: Array.isArray(parsed.tool_calls)
                  ? (parsed.tool_calls as Array<Record<string, unknown>>)
                  : null,
                finish_reason: finishReason,
              });
              break;
            }
            case "tool_calls_streaming":
              break; // partial args — no UI update needed
            case "tool_executing": {
              const toolCall = parsed.tool_call as Record<string, unknown> | undefined
              const toolName = str(toolCall?.name ?? parsed.content) || "tool"
              const label    = str(parsed.label) || undefined
              const callId   = str(toolCall?.tool_call_id) || `te-${toolName}-${Date.now()}`
              toolCallIdByName.set(toolName, callId)
              callbacks.onToolActivity?.({
                id: callId, type: toolNameToType(toolName), toolName,
                label, detail: label ?? toolName.replace(/_/g, " "), status: "executing",
              })
              break
            }
            case "docx_progress":
            case "tool_progress": {
              const toolName = str(parsed.tool) || (eventName === "docx_progress" ? "docx_execute" : "unknown")
              const label    = str(parsed.label) || undefined
              const status   = normalizeActivityStatus(str(parsed.status))
              const activityId = toolCallIdByName.get(toolName) ?? `tp-${toolName}-${str(parsed.filename) || "x"}`
              if (status === "error") erroredToolNames.add(toolName)
              callbacks.onToolActivity?.({
                id: activityId, type: toolNameToType(toolName), toolName,
                label, detail: label ?? toolName, status,
                filename:        str(parsed.filename)      || undefined,
                progressMessage: str(parsed.message)       || undefined,
                codePreview:     str(parsed.code_preview)  || undefined,
              })
              break
            }
            case "tool_complete": {
              const toolCall   = parsed.tool_call as Record<string, unknown> | undefined
              const toolName   = str(toolCall?.name ?? parsed.content) || undefined
              const callId     = str(toolCall?.tool_call_id) || (toolName ? toolCallIdByName.get(toolName) : undefined)
              const label      = str(parsed.label) || undefined
              const durationS  = typeof toolCall?.duration_s === "number" ? toolCall.duration_s : undefined
              const status = toolName && erroredToolNames.has(toolName) ? "error" : "done"
              if (toolName) toolCallIdByName.delete(toolName)
              if (toolName) erroredToolNames.delete(toolName)
              if (callId) {
                callbacks.onToolActivity?.({
                  id: callId, type: toolName ? toolNameToType(toolName) : "tool-call",
                  toolName, label, detail: label ?? toolName, status, durationS,
                })
              }
              break
            }
            case "tool_connect_prompt": {
              type ApiKeyField = import('@/lib/api/connectors').ApiKeyField
              const rawFields = parsed.api_key_fields
              const apiKeyFields: ApiKeyField[] | undefined = Array.isArray(rawFields)
                ? rawFields.filter(
                    (f): f is ApiKeyField =>
                      typeof f === 'object' && f !== null &&
                      typeof (f as Record<string, unknown>).name === 'string',
                  )
                : undefined
              callbacks.onConnectPrompt?.({
                request_id:     typeof parsed.prompt_id === 'string' ? parsed.prompt_id : `ccp-${Date.now()}`,
                connector:      toConnector(parsed),
                auth_mode:      (str(parsed.auth_mode) || 'oauth2') as 'oauth2' | 'api_key',
                tool_name:      str(parsed.tool_slug),
                api_key_fields: apiKeyFields,
              })
              break
            }
            case "permission_prompt": {
              const permPrompt = parsePermissionPrompt(parsed)
              if (permPrompt) callbacks.onPermissionPrompt?.(permPrompt)
              break
            }
            case "user_prompt":
            case "question_prompt":
            case "approval_prompt": {
              const prompt = parseChatPrompt(eventName, parsed)
              if (prompt) callbacks.onChatPrompt?.(prompt)
              break
            }
            case "error":
              callbacks.onError?.(friendlyModelError(str(parsed.error)));
              return;
            case "stream_heartbeat":
              break;
          }
      }
      if (done) break;
    }
    if (!doneSeen) callbacks.onDone?.();
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.(friendlyModelError((err as Error).message ?? "Stream read error"));
    } else if (!doneSeen) {
      // Abort clears the stream without an error event — still need to
      // finalise the message so the streaming lock is released.
      callbacks.onDone?.();
    }
  } finally {
    if (postDoneTimer) clearTimeout(postDoneTimer);
    reader.cancel().catch(() => {});
  }
}

/**
 * Send a single stateless test message to a specific persona version and stream
 * the response. No chat session is created; each call is independent.
 * Returns an abort function that cancels the in-flight request.
 */
export async function testVersionStream(
  repoId: string,
  versionId: string,
  input: string,
  callbacks: PersonaChatStreamCallbacks,
  options?: { files?: File[]; disabledConnectors?: string[]; connectorSlugs?: string[]; modelId?: string | null },
): Promise<() => void> {
  const controller = new AbortController();
  const { body, headers } = buildStreamBody(input, options);
  // Multipart (file attachments) bypasses the 4.5 MB serverless proxy cap by
  // going direct to the backend; text-only stays on the same-origin proxy.
  const endpoint = body instanceof FormData
    ? directUpload(PERSONA_VERSION_TEST_ENDPOINT(repoId, versionId))
    : PERSONA_VERSION_TEST_ENDPOINT(repoId, versionId);
  let response: Response;
  try {
    response = await apiFetch(endpoint, {
      method: "POST",
      body,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.(friendlyModelError((err as Error).message ?? "Failed to test persona"));
    } else {
      // Request aborted before connecting — finalise so the streaming lock is released.
      callbacks.onDone?.();
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(friendlyModelError(text || `HTTP ${response.status}`, response.status));
    return () => controller.abort();
  }
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(friendlyModelError("No response body"));
    return () => controller.abort();
  }
  readPersonaSSEStream(reader, callbacks);
  return () => controller.abort();
}

/**
 * Create a new persona chat session and stream the first assistant response.
 * The chatId is surfaced via `callbacks.onChatId` so callers can store it
 * for follow-up messages.
 * Returns an abort function that cancels the in-flight request.
 */
export async function createAndStreamPersonaChat(
  repoId: string,
  input: string,
  callbacks: PersonaChatStreamCallbacks,
  options?: { files?: File[]; useMistralOcr?: boolean; connectorSlugs?: string[] },
): Promise<() => void> {
  const controller = new AbortController();
  // The backend refuses connector, model and OCR fields on this route (it never read them).
  const { body, headers } = buildStreamBody(input, options, PERSONA_CREATE_FIELDS);
  // Multipart (file attachments) bypasses the 4.5 MB serverless proxy cap by
  // going direct to the backend; text-only stays on the same-origin proxy.
  const endpoint = body instanceof FormData
    ? directUpload(PERSONA_CHATS_CREATE_ENDPOINT(repoId))
    : PERSONA_CHATS_CREATE_ENDPOINT(repoId);
  let response: Response;
  try {
    response = await apiFetch(endpoint, {
      method: "POST",
      body,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.(friendlyModelError((err as Error).message ?? "Failed to create persona chat"));
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(friendlyModelError(text || `HTTP ${response.status}`, response.status));
    return () => controller.abort();
  }
  // A new chat now exists for this agent — any cached list of its chats is stale.
  bustPersonaChatsCache(repoId);
  const chatId = response.headers.get("X-Chat-Id");
  if (chatId) callbacks.onChatId?.(chatId);
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(friendlyModelError("No response body"));
    return () => controller.abort();
  }
  readPersonaSSEStream(reader, callbacks);
  return () => controller.abort();
}

// ── Persona guide (AI suggestions) ───────────────────────────────────────────

/** A single turn in the in-memory guide conversation history. */
export interface GuideMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /persona/{repo_id}/guide — stream improvement advice for a draft persona.
 * Sends the current editor state as context; the draft need not be saved.
 * History is maintained client-side and replayed on every call.
 * Returns an abort function that cancels the in-flight request.
 */
export async function guidePersonaStream(
  repoId: string,
  params: {
    question: string;
    prompt?: string;
    description?: string;
    name?: string | null;
    model_id?: string | null;
    temperature?: number | null;
    history?: GuideMessage[];
    web_search?: boolean;
  },
  callbacks: PersonaChatStreamCallbacks,
): Promise<() => void> {
  const controller = new AbortController();

  const requestBody = {
    question:    params.question,
    prompt:      params.prompt      ?? "",
    description: params.description ?? "",
    name:        params.name        ?? null,
    model_id:    params.model_id ?? null,
    temperature: params.temperature ?? null,
    history:     params.history     ?? [],
    web_search:  params.web_search  ?? false,
  };

  let response: Response;
  try {
    response = await apiFetch(PERSONA_GUIDE_ENDPOINT(repoId), {
      method: "POST",
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.(friendlyModelError((err as Error).message ?? "Failed to get AI suggestions"));
    }
    return () => controller.abort();
  }

  if (!response.ok) {
    // 401 is already handled by apiFetch (toast + session-expired event); just abort silently.
    if (response.status === 401) return () => controller.abort();

    const errorText = await response.text().catch(() => "");
    const errorLower = errorText.toLowerCase();
    const isModelUnavailable =
      response.status === 404 && errorLower.includes("no endpoints found");
    const isModelNotConfigured =
      response.status === 503 ||
      (errorLower.includes("model") && errorLower.includes("not configured"));

    if (isModelUnavailable || isModelNotConfigured) {
      callbacks.onError?.("The AI model for this persona is unavailable. Please select a different model in the Instructions tab and save.");
      return () => controller.abort();
    }
    callbacks.onError?.(friendlyModelError(errorText || `HTTP ${response.status}`, response.status));
    return () => controller.abort();
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(friendlyModelError("No response body"));
    return () => controller.abort();
  }
  readPersonaSSEStream(reader, callbacks);
  return () => controller.abort();
}

/**
 * Send a follow-up message in an existing persona chat session and stream
 * the assistant response.
 * Returns an abort function that cancels the in-flight request.
 */
export async function streamPersonaMessage(
  repoId: string,
  chatId: string,
  input: string,
  callbacks: PersonaChatStreamCallbacks,
  options?: { files?: File[]; useMistralOcr?: boolean; connectorSlugs?: string[] },
): Promise<() => void> {
  const controller = new AbortController();
  // The backend refuses connector, model and OCR fields on this route (it never read them).
  const { body, headers } = buildStreamBody(input, options, PERSONA_STREAM_FIELDS);
  // Multipart (file attachments) bypasses the 4.5 MB serverless proxy cap by
  // going direct to the backend; text-only stays on the same-origin proxy.
  const endpoint = body instanceof FormData
    ? directUpload(PERSONA_CHAT_STREAM_ENDPOINT(repoId, chatId))
    : PERSONA_CHAT_STREAM_ENDPOINT(repoId, chatId);
  let response: Response;
  try {
    response = await apiFetch(endpoint, {
      method: "POST",
      body,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.(friendlyModelError((err as Error).message ?? "Failed to stream message"));
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(friendlyModelError(text || `HTTP ${response.status}`, response.status));
    return () => controller.abort();
  }
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(friendlyModelError("No response body"));
    return () => controller.abort();
  }
  readPersonaSSEStream(reader, callbacks);
  return () => controller.abort();
}

