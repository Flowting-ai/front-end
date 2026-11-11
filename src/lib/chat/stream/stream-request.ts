import { appendChatModelSelection } from "@/lib/chat-model-selection"
import {
  API_BASE_URL,
  CHATS_CREATE_ENDPOINT,
  CHAT_STREAM_ENDPOINT,
  directUpload,
  shouldUseDirectBackend,
} from "@/lib/config"
import { getSourcesOff, hasSourcesOff } from "@/lib/library/library-sources-off"
import { libraryRefsFor } from "@/lib/library/upload/composer-uploads"

/** Continue a turn parked on a prompt: POST the answer to the prompt's
 *  respond_url (`/chats/{id}/resume`) and stream the rest of the turn. */
export type TurnResume = { url: string; promptId: string; response: unknown }

/** The per-send options of useStreamingChat's fetchAiResponse. */
export interface StreamRequestOptions {
  webSearch?: boolean
  files?: File[]
  enableReasoning?: boolean
  reasoningEffort?: string | null
  algorithm?: 'base' | 'pro' | null
  userMessageId?: string
  pinIds?: string[]
  onUploadProgress?: (pct: number) => void
  personaId?: string
  projectId?: string
  systemPrompt?: string
  temperature?: number
  toneId?: string
  connectorSlugs?: string[]
  replaceMessageId?: string
  chatOwnershipConfirmed?: boolean
  resume?: TurnResume
  /** Read the chat's already-running turn from its stream instead of sending anything. */
  follow?: boolean
  /** How many times this turn has already re-attached, so the retries stay bounded. */
  followAttempt?: number
}

export interface StreamTarget {
  isExistingChat: boolean
  useDirectBackend: boolean
  resolvedEndpoint: string
  resume: TurnResume | undefined
  follow: boolean
}

/**
 * Resolves transport: direct-to-backend vs proxy.
 *
 * Deployed origins stream straight to the backend (absolute URL + Bearer):
 * no Vercel serverless proxy in the path, so its stream duration limits
 * (300/800s kills) and 4.5MB request-body cap don't apply. The proxy
 * (`endpoint`) remains for local dev — the backend CORS allowlist has no
 * localhost — and for callers with a bespoke proxy but no directEndpoints.
 *
 * Synchronous on purpose: the proxy path opens its request in the same tick
 * as the send, so a Stop right after it still finds the request to abort.
 * The caller fetches the bearer token (async) only for a direct send.
 */
export function resolveStreamTarget(
  chatId: string | null,
  endpoint: string,
  directEndpoints: { create: string; stream: (chatId: string) => string } | undefined,
  options: StreamRequestOptions | undefined,
): StreamTarget {
  const isExistingChat = Boolean(chatId && !chatId.startsWith("temp-"))
  const direct = directEndpoints ?? (endpoint === "/api/chat"
    ? { create: CHATS_CREATE_ENDPOINT, stream: CHAT_STREAM_ENDPOINT }
    : null)
  // For an existing chat, only take the direct-to-backend path once the
  // caller has explicitly confirmed this chat is the user's own (or at
  // least readable/editable by them) — see `chatOwnershipConfirmed` below.
  // Without that confirmation the backend's own ownership check on
  // POST /chats/{id}/stream can 404 with a raw "Chat not found" the
  // proxy would otherwise have absorbed. Creating a brand-new chat has
  // no ownership question (isExistingChat is false), so this never
  // affects that path, and callers that don't pass the option at all
  // keep today's behavior (undefined !== false).
  // A resumed turn answers a prompt at the backend-built respond_url; it
  // goes wherever API_BASE_URL points (the backend, or the local proxy).
  const resume = options?.resume
  // A follow reads the chat's running turn from GET /chats/{id}/stream; it sends nothing.
  const follow = options?.follow === true
  // A follow's endpoint below is always the backend's own URL — there is no proxy
  // route for GET /chats/{id}/stream — so it must always carry the bearer token.
  // Gating this on shouldUseDirectBackend() (false on localhost) sent the request
  // without one, and every re-attach came back 401.
  const useDirectBackend = follow
    ? true
    : resume
    ? /^https?:\/\//.test(API_BASE_URL)
    : direct !== null &&
      shouldUseDirectBackend() &&
      (!isExistingChat || options?.chatOwnershipConfirmed !== false)
  const resolvedEndpoint = follow
    ? directUpload(CHAT_STREAM_ENDPOINT(chatId!))
    : resume
    ? `${API_BASE_URL}${resume.url}`
    : useDirectBackend
      ? directUpload(isExistingChat ? direct!.stream(chatId!) : direct!.create)
      : endpoint
  return { isExistingChat, useDirectBackend, resolvedEndpoint, resume, follow }
}

/** The send's form body, plus how its files were split between Library ids and bytes. */
export function buildStreamFormData(
  input: string,
  chatId: string | null,
  modelId: string | number | null | undefined,
  options: StreamRequestOptions | undefined,
  { useDirectBackend, isExistingChat }: Pick<StreamTarget, "useDirectBackend" | "isExistingChat">,
) {
  const fd = new FormData()
  fd.append("input", input)
  if (useDirectBackend) {
    // Backend-native field names — this request skips /api/chat entirely,
    // so nothing renames these camelCase → snake_case on the way through.
    appendChatModelSelection(fd, modelId, options?.algorithm, "model_id")
    if (options?.webSearch) fd.append("web_search", "true")
    if (options?.pinIds && options.pinIds.length > 0) fd.append("pin_ids", JSON.stringify(options.pinIds))
    if (options?.personaId) fd.append("persona_id", options.personaId)
    if (options?.projectId && !isExistingChat) fd.append("project_id", options.projectId)
    if (options?.systemPrompt) fd.append("system_prompt", options.systemPrompt)
    if (options?.temperature != null) fd.append("temperature", String(options.temperature))
    if (options?.toneId) fd.append("tone_id", options.toneId)
    if (options?.enableReasoning !== undefined) {
      fd.append("thinking", options.enableReasoning ? "true" : "false")
      if (options.reasoningEffort) fd.append("effort", options.reasoningEffort)
    }
    if (options?.replaceMessageId && isExistingChat) fd.append("replace_message_id", options.replaceMessageId)
  } else {
    if (chatId) fd.append("chatId", chatId)
    appendChatModelSelection(fd, modelId, options?.algorithm, "modelId")
    if (options?.webSearch) fd.append("webSearch", "true")
    if (options?.enableReasoning !== undefined) {
      fd.append("enable_thinking", options.enableReasoning ? "true" : "false")
      if (options.reasoningEffort) fd.append("effort", options.reasoningEffort)
    }
    if (options?.pinIds && options.pinIds.length > 0) fd.append("pinIds", JSON.stringify(options.pinIds))
    if (options?.personaId) fd.append("personaId", options.personaId)
    if (options?.projectId) fd.append("projectId", options.projectId)
    if (options?.systemPrompt) fd.append("systemPrompt", options.systemPrompt)
    if (options?.temperature != null) fd.append("temperature", String(options.temperature))
    if (options?.toneId) fd.append("toneId", options.toneId)
    options?.connectorSlugs?.forEach((s) => fd.append("connectorSlugs", s))
    if (options?.replaceMessageId) fd.append("replaceMessageId", options.replaceMessageId)
  }
  // Files the composer already uploaded into Library go by id; any other file still rides with
  // the message as bytes, and the backend adds it to Library after the turn.
  const fileRefs = libraryRefsFor(options?.files ?? [])
  fileRefs.files.forEach((f) => fd.append("files", f))
  if (fileRefs.libraryFileIds.length > 0) fd.append("libraryFileIds", JSON.stringify(fileRefs.libraryFileIds))
  // The auto-save answer (Ask each time / Never). The backend does not read it yet (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 1).
  if (fileRefs.saveToLibrary !== undefined) fd.append("saveToLibrary", String(fileRefs.saveToLibrary))
  // Library files switched off in this chat's Sources panel. The server stores the list, so once the chat
  // has one it is sent even when empty: that is how switching the last file back on reaches the server.
  if (isExistingChat && hasSourcesOff(chatId!)) fd.append("librarySourcesOff", JSON.stringify(getSourcesOff(chatId!)))
  return { fd, fileRefs }
}
