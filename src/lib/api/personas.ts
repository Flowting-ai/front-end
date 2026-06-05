"use client";

import { apiFetch, apiFetchJson } from "./client";
import {
  PERSONAS_ENDPOINT,
  PERSONA_DETAIL_ENDPOINT,
  PERSONA_ENHANCE_ENDPOINT,
  PERSONA_STARTER_ENDPOINT,
  PERSONA_PAUSE_ENDPOINT,
  PERSONA_ACTIVE_ENDPOINT,
  PERSONA_GUIDE_ENDPOINT,
  PERSONA_VERSIONS_ENDPOINT,
  PERSONA_VERSION_DETAIL_ENDPOINT,
  PERSONA_VERSION_TEST_ENDPOINT,
  PERSONA_VERSION_DOCUMENT_ENDPOINT,
  PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT,
  PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT,
  PERSONA_VERSION_CONNECTORS_ENDPOINT,
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
  size_bytes?: number | null;
  content_type?: string | null;
  download_url?: string | null;
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
  /** Slugs of connectors enabled for this version. Empty array = none assigned. */
  connectors: string[];
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

export interface PersonaStarterRequest {
  name: string;
  description: string;
}

export interface PersonaStarterSound {
  name: string;
  description: string;
}

export interface PersonaStarterResponse {
  system_instruction: string;
  /** Currently a single sound object; will become an array in a future API version. */
  sound: PersonaStarterSound | PersonaStarterSound[];
  persona_tags: string[];
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
  /** True when the active version has a non-empty system prompt. */
  hasSystemInstructions: boolean;
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
    // If the list endpoint doesn't embed active_version (v is null) but
    // active_version_id exists, we can't inspect the prompt — assume it has
    // instructions. Only mark false when we have the version object and the
    // prompt is genuinely blank, or when there's no active version at all.
    hasSystemInstructions: v !== null ? !!(v.prompt?.trim()) : repo.active_version_id !== null,
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

async function urlToImageFile(url: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
    return new File([blob], `avatar.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
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
  let image: File | null = params.image ?? null;
  if (!image && params.imageUrl) image = await urlToImageFile(params.imageUrl);
  if (image) form.append("image", image);
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
  /** Existing image URL to carry forward when no new image file is provided. */
  imageUrl?: string | null;
  files?: File[];
  removeDocumentIds?: string[];
}): Promise<PersonaVersionResponse> {
  const form = new FormData();
  if (params.name != null) form.append("name", params.name);
  if (params.prompt != null) form.append("prompt", params.prompt);
  if (params.modelId != null) form.append("model_id", params.modelId);
  if (params.temperature != null) form.append("temperature", String(params.temperature));
  let image: File | null = params.image ?? null;
  if (!image && params.imageUrl) image = await urlToImageFile(params.imageUrl);
  if (image) form.append("image", image);
  params.files?.forEach(f => form.append("files", f));
  if (params.removeDocumentIds && params.removeDocumentIds.length > 0) {
    form.append("remove_document_ids", params.removeDocumentIds.join(","));
  }
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

/**
 * POST /persona/{repo_id}/versions/{version_id}/knowledge-url
 * Saves a URL as a knowledge source for this version.
 * Returns the updated PersonaVersionResponse so the caller can refresh the file list.
 */
export async function addKnowledgeUrl(
  repoId: string,
  versionId: string,
  url: string,
): Promise<PersonaVersionResponse> {
  return apiFetchJson<PersonaVersionResponse>(
    PERSONA_VERSION_KNOWLEDGE_URL_ENDPOINT(repoId, versionId),
    {
      method: 'POST',
      body:   JSON.stringify({ url }),
    },
  )
}

export async function deleteDocument(
  repoId: string,
  versionId: string,
  documentId: string,
): Promise<PersonaVersionResponse> {
  // DELETE returns the updated PersonaVersionResponse (200) — callers can use
  // this directly to refresh the document list without a second getVersion call.
  return apiFetchJson<PersonaVersionResponse>(
    PERSONA_VERSION_DOCUMENT_DELETE_ENDPOINT(repoId, versionId, documentId),
    { method: "DELETE" },
  );
}

// ── Version connectors ────────────────────────────────────────────────────────

/**
 * PUT /persona/{repo_id}/versions/{persona_id}/connectors
 * Full-replace the set of connectors enabled for this version.
 * Pass an empty array to detach all connectors from this version.
 */
export async function setVersionConnectors(
  repoId: string,
  versionId: string,
  connectorSlugs: string[],
): Promise<PersonaVersionResponse> {
  return apiFetchJson<PersonaVersionResponse>(
    PERSONA_VERSION_CONNECTORS_ENDPOINT(repoId, versionId),
    {
      method: 'PUT',
      body: JSON.stringify({ connector_slugs: connectorSlugs }),
    },
  );
}

// ── Persona starter ────────────────────────────────────────────────────────────

/**
 * POST /persona/starter
 * Generate a starting system instruction, sound, and tags from a persona's
 * name + description. Nothing is saved — the FE uses this to seed the editor.
 */
export async function personaStarter(
  params: PersonaStarterRequest,
): Promise<PersonaStarterResponse> {
  return apiFetchJson<PersonaStarterResponse>(PERSONA_STARTER_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(params),
  });
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
  file_name?: string;
  name?: string;
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
  /** File attachments returned by the backend (uploaded files with their S3 links). */
  file_attachments?: PersonaFileAttachment[];
}

/** GET /persona/{repo_id}/chats */
export async function fetchPersonaChats(repoId: string): Promise<PersonaChat[]> {
  const list = await apiFetchJson<PersonaChatsResponse[]>(PERSONA_CHATS_ENDPOINT(repoId));
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
    if (t.input)  out.push({
      id: `${t.id}:in`,
      role: "user",
      content: t.input,
      file_attachments: t.file_attachments?.filter(a => a.origin === "uploaded" || a.origin === "user"),
    });
    if (t.output) out.push({
      id: `${t.id}:out`,
      role: "assistant",
      content: t.output,
      file_attachments: t.file_attachments?.filter(a => a.origin === "generated"),
    });
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
}

export interface PersonaImageEvent {
  url: string;
  s3_key: string;
}

export type PersonaActivityType =
  | 'web-search' | 'read-pages' | 'csv-execute' | 'fetch-resource'
  | 'tool-call'  | 'doc-execute' | 'docx-progress' | 'skills' | 'other'

export type PersonaActivityStatus = 'start' | 'executing' | 'reading' | 'done' | 'error'

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
}

export interface PersonaConnectPrompt {
  request_id:     string
  connector_slug: string
  display_name:   string
  auth_mode:      'oauth2' | 'api_key'
  tool_name:      string
  api_key_fields?: import('@/lib/api/connectors').ApiKeyField[]
  icon_url?:      string
}

export interface PersonaPermissionPrompt {
  request_id:      string
  connector_slug:  string
  display_name:    string
  tool_name:       string
  suggested_args?: Record<string, unknown>
  icon_url?:       string
}

export interface PersonaChatStreamCallbacks {
  /** Called with the chatId extracted from the X-Chat-Id response header. */
  onChatId?: (chatId: string) => void;
  /** Called for each streamed assistant text token. */
  onChunk?: (delta: string) => void;
  /** Called with the persisted assistant message id (named `message_saved` event). */
  onMessageSaved?: (messageId: string) => void;
  /** Called when the backend auto-titles a new chat (named `title` event). */
  onTitle?: (title: string) => void;
  /** Called with each delta of a reasoning section's body. */
  onReasoningBody?: (delta: string) => void;
  /** Called when a new reasoning section opens. */
  onReasoningHeading?: (heading: string) => void;
  /** Called for legacy raw reasoning deltas (back-compat). */
  onReasoning?: (delta: string) => void;
  /** Called when a web search tool runs. */
  onWebSearch?: (event: PersonaWebSearchEvent) => void;
  /** Called when an image is generated. */
  onImage?: (event: PersonaImageEvent) => void;
  /** Called when a tool starts executing, progresses, or completes. Upsert by id. */
  onToolActivity?: (item: PersonaActivityItem) => void;
  /** Called when the backend requests the user link a connector. */
  onConnectPrompt?: (prompt: PersonaConnectPrompt) => void;
  /** Called when the backend requests permission to run a connector tool. */
  onPermissionPrompt?: (prompt: PersonaPermissionPrompt) => void;
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
 * for the text-only path avoids that and matches what the brain client does.
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
  },
): { body: BodyInit; headers?: HeadersInit } {
  const hasFiles = (options?.files?.length ?? 0) > 0;
  if (hasFiles) {
    const form = new FormData();
    form.append("input", input);
    if (options?.useMistralOcr) form.append("use_mistral_ocr", "true");
    options!.files!.forEach(f => form.append("files", f));
    options?.disabledConnectors?.forEach(slug => form.append("disabled_connectors", slug));
    options?.connectorSlugs?.forEach(slug => form.append("connector_slugs", slug));
    return { body: form };
  }
  const params = new URLSearchParams();
  params.append("input", input);
  if (options?.useMistralOcr) params.append("use_mistral_ocr", "true");
  options?.disabledConnectors?.forEach(slug => params.append("disabled_connectors", slug));
  options?.connectorSlugs?.forEach(slug => params.append("connector_slugs", slug));
  return {
    body: params.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
}

function toolNameToActivityType(name: string): PersonaActivityType {
  const l = name.toLowerCase()
  if (l === 'web_search' || l.includes('search'))                        return 'web-search'
  if (l === 'read_pages' || l.includes('read_pdf'))                      return 'read-pages'
  if (l === 'csv_execute' || l.includes('csv'))                          return 'csv-execute'
  if (l === 'fetch_resource' || l.includes('fetch'))                     return 'fetch-resource'
  if (l === 'doc_execute')                                               return 'doc-execute'
  if (l === 'docx_execute' || l.includes('docx') || l.includes('document')) return 'docx-progress'
  if (l === 'skills')                                                    return 'skills'
  return 'tool-call'
}

/** Shared SSE reader used by both create-chat and stream-message. */
async function readPersonaSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: PersonaChatStreamCallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let doneSeen = false;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const toolCallIdByName = new Map<string, string>();
  // SSE spec: events terminated by a blank line — CR/LF/CRLF all valid.
  const boundaryRe = /\r?\n\r?\n/;
  const lineSplitRe = /\r?\n/;
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
      // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential SSE stream reader; chunks must be processed in order
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let m: RegExpExecArray | null;
        while ((m = boundaryRe.exec(buffer)) !== null) {
          const chunk = buffer.slice(0, m.index);
          buffer = buffer.slice(m.index + m[0].length);
          const lines = chunk.split(lineSplitRe);
          let eventName = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(dataStr); } catch { continue; }
          if (!eventName && typeof parsed.type === "string") eventName = parsed.type;
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
            case "reasoning":
              callbacks.onReasoning?.(str(parsed.content));
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
              });
              break;
            case "image":
              if (typeof parsed.url === "string" && typeof parsed.s3_key === "string") {
                callbacks.onImage?.({ url: parsed.url, s3_key: parsed.s3_key });
              }
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
                id: callId, type: toolNameToActivityType(toolName), toolName,
                label, detail: label ?? toolName.replace(/_/g, " "), status: "executing",
              })
              break
            }
            case "tool_progress": {
              const toolName = str(parsed.tool) || "unknown"
              const label    = str(parsed.label) || undefined
              const status   = (str(parsed.status) || "executing") as PersonaActivityStatus
              const activityId = toolCallIdByName.get(toolName) ?? `tp-${toolName}-${str(parsed.filename) || "x"}`
              callbacks.onToolActivity?.({
                id: activityId, type: toolNameToActivityType(toolName), toolName,
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
              if (toolName) toolCallIdByName.delete(toolName)
              if (callId) {
                callbacks.onToolActivity?.({
                  id: callId, type: toolName ? toolNameToActivityType(toolName) : "tool-call",
                  toolName, label, detail: label ?? toolName, status: "done", durationS,
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
                request_id:     typeof parsed.request_id === 'string' ? parsed.request_id : `ccp-${Date.now()}`,
                connector_slug: str(parsed.connector_slug),
                display_name:   str(parsed.display_name) || str(parsed.connector_slug),
                auth_mode:      (str(parsed.auth_mode) || 'oauth2') as 'oauth2' | 'api_key',
                tool_name:      str(parsed.tool_name),
                api_key_fields: apiKeyFields,
                icon_url:       str(parsed.icon_url) || undefined,
              })
              break
            }
            case "tool_permission_prompt":
              callbacks.onPermissionPrompt?.({
                request_id:     typeof parsed.request_id === 'string' ? parsed.request_id : `cpp-${Date.now()}`,
                connector_slug: str(parsed.connector_slug),
                display_name:   str(parsed.display_name) || str(parsed.connector_slug),
                tool_name:      str(parsed.tool_name),
                suggested_args: typeof parsed.suggested_args === 'object' && parsed.suggested_args !== null
                  ? (parsed.suggested_args as Record<string, unknown>)
                  : undefined,
                icon_url:       str(parsed.icon_url) || undefined,
              })
              break
            case "error":
              callbacks.onError?.(str(parsed.error) || "Stream error");
              return;
          }
        }
      }
      if (done) break;
    }
    if (!doneSeen) callbacks.onDone?.();
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Stream read error");
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
  options?: { files?: File[]; disabledConnectors?: string[]; connectorSlugs?: string[] },
): Promise<() => void> {
  const controller = new AbortController();
  const { body, headers } = buildStreamBody(input, options);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_VERSION_TEST_ENDPOINT(repoId, versionId), {
      method: "POST",
      body,
      headers,
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
  options?: { files?: File[]; useMistralOcr?: boolean; connectorSlugs?: string[] },
): Promise<() => void> {
  const controller = new AbortController();
  const { body, headers } = buildStreamBody(input, options);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_CHATS_CREATE_ENDPOINT(repoId), {
      method: "POST",
      body,
      headers,
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
    connectors?: string[];
    history?: GuideMessage[];
    web_search?: boolean;
  },
  callbacks: PersonaChatStreamCallbacks,
): Promise<() => void> {
  const controller = new AbortController();

  // Resolve model_id: prefer the one passed in (from persona instructions tab),
  // otherwise fetch from the persona's saved versions.
  let resolvedModelId = params.model_id ?? null;
  if (!resolvedModelId) {
    try {
      const versions = await listVersions(repoId);
      const sorted   = versions.slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      resolvedModelId =
        sorted.find(v => v.is_active)?.model_id ??
        sorted[0]?.model_id ??
        null;
    } catch { /* proceed with null */ }
  }

  const requestBody = {
    question:    params.question,
    prompt:      params.prompt      ?? "",
    description: params.description ?? "",
    name:        params.name        ?? null,
    model_id:    resolvedModelId,
    temperature: params.temperature ?? null,
    connectors:  params.connectors  ?? [],
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
      callbacks.onError?.((err as Error).message ?? "Failed to get AI suggestions");
    }
    return () => controller.abort();
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const errorLower = errorText.toLowerCase();
    const isModelError =
      response.status === 503 ||
      (errorLower.includes("model") && errorLower.includes("not configured"));

    if (isModelError) {
      // If we didn't have a model_id from the caller, try fetching from versions and retry.
      if (!params.model_id) {
        controller.abort();
        try {
          const versions = await listVersions(repoId);
          const sorted   = versions.slice().sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
          const versionModelId =
            sorted.find(v => v.is_active)?.model_id ??
            sorted[0]?.model_id ??
            null;
          if (versionModelId && versionModelId !== resolvedModelId) {
            return guideRetryWithModel(repoId, { ...params, model_id: versionModelId }, callbacks);
          }
        } catch { /* fall through */ }
      }
      // Show actionable error
      callbacks.onError?.("Guide model is not configured. Please save your persona in the Instructions tab first, then try again.");
      return () => controller.abort();
    }
    callbacks.onError?.(errorText || `HTTP ${response.status}`);
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
 * Single retry of the guide endpoint with an explicit model_id sourced from the
 * versions API. On any failure (including a second 503) surfaces an error — no further retries.
 */
async function guideRetryWithModel(
  repoId: string,
  params: Parameters<typeof guidePersonaStream>[1],
  callbacks: PersonaChatStreamCallbacks,
): Promise<() => void> {
  const controller = new AbortController();
  let response: Response;
  try {
    response = await apiFetch(PERSONA_GUIDE_ENDPOINT(repoId), {
      method: "POST",
      body: JSON.stringify({
        question:    params.question,
        prompt:      params.prompt      ?? "",
        description: params.description ?? "",
        name:        params.name        ?? null,
        model_id:    params.model_id    ?? null,
        temperature: params.temperature ?? null,
        connectors:  params.connectors  ?? [],
        history:     params.history     ?? [],
        web_search:  params.web_search  ?? false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError?.((err as Error).message ?? "Failed to get AI suggestions");
    }
    return () => controller.abort();
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const textLower = text.toLowerCase();
    if (textLower.includes("model") && textLower.includes("not configured")) {
      callbacks.onError?.("Guide model is not configured. Please save your persona in the Instructions tab first, then try again.");
    } else {
      callbacks.onError?.(text || `HTTP ${response.status}`);
    }
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
  const { body, headers } = buildStreamBody(input, options);
  let response: Response;
  try {
    response = await apiFetch(PERSONA_CHAT_STREAM_ENDPOINT(repoId, chatId), {
      method: "POST",
      body,
      headers,
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
