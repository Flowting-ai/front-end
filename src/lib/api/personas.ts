"use client";

import { apiFetch, apiFetchJson } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
  PERSONA_ENHANCE_ENDPOINT,
  PERSONA_PAUSE_ENDPOINT,
  PERSONA_ACTIVE_ENDPOINT,
  PERSONA_VERSIONS_ENDPOINT,
  PERSONA_VERSION_DETAIL_ENDPOINT,
  PERSONA_VERSION_TEST_ENDPOINT,
  PERSONA_VERSION_DOCUMENT_ENDPOINT,
  PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT,
  PERSONA_CHATS_ENDPOINT,
  PERSONA_CHATS_CREATE_ENDPOINT,
  PERSONA_CHAT_MESSAGES_ENDPOINT,
  PERSONA_CHAT_STREAM_ENDPOINT,
  PERSONA_CHATS_RENAME_ENDPOINT,
  PERSONA_CHAT_STOP_ENDPOINT,
  PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT,
} from "@/lib/config";

// ── Backend types (match OpenAPI schema) ──────────────────────────────────────

export interface PersonaDocumentResponse {
  id: string;
  document_filename: string;
  created_at: string;
}

export interface PersonaVersionResponse {
  id: string;
  persona_repo_id: string;
  name: string;
  handler: string;
  prompt: string;
  is_active: boolean;
  model_id: string | null;
  image_url: string | null;
  image_s3_key: string | null;
  temperature: number | null;
  documents: PersonaDocumentResponse[];
  total_usage: number;
  created_at: string;
  updated_at: string;
}

export interface PersonaRepoResponse {
  id: string;
  name: string;
  is_active: boolean;
  active_version_id: string | null;
  active_version: PersonaVersionResponse | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface PersonaVersionListItem {
  id: string;
  name: string;
  handler: string;
  model_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnhancePromptResponse {
  enhanced_prompt: string;
  dos: string[];
  donts: string[];
}

// ── Normalised frontend type ──────────────────────────────────────────────────

export type PersonaStatus = "draft" | "active" | "paused";

export interface Persona {
  id: string;
  name: string;
  handle: string;
  description: string;
  imageUrl: string | null;
  modelId: string | null;
  tags: string[];
  temperature: number | null;
  isActive: boolean;
  isPaused: boolean;
  status: PersonaStatus;
  activeVersionId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeRepo(repo: PersonaRepoResponse): Persona {
  const v = repo.active_version;
  const handle = v?.handler
    ? `@${v.handler}`
    : `@${repo.name.toLowerCase().replace(/\s+/g, "_")}`;
  return {
    id: repo.id,
    name: repo.name,
    handle,
    description: v?.prompt?.slice(0, 140) ?? "",
    imageUrl: v?.image_url ?? null,
    modelId:  v?.model_id  ?? null,
    tags: [],
    temperature: v?.temperature ?? null,
    isActive: repo.is_active,
    isPaused: !repo.is_active && repo.version_count > 0,
    status: !repo.active_version_id
      ? "draft"
      : repo.is_active
      ? "active"
      : "paused",
    activeVersionId: repo.active_version_id,
    versionCount: repo.version_count,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
  };
}

// ── Repo CRUD ─────────────────────────────────────────────────────────────────

// 30-second TTL cache — return visits within the window are instant.
// Mutating operations (create, delete, save) must call bustPersonasCache().
let _personasCache: Persona[] | null = null
let _personasCacheTime = 0
const PERSONAS_CACHE_TTL = 30_000

export function bustPersonasCache(): void {
  _personasCache = null
  _personasCacheTime = 0
}

// Deduplicates concurrent calls: all callers that arrive while a request is
// already in-flight receive the same Promise, so only one HTTP request is made.
let _fetchPersonasInFlight: Promise<Persona[]> | null = null

export function fetchPersonas(): Promise<Persona[]> {
  const now = Date.now()
  if (_personasCache && now - _personasCacheTime < PERSONAS_CACHE_TTL) {
    return Promise.resolve(_personasCache)
  }
  if (_fetchPersonasInFlight) return _fetchPersonasInFlight
  _fetchPersonasInFlight = apiFetchJson<PersonaRepoResponse[]>(PERSONAS_ENDPOINT)
    .then(list => {
      const normalized = list.map(normalizeRepo)
      _personasCache = normalized
      _personasCacheTime = Date.now()
      return normalized
    })
    .finally(() => { _fetchPersonasInFlight = null })
  return _fetchPersonasInFlight
}

export async function getPersona(repoId: string): Promise<Persona> {
  const repo = await apiFetchJson<PersonaRepoResponse>(PERSONA_DETAIL_ENDPOINT(repoId));
  return normalizeRepo(repo);
}

export async function getPersonaRepo(repoId: string): Promise<PersonaRepoResponse> {
  return apiFetchJson<PersonaRepoResponse>(PERSONA_DETAIL_ENDPOINT(repoId));
}

export async function createPersonaRepo(params: {
  name: string;
  modelId: string;
  prompt?: string;
  temperature?: number | null;
  image?: File | null;
}): Promise<PersonaRepoResponse> {
  const form = new FormData();
  form.append("name", params.name);
  form.append("model_id", params.modelId);
  if (params.prompt) form.append("prompt", params.prompt);
  if (params.temperature != null) form.append("temperature", String(params.temperature));
  if (params.image) form.append("image", params.image);
  return apiFetchJson<PersonaRepoResponse>(PERSONAS_ENDPOINT, {
    method: "POST",
    body: form,
  });
}

export async function deletePersona(repoId: string): Promise<void> {
  await apiFetch(PERSONA_DETAIL_ENDPOINT(repoId), { method: "DELETE" });
}

export async function togglePause(repoId: string): Promise<void> {
  await apiFetch(PERSONA_PAUSE_ENDPOINT(repoId), { method: "PATCH" });
}

export async function setActiveVersion(repoId: string, versionId: string): Promise<PersonaRepoResponse> {
  return apiFetchJson<PersonaRepoResponse>(PERSONA_ACTIVE_ENDPOINT(repoId), {
    method: "PATCH",
    body: JSON.stringify({ persona_id: versionId }),
  });
}

// ── Version CRUD ──────────────────────────────────────────────────────────────

export async function listVersions(repoId: string): Promise<PersonaVersionListItem[]> {
  return apiFetchJson<PersonaVersionListItem[]>(PERSONA_VERSIONS_ENDPOINT(repoId));
}

export async function createVersion(params: {
  repoId: string;
  name: string;
  modelId: string;
  prompt?: string;
  temperature?: number | null;
  image?: File | null;
  /** Existing image URL to carry forward when no new image file is provided. */
  imageUrl?: string | null;
}): Promise<PersonaVersionResponse> {
  const form = new FormData();
  form.append("name", params.name);
  form.append("model_id", params.modelId);
  if (params.prompt) form.append("prompt", params.prompt);
  if (params.temperature != null) form.append("temperature", String(params.temperature));
  if (params.image) form.append("image", params.image);
  else if (params.imageUrl) form.append("image_url", params.imageUrl);
  return apiFetchJson<PersonaVersionResponse>(PERSONA_VERSIONS_ENDPOINT(params.repoId), {
    method: "POST",
    body: form,
  });
}

export async function getVersion(repoId: string, versionId: string): Promise<PersonaVersionResponse> {
  return apiFetchJson<PersonaVersionResponse>(PERSONA_VERSION_DETAIL_ENDPOINT(repoId, versionId));
}

export async function updateVersion(params: {
  repoId: string;
  versionId: string;
  name?: string;
  prompt?: string;
  modelId?: string;
  temperature?: number | null;
  image?: File | null;
  files?: File[];
}): Promise<PersonaVersionResponse> {
  const form = new FormData();
  if (params.name != null) form.append("name", params.name);
  if (params.prompt != null) form.append("prompt", params.prompt);
  if (params.modelId != null) form.append("model_id", params.modelId);
  if (params.temperature != null) form.append("temperature", String(params.temperature));
  if (params.image) form.append("image", params.image);
  params.files?.forEach(f => form.append("files", f));
  return apiFetchJson<PersonaVersionResponse>(
    PERSONA_VERSION_DETAIL_ENDPOINT(params.repoId, params.versionId),
    { method: "PATCH", body: form },
  );
}

/** DELETE /persona/{repo_id}/versions/{persona_id} */
export async function deleteVersion(repoId: string, versionId: string): Promise<void> {
  await apiFetch(PERSONA_VERSION_DETAIL_ENDPOINT(repoId, versionId), { method: "DELETE" });
}

// ── Document management ───────────────────────────────────────────────────────

export async function uploadDocument(repoId: string, versionId: string, file: File): Promise<PersonaVersionResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiFetchJson<PersonaVersionResponse>(
    PERSONA_VERSION_DOCUMENT_ENDPOINT(repoId, versionId),
    { method: "POST", body: form },
  );
}

export async function deleteDocument(repoId: string, versionId: string, documentId: string): Promise<void> {
  const response = await apiFetch(
    PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT(repoId, versionId, documentId),
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete document (${response.status})`);
  }
  // 2xx — success. DELETE often returns 204 No Content; don't attempt JSON parse.
}

// ── Enhance prompt ────────────────────────────────────────────────────────────

export async function enhancePrompt(prompt: string): Promise<EnhancePromptResponse> {
  const form = new URLSearchParams();
  form.append("prompt", prompt);
  return apiFetchJson<EnhancePromptResponse>(PERSONA_ENHANCE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

// ── Persona chat history ──────────────────────────────────────────────────────

/** Row returned by GET /persona/{repo_id}/chats — one per persona chat. */
export interface PersonaChatsResponse {
  id:            string;
  chat_title:    string;
  message_count: number;
  persona_id?:   string | null;
}

/** Row returned by GET /persona/{repo_id}/chats/{chat_id}/messages — one per turn. */
export interface PersonaFileAttachment {
  file_link: string;
  mime_type: string;
  origin:    string;
}

export interface GetPersonaMessages {
  id:                string;
  input:             string;
  output:            string;
  reasoning?:        string | null;
  file_attachments?: PersonaFileAttachment[];
}

/** Caller-friendly shape: each backend turn is split into a user message + assistant message. */
export interface PersonaChat {
  id:          string;
  title:       string;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaMessage {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  created_at?: string;
}

/** GET /persona/{repo_id}/chats */
export async function fetchPersonaChats(repoId: string): Promise<PersonaChat[]> {
  const data = await apiFetchJson<PersonaChatsResponse[] | { chats: PersonaChatsResponse[] }>(
    PERSONA_CHATS_ENDPOINT(repoId),
  );
  const list = Array.isArray(data) ? data : (data.chats ?? []);
  return list.map(c => ({ id: c.id, title: c.chat_title }));
}

/** GET /persona/{repo_id}/chats/{chat_id}/messages — each turn → user + assistant pair. */
export async function fetchPersonaChatMessages(
  repoId: string,
  chatId: string,
): Promise<PersonaMessage[]> {
  const turns = await apiFetchJson<GetPersonaMessages[]>(
    PERSONA_CHAT_MESSAGES_ENDPOINT(repoId, chatId),
  );
  const out: PersonaMessage[] = [];
  for (const t of turns) {
    if (t.input)  out.push({ id: `${t.id}:in`,  role: "user",      content: t.input  });
    if (t.output) out.push({ id: `${t.id}:out`, role: "assistant", content: t.output });
  }
  return out;
}

/** PATCH /persona/{repo_id}/chats/rename */
export async function renamePersonaChat(
  repoId: string,
  chatId: string,
  title: string,
): Promise<void> {
  await apiFetch(PERSONA_CHATS_RENAME_ENDPOINT(repoId), {
    method: "PATCH",
    body:   JSON.stringify({ chat_id: chatId, chat_title: title }),
  });
}

/** DELETE /persona/{repo_id}/chats — body: { chat_id }. */
export async function deletePersonaChat(repoId: string, chatId: string): Promise<void> {
  await apiFetch(PERSONA_CHATS_ENDPOINT(repoId), {
    method: "DELETE",
    body:   JSON.stringify({ chat_id: chatId }),
  });
}

/** POST /persona/{repo_id}/chats/{chat_id}/stop — cancel an in-flight stream. */
export async function stopPersonaChat(repoId: string, chatId: string): Promise<void> {
  await apiFetch(PERSONA_CHAT_STOP_ENDPOINT(repoId, chatId), { method: "POST" });
}

/** DELETE /persona/{repo_id}/chats/{chat_id}/message/{message_id}. */
export async function removePersonaMessage(
  repoId: string,
  chatId: string,
  messageId: string,
): Promise<void> {
  await apiFetch(PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT(repoId, chatId, messageId), {
    method: "DELETE",
  });
}

// ── Persona test chat ─────────────────────────────────────────────────────────

export interface PersonaChatStreamCallbacks {
  /** Called with the chatId extracted from the X-Chat-Id response header. */
  onChatId?: (chatId: string) => void;
  /** Called for each streamed text token. */
  onChunk?: (delta: string) => void;
  /** Called when the stream finishes successfully. */
  onDone?: () => void;
  /** Called on error (network or stream-level). */
  onError?: (error: string) => void;
}

/** Shared SSE reader used by both create-chat and stream-message. */
async function readPersonaSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: PersonaChatStreamCallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential SSE stream reader; chunks must be processed in order
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const chunk of events) {
          const lines = chunk.split("\n");
          let eventName = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(dataStr); } catch { continue; }
          // Resolve event name from inline `type` field when no named event header
          if (!eventName && typeof parsed.type === "string") eventName = parsed.type;
          if (eventName === "content") {
            callbacks.onChunk?.(typeof parsed.content === "string" ? parsed.content : "");
          } else if (eventName === "done") {
            callbacks.onDone?.();
            return;
          } else if (eventName === "error") {
            callbacks.onError?.(typeof parsed.error === "string" ? parsed.error : "Stream error");
            return;
          }
        }
      }
      if (done) break;
    }
    callbacks.onDone?.();
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Stream read error");
    }
  } finally {
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
): Promise<() => void> {
  const controller = new AbortController();
  const form = new FormData();
  form.append("input", input);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_VERSION_TEST_ENDPOINT(repoId, versionId), {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Failed to test persona");
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(text || `HTTP ${response.status}`);
    return () => controller.abort();
  }
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("No response body");
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
): Promise<() => void> {
  const controller = new AbortController();
  const form = new FormData();
  form.append("input", input);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_CHATS_CREATE_ENDPOINT(repoId), {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Failed to create persona chat");
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(text || `HTTP ${response.status}`);
    return () => controller.abort();
  }
  const chatId = response.headers.get("X-Chat-Id");
  if (chatId) callbacks.onChatId?.(chatId);
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("No response body");
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
): Promise<() => void> {
  const controller = new AbortController();
  const form = new FormData();
  form.append("input", input);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_CHAT_STREAM_ENDPOINT(repoId, chatId), {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Failed to stream message");
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    callbacks.onError?.(text || `HTTP ${response.status}`);
    return () => controller.abort();
  }
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.("No response body");
    return () => controller.abort();
  }
  readPersonaSSEStream(reader, callbacks);
  return () => controller.abort();
}
