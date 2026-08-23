'use client'

import { z } from 'zod'
import { apiFetch, apiFetchJson, ApiError } from './client'
import { API_BASE_URL, directUpload, shouldUseDirectBackend } from '../config'
import type { ReasoningSection } from '../reasoning'
import { AguiSSEDecoder, type DecodedSSEEvent } from '../sse-decoder'
import type { CustomEventName, CustomEventPayload } from './sse-schemas'

// ── Endpoint helpers ──────────────────────────────────────────────────────────

const withBase = (path: string) => `${API_BASE_URL}${path}`

const BRAIN_BASE      = withBase('/brain')
const BRAIN_CREATE    = withBase('/brain/create')
const BRAIN_RENAME    = withBase('/brain/rename')
const BRAIN_STREAM    = (chatId: string) => withBase(`/brain/${chatId}/stream`)
const BRAIN_MESSAGES  = (chatId: string) => withBase(`/brain/${chatId}/messages`)
const BRAIN_STOP      = (chatId: string) => withBase(`/brain/${chatId}/stop`)
const BRAIN_STAR      = (chatId: string) => withBase(`/brain/${chatId}/star`)
const PROMPT_RESPOND  = (promptId: string) => withBase(`/chats/prompts/${promptId}`)

export interface BrainChatListItem {
  id:             string
  chat_title:     string
  starred?:       boolean
  message_count?: number
  created_at?:    string | null
  updated_at?:    string | null
}

// Images/files generated during the turn, returned per-message by GET
// /brain/{chat_id}/messages with a freshly-signed `url`.
export interface BrainAttachment {
  id:         string
  url:        string
  s3_key:     string
  mime_type:  string
  file_size?: number
  origin?:    string
}

// ── `context` SSE event ───────────────────────────────────────────────────────
// The rail has exactly four user-facing context kinds: persona, pins, files,
// and connectors. Parse the untrusted SSE payload once here rather than casting
// arbitrary objects in the page. Invalid rows are dropped independently so one
// bad connector cannot hide otherwise valid context.

const optionalContextString = z.string().trim().min(1).optional()

export const contextPersonaSchema = z.object({
  persona_id:     optionalContextString,
  name:           optionalContextString,
  // An empty handler is meaningful for reconstructed/deleted personas.
  handler:        z.string().trim().optional(),
  prompt_preview: optionalContextString,
  model_id:       z.string().trim().min(1).nullable().optional(),
  avatar_url:     optionalContextString,
  image_url:      optionalContextString,
}).transform((persona) => ({
  ...persona,
  avatar_url: persona.avatar_url ?? persona.image_url,
}))

export const contextPinSchema = z.object({
  pin_id:          z.string().trim().min(1),
  // Reconstructed history can carry a bare pin id until the pinboard resolves it.
  title:           z.string(),
  content_preview: optionalContextString,
  tags:            z.array(z.string().trim().min(1)).optional(),
})

export const contextFileSchema = z.object({
  name:      z.string().trim().min(1),
  mime_type: optionalContextString,
  size:      z.number().nonnegative().optional(),
  source:    optionalContextString,
})

export const contextConnectorSchema = z.object({
  slug:         z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  status:       z.string().trim().min(1).optional(),
  // Catalog connectors always have one of these auth modes. Orphan connection
  // rows and connector tool/action records do not, so they must never reach UI.
  auth_mode:    z.enum(['oauth2', 'api_key']),
  tool_count:   z.number().int().nonnegative(),
  logo_url:     z.string().trim().min(1).nullable().optional(),
}).transform(({
  slug,
  display_name,
  status,
  logo_url,
}): {
  slug: string
  display_name: string
  status?: string
  logo_url?: string | null
} => ({
  slug,
  display_name,
  ...(status ? { status } : {}),
  ...(logo_url !== undefined ? { logo_url } : {}),
}))

export type ContextPersona = z.output<typeof contextPersonaSchema>
export type ContextPin = z.output<typeof contextPinSchema>
export type ContextFile = z.output<typeof contextFileSchema>
export type ContextConnector = z.output<typeof contextConnectorSchema>

function parseContextRows<T>(value: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const parsed = schema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

export const brainContextEventSchema = z.object({
  persona: z.unknown().optional().transform((value) => {
    if (value == null) return null
    const parsed = contextPersonaSchema.safeParse(value)
    return parsed.success ? parsed.data : null
  }),
  pins: z.unknown().optional().transform((value) =>
    parseContextRows(value, contextPinSchema)),
  files: z.unknown().optional().transform((value) =>
    parseContextRows(value, contextFileSchema)),
  connectors: z.unknown().optional().transform((value) =>
    parseContextRows(value, contextConnectorSchema)),
})

export type BrainContextEvent = z.output<typeof brainContextEventSchema>

const EMPTY_BRAIN_CONTEXT: BrainContextEvent = {
  persona: null,
  pins: [],
  files: [],
  connectors: [],
}

export function parseBrainContextEvent(value: unknown): BrainContextEvent {
  const parsed = brainContextEventSchema.safeParse(value)
  return parsed.success ? parsed.data : EMPTY_BRAIN_CONTEXT
}

// One real-world side effect a connector write-tool performed during a run
// (a sent email, a created Notion page, …). Mirrors core/sse_schemas.py
// ExternalOutputAction exactly. `view_url`/`logo_url` are best-effort and may
// be absent. There is deliberately no undo — most external writes can't be
// reversed (the FE 5s undo countdown is never wired to the backend).
export interface ExternalOutputAction {
  verb:            string   // "Sent" | "Created" | "Updated" | "Deleted" | "Posted"
  target:          string   // "email to kai@example.com" | "Notion page 'Q1 Sync'"
  connector:       string   // display name: "Gmail" | "Notion" | "Slack"
  connector_slug?: string
  logo_url?:       string
  detail?:         string   // "Subject: Q1 Report · 3 attachments"
  view_url?:       string   // link to the affected resource; absent → no View button
}

// Emitted once at plan completion summarizing every external write a run made.
// Mirrors core/sse_schemas.py ExternalOutputEvent (event: external_output).
// Empty `actions` ⇒ the run only read/produced artifacts; the FE shows no card.
export interface ExternalOutputEvent {
  actions:       ExternalOutputAction[]
  completed_at?: string
}

export interface BrainMessage {
  id:                  string
  input:               string
  output?:             string
  reasoning?:          string | null
  reasoning_sections?: ReasoningSection[] | null
  model_name?:         string | null
  created_at?:         string | null
  tool_calls?:         unknown[] | null
  // Searches this turn ran, persisted so the sources card survives a reload.
  // Same shape as the live `web_search` event.
  web_searches?:       Array<{ query: string; links: Array<Record<string, unknown> | string>; results?: Array<Record<string, unknown>> }> | null
  attachments?:        BrainAttachment[]
  // External writes this turn performed ("Done in the world"). Persisted on the
  // message (MessageMetadata.external_output) so the card survives a reload —
  // same shape as the live `external_output` SSE event.
  external_output?:    ExternalOutputAction[] | null
}

// ── SSE event payloads (named) ────────────────────────────────────────────────
// Mirrors the backend's core/sse_schemas.py runtime contract. Optional fields
// use `?:`; required fields are typed as non-optional.

export interface MessageSavedEvent       { message_id: string }
export interface TitleEvent              { title: string }
export interface WebSearchEvent          { query: string; links: Array<Record<string, unknown> | string>; results?: Array<Record<string, unknown>> }
export interface ImageEvent              { url: string; s3_key: string }
export interface GeneratedFileEvent      { url: string; s3_key: string; filename: string; mime_type: string; file_size?: number }

export interface ToolProgressEvent {
  tool:            string
  status:          string
  filename:        string
  label?:          string | null
  step?:           string | null
  message?:        string | null
  code_preview?:   string | null
  elapsed_seconds?: number | null
  percent?:        number | null
  detail?:         string | null
}

export interface ToolConnectPromptEvent {
  connector_slug:  string
  display_name:    string
  auth_mode:       string
  tool_name:       string
  request_id:      string
  /** Structured credential fields for api_key connectors, as returned by GET /connectors/{slug}. */
  api_key_fields?: import('@/lib/api/connectors').ApiKeyField[]
}

export type UserPromptKind = 'permission' | 'confirm' | 'choice' | 'input'

export interface UserPromptOption {
  value:  string
  label:  string
  style?: 'primary' | 'secondary' | 'destructive' | string
}

export interface UserPromptEvent {
  prompt_id:    string
  kind:         UserPromptKind | string
  title:        string
  description?: string
  options?:     UserPromptOption[]
  metadata?:    Record<string, unknown>
  respond_url?: string
}

// ── Node-recovery prompt (live user_prompt with metadata.recovery) ────────────
// When a single DAG step fails mid-run, the backend self-diagnoses and emits a
// user_prompt(kind='choice') whose `metadata.recovery` discriminates:
//   • node_failed  — no fix found; options rerun / skip (non-critical) / cancel
//   • fix_proposed — Brain has a concrete fix; options apply / different / cancel
// The chosen value resolves the SAME blocked run via
// respondToPrompt(prompt_id, { response: '<value>' }) — a plain string, exactly
// like the permission/approval prompts. Mirrors
// services/brain/node_recovery.py::recover_from_node_failure (the `metadata`
// dicts it builds) so a schema drift surfaces here, not as a silently-dropped
// card. The decision values are fixed by that same module.

export const recoveryFixDiffSchema = z.object({
  label:  z.string(),
  before: z.string(),
  after:  z.string(),
})
export type RecoveryFixDiff = z.infer<typeof recoveryFixDiffSchema>

const recoveryNodeFailedMetaSchema = z.object({
  recovery: z.literal('node_failed'),
  step: z.object({
    label:       z.string().default(''),
    is_critical: z.boolean().default(false),
  }),
  error: z.string().default(''),
})

const recoveryFixProposedMetaSchema = z.object({
  recovery:    z.literal('fix_proposed'),
  failed_step: z.string().default(''),
  reasoning:   z.string().default(''),
  diffs:       z.array(recoveryFixDiffSchema).default([]),
  error:       z.string().default(''),
})

const recoveryMetaSchema = z.discriminatedUnion('recovery', [
  recoveryNodeFailedMetaSchema,
  recoveryFixProposedMetaSchema,
])

export type RecoveryMeta = z.infer<typeof recoveryMetaSchema>

export interface RecoveryPrompt {
  promptId: string
  meta:     RecoveryMeta
}

/**
 * Parse a raw `user_prompt` SSE payload into a node-recovery prompt, or return
 * null when it isn't one (no prompt_id, no `metadata.recovery`, or a metadata
 * shape that doesn't validate). Routing the boundary through zod means a
 * malformed or foreign prompt can never reach the recovery cards — it falls
 * through to the generic clarification path instead.
 */
export function parseRecoveryPrompt(data: unknown): RecoveryPrompt | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const promptId = typeof d.prompt_id === 'string' ? d.prompt_id : ''
  if (!promptId) return null
  const metaRaw = d.metadata
  if (!metaRaw || typeof metaRaw !== 'object' || !('recovery' in metaRaw)) return null
  const parsed = recoveryMetaSchema.safeParse(metaRaw)
  if (!parsed.success) return null
  return { promptId, meta: parsed.data }
}

// The rally: one triple per agent Brain hands a piece of work to.
export interface AgentStartedEvent  { agent: string; handle?: string; image_url?: string | null; task: string }
export interface AgentContentEvent  { agent: string; content: string }
export interface AgentFinishedEvent { agent: string; error?: string | null }

// Brain receives every relevant Souvenir CUSTOM event. Derive
// the map from the shared validator registry so this API cannot drift into a
// second, partial event inventory.
export type BrainCustomEventName = Exclude<CustomEventName, 'memory_updated'>
export type BrainCustomEvents = {
  [Name in BrainCustomEventName]: CustomEventPayload<Name>
}

// ── UI stream events ─────────────────────────────────────────────────────────

export interface ReasoningHeadingUiEvent    { type: 'reasoning_heading'; content?: string; delta?: string }
export interface ReasoningBodyUiEvent       { type: 'reasoning_body';    content?: string; delta?: string }
export interface ContentUiEvent             { type: 'content';           content: string }

export interface ToolCallPreview {
  id?:        string
  tool_call_id?: string
  name?:      string
  arguments?: string | Record<string, unknown>
  result?:    string
  status?:    string
}

export interface ToolCallsStreamingUiEvent {
  type:       'tool_calls_streaming'
  content:    string
  tool_call?: ToolCallPreview | null
}

export interface ToolExecutingUiEvent {
  type:      'tool_executing'
  content:   string
  tool_call: ToolCallPreview
}

export interface ToolCompleteUiEvent {
  type:      'tool_complete'
  content:   string
  tool_call: ToolCallPreview
}

export interface DoneUiEvent {
  type:               'done'
  usage?:             Record<string, unknown> | null
  reasoning_details?: unknown[] | null
  tool_calls?:        ToolCallPreview[] | null
  finish_reason?:     string | null
}

export interface ErrorUiEvent {
  type:  'error'
  error: string
}

export type BrainUiEvent =
  | ReasoningHeadingUiEvent
  | ReasoningBodyUiEvent
  | ContentUiEvent
  | ToolCallsStreamingUiEvent
  | ToolExecutingUiEvent
  | ToolCompleteUiEvent
  | DoneUiEvent
  | ErrorUiEvent

// ── Prompt response body ──────────────────────────────────────────────────────
// Every prompt kind (choice/input/confirm/permission) follows the same envelope
// and carries kind-specific fields — `value` for choice/input, `decision: 'skip'`
// for user-skipped clarifications, `decision: 'confirm'|'deny'` for confirm.
// The shape is intentionally open: the backend validates per prompt.

export type PromptResponseBody =
  | { response: { decision: 'cancel' } }
  | { response: { decision: 'select'; value: string } }
  | { response: { decision: 'submit'; value: string } }
  | { response: { decision: 'skip' } }
  | { response: Record<string, unknown> }
  // permission_prompt resolves with a plain-string decision ("allow" |
  // "allow_once" | "block").
  | { response: string }

// ── SSE callbacks ─────────────────────────────────────────────────────────────

export interface BrainSSECallbacks {
  onEvent: (name: string, data: Record<string, unknown>, custom: boolean) => void
  onClose?: () => void
  onError?: (e: Error) => void
}

// ── SSE stream consumer ───────────────────────────────────────────────────────

/**
 * Max gap between any bytes from the server before we declare the stream
 * dead. The backend sends `event: stream_heartbeat` every ~5s while blocked
 * on user prompts, but during model thinking and tool execution it can fall
 * silent for tens of seconds — extended-thinking turns, slow tools, and large
 * document processing (multi-page PDFs / DOCX with extracted text injected as
 * document blocks) all produce zero events for extended periods. This value
 * matches the server-side proxy's maxDuration and covers realistic worst-case
 * scenarios while still catching a truly wedged backend.
 */
const STREAM_IDLE_TIMEOUT_MS = 800_000

/**
 * Reads a Brain SSE response body until the stream closes.
 *
 * Parses data-only AG-UI SSE frames and dispatches their UI meaning.
 *
 * Idle watchdog: if no chunk arrives for STREAM_IDLE_TIMEOUT_MS, the reader
 * is cancelled and `onError` is invoked with a timeout error.
 */
export async function consumeBrainStream(
  response: Response,
  callbacks: BrainSSECallbacks,
): Promise<void> {
  if (!response.body) {
    callbacks.onError?.(new Error('No response body'))
    callbacks.onClose?.()
    return
  }

  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  const sseDecoder = new AguiSSEDecoder()
  let timedOut = false
  let watchdog: ReturnType<typeof setTimeout> | null = null

  const dispatch = (event: DecodedSSEEvent) => {
    if (!event.appEvent) return
    callbacks.onEvent(
      event.appEvent.eventName,
      event.appEvent.parsed,
      event.event.type === 'CUSTOM',
    )
  }

  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      timedOut = true
      reader.cancel().catch(() => {})
    }, STREAM_IDLE_TIMEOUT_MS)
  }
  armWatchdog()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of sseDecoder.push(decoder.decode(value, { stream: true }))) {
        dispatch(event)
      }
      armWatchdog()
    }
    for (const event of sseDecoder.push(decoder.decode())) dispatch(event)
    // Some streaming servers close immediately after the final event instead
    // of writing one more blank-line delimiter. Dispatch that complete tail
    // before onClose classifies the stream as terminal or disconnected.
    for (const event of sseDecoder.flush()) dispatch(event)
  } catch (e) {
    // Cancelling via the watchdog resolves read() with {done:true}; only
    // genuine fetch/abort errors land here. AbortError (user-initiated stop)
    // is forwarded as-is so the caller can recognise it.
    if (!timedOut) {
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)))
    }
  } finally {
    if (watchdog) clearTimeout(watchdog)
    if (timedOut) {
      callbacks.onError?.(new Error('Brain went quiet for too long — the connection may have stalled. Please try again.'))
    }
    callbacks.onClose?.()
  }
}

// ── Shared opts type ─────────────────────────────────────────────────────────

export type BrainStreamOpts = {
  persona_id?:      string
  pin_ids?:         string[]
  use_mistral_ocr?: boolean
  files?:           File[]
}

/**
 * Build a urlencoded body for text-only brain requests.
 * When files are present the caller uses /api/brain-chat instead (server-side
 * proxy that re-assembles the FormData so FastAPI receives a complete body
 * with content-length — the generic /api/backend proxy streams raw bytes and
 * its chunked multipart is silently ignored by the backend parser).
 */
function buildTextBody(
  input: string,
  opts:  Omit<BrainStreamOpts, 'files'>,
): { body: BodyInit; headers: HeadersInit } {
  const params = new URLSearchParams()
  params.append('input', input)
  if (opts.persona_id) params.append('persona_id', opts.persona_id)
  if (opts.pin_ids?.length) params.append('pin_ids', JSON.stringify(opts.pin_ids))
  if (opts.use_mistral_ocr) params.append('use_mistral_ocr', 'true')
  return { body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
}

/**
 * Build a FormData body for a file-carrying brain turn. Used both for the
 * /api/brain-chat proxy fallback (local dev) and for the direct-to-backend
 * request on deployed origins — `chatId` is a no-op extra field in the direct
 * case (the URL already encodes it) but harmless for FastAPI to receive.
 */
function buildFileBody(
  input:   string,
  chatId:  string | null,
  opts:    BrainStreamOpts,
): FormData {
  const fd = new FormData()
  fd.append('input', input)
  if (chatId)           fd.append('chatId', chatId)
  if (opts.persona_id)  fd.append('persona_id', opts.persona_id)
  if (opts.pin_ids?.length) fd.append('pin_ids', JSON.stringify(opts.pin_ids))
  if (opts.use_mistral_ocr) fd.append('use_mistral_ocr', 'true')
  opts.files!.forEach(f => fd.append('files', f))
  return fd
}

// ── Start new Brain chat ──────────────────────────────────────────────────────

/**
 * POST /brain/create (text-only) or /api/brain-chat (with files).
 * Returns the new chat ID plus the raw SSE Response.
 */
export async function startBrainChat(
  input:   string,
  opts:    BrainStreamOpts = {},
  signal?: AbortSignal,
): Promise<{ chatId: string; stream: Response }> {
  let response: Response

  if (opts.files?.length) {
    // /api/brain-chat is a Vercel serverless function capped at a 4.5MB request
    // body (FUNCTION_PAYLOAD_TOO_LARGE → 413). On deployed origins, skip it and
    // POST the multipart body straight to the backend — the browser sends a
    // real Content-Length for File-backed FormData, so the chunked-body issue
    // that motivated the proxy (see buildFileBody's docstring) doesn't apply
    // here. Same pattern as persona/project uploads (see directUpload).
    response = await apiFetch(
      shouldUseDirectBackend() ? directUpload(BRAIN_CREATE) : '/api/brain-chat',
      {
        method: 'POST',
        body:   buildFileBody(input, null, opts),
        signal,
      },
    )
  } else {
    const { body, headers } = buildTextBody(input, opts)
    response = await apiFetch(BRAIN_CREATE, { method: 'POST', body, headers, signal })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] create failed', response.status, detail)
    throw new ApiError(response.status, 'brain_create_failed', 'Failed to start Brain chat')
  }

  let chatId = response.headers.get('X-Chat-Id') ?? ''
  if (!chatId) {
    // Prod backend hotfix: older builds don't CORS-expose X-Chat-Id, so the
    // browser hides it on deployed (cross-origin) requests and the chat looks
    // orphaned. The row is already committed by the time these headers arrive,
    // so recover the id from the freshly-ordered chat list (newest first).
    chatId = await recoverNewestChatId()
  }
  return { chatId, stream: response }
}

async function recoverNewestChatId(): Promise<string> {
  try {
    const chats = await listBrainChats()
    return chats[0]?.id ?? ''
  } catch {
    return ''
  }
}

// ── Continue existing Brain chat ──────────────────────────────────────────────

/**
 * POST /brain/{chat_id}/stream (text-only) or /api/brain-chat (with files).
 */
export async function continueBrainChat(
  chatId:  string,
  input:   string,
  opts:    BrainStreamOpts = {},
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response

  if (opts.files?.length) {
    // See startBrainChat above — same 4.5MB proxy cap, same direct-to-backend bypass.
    response = await apiFetch(
      shouldUseDirectBackend() ? directUpload(BRAIN_STREAM(chatId)) : '/api/brain-chat',
      {
        method: 'POST',
        body:   buildFileBody(input, chatId, opts),
        signal,
      },
    )
  } else {
    const { body, headers } = buildTextBody(input, opts)
    response = await apiFetch(BRAIN_STREAM(chatId), { method: 'POST', body, headers, signal })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] stream failed', response.status, detail)
    throw new ApiError(response.status, 'brain_stream_failed', 'Failed to stream Brain message')
  }

  return response
}

// ── REST helpers ──────────────────────────────────────────────────────────────

export async function getBrainMessages(chatId: string): Promise<BrainMessage[]> {
  return apiFetchJson<BrainMessage[]>(BRAIN_MESSAGES(chatId))
}

export async function listBrainChats(): Promise<BrainChatListItem[]> {
  return apiFetchJson<BrainChatListItem[]>(BRAIN_BASE)
}

/**
 * POST /chats/prompts/{prompt_id} — answer a question or consent prompt.
 */
export async function respondToPrompt(
  promptId: string,
  body:     PromptResponseBody,
): Promise<void> {
  const response = await apiFetch(PROMPT_RESPOND(promptId), {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  // 204 No Content is the success response
  if (!response.ok && response.status !== 204) {
    throw new ApiError(response.status, 'prompt_respond_failed', 'Failed to respond to prompt')
  }
}

export async function stopBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_STOP(chatId), { method: 'POST' })
}

export async function starBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_STAR(chatId), { method: 'PATCH' })
}

export async function renameBrainChat(chatId: string, chatTitle: string): Promise<void> {
  await apiFetch(BRAIN_RENAME, {
    method: 'PATCH',
    body:   JSON.stringify({ chat_id: chatId, chat_title: chatTitle }),
  })
}

export async function deleteBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_BASE, {
    method: 'DELETE',
    body:   JSON.stringify({ chat_id: chatId }),
  })
}
