'use client'

import { apiFetch, apiFetchJson, ApiError } from './client'
import { API_BASE_URL } from '../config'

// ── Endpoint helpers ──────────────────────────────────────────────────────────

const withBase = (path: string) => `${API_BASE_URL}${path}`

const BRAIN_BASE      = withBase('/brain')
const BRAIN_BOOTSTRAP = withBase('/brain/bootstrap')
const BRAIN_CREATE    = withBase('/brain/create')
const BRAIN_RENAME    = withBase('/brain/rename')
const BRAIN_STREAM    = (chatId: string) => withBase(`/brain/${chatId}/stream`)
const BRAIN_MESSAGES  = (chatId: string) => withBase(`/brain/${chatId}/messages`)
const BRAIN_PLANS     = (chatId: string) => withBase(`/brain/${chatId}/plans`)
const BRAIN_STOP      = (chatId: string) => withBase(`/brain/${chatId}/stop`)
const BRAIN_STAR      = (chatId: string) => withBase(`/brain/${chatId}/star`)
const PROMPT_RESPOND  = (promptId: string) => withBase(`/chats/prompts/${promptId}`)

// ── Backend types ─────────────────────────────────────────────────────────────

export interface BackendPlanStep {
  id:              string
  title:           string
  description?:    string
  kind:            'skill' | 'connector' | 'tool' | 'synthesis'
  tool?:           string
  connector_slug?: string
  depends_on?:     string[]
  args_preview?:   Record<string, unknown>
  status?:         'pending' | 'running' | 'completed' | 'failed'
  result_preview?: string
  error?:          string
  started_at?:     string
  completed_at?:   string
}

// Newer plans persist a node graph instead of a flat step list. A node carries
// the same render-relevant fields (id/title/status) plus a model_id we
// deliberately don't surface in the UI.
export interface BackendPlanNode {
  id:              string
  kind:            string
  title:           string
  description?:    string
  status?:         string
  model_id?:       string | null
  result_preview?: string
  started_at?:     string
  completed_at?:   string
}

export interface BackendPlanJson {
  summary:              string
  steps?:               BackendPlanStep[]
  nodes?:               BackendPlanNode[]
  edges?:               unknown[]
  plan_text?:           string
  required_connectors?: string[]
}

export interface BrainChatListItem {
  id:             string
  chat_title:     string
  starred?:       boolean
  message_count?: number
  created_at?:    string | null
  updated_at?:    string | null
}

export interface BrainPlanResponse {
  id:             string
  status:         'proposed' | 'approved' | 'countered' | 'cancelled' | 'executing' | 'completed' | 'failed' | string
  supersedes_id?: string | null
  counter_text?:  string | null
  plan_json:      BackendPlanJson
  final_error?:   string | null
  created_at?:    string | null
}

// Images/files generated inside subtasks, returned per-message by GET
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
// Snapshot of everything in scope for one Brain turn (persona, pins, files,
// connectors, …). Fired once at the start of each turn so the FE can populate
// its context sidebar. Mirrors core/sse_schemas.py ContextEvent.
export interface ContextPersona {
  persona_id?:     string
  name?:           string
  handler?:        string
  prompt_preview?: string
  model_id?:       string | null
  // Optional avatar URL — populated when the FE reconstructs context from
  // fetched messages on chat reload (the live `context` event omits this).
  avatar_url?:     string
}
export interface ContextPin {
  pin_id:           string
  title:            string
  content_preview?: string
  tags?:            string[]
}
export interface ContextFile {
  name:       string
  mime_type?: string
  size?:      number
  source?:    string
}
export interface ContextConnector {
  slug:          string
  display_name?: string
  status?:       string
  auth_mode?:    string
  tool_count?:   number
}
export interface BrainContextEvent {
  persona?:          ContextPersona | null
  user_context?:     Record<string, unknown> | null
  pins?:             ContextPin[]
  files?:            ContextFile[]
  connectors?:       ContextConnector[]
  available_models?: unknown[]
}

export interface BrainMessage {
  id:                  string
  input:               string
  output?:             string
  reasoning?:          string | null
  reasoning_sections?: unknown[] | null
  model_name?:         string | null
  created_at?:         string | null
  tool_calls?:         unknown[] | null
  plan?:               BrainPlanResponse | null
  attachments?:        BrainAttachment[]
}

// ── Bootstrap (GET /brain/bootstrap) ──────────────────────────────────────────
// Hydrates the Brain page on mount: which persona is in scope, what the user's
// context looks like, which pins/files/connectors are wired up, and the list
// of models the user can switch to. Used to seed the ContextRail before the
// first turn so the rail isn't empty when the user starts typing.

export interface BootstrapPersona {
  persona_id:      string
  name:            string
  handler:         string
  prompt_preview?: string
  model_id?:       string | null
}

export interface BootstrapUserContext {
  first_name?: string
  last_name?:  string
  email?:      string
  role?:       string
  tone?:       string
}

export interface BootstrapPin {
  pin_id:           string
  title:            string
  tags?:            string[]
  content_preview?: string
}

export interface BootstrapFile {
  file_id:    string
  filename:   string
  mime_type?: string
  url?:       string
}

export type ConnectorStatus = 'connected' | 'disconnected' | 'failed' | 'pending'

export interface BootstrapConnector {
  slug:         string
  display_name: string
  auth_mode:    string
  status:       ConnectorStatus | string
  tool_count?:  number
}

export interface BootstrapModel {
  model_id:             string
  model_name:           string
  deployment_name?:     string
  description_preview?: string
  supports_tool_use?:   boolean
  input_modalities?:    string[]
}

export interface BootstrapProject {
  project_id: string
  name:       string
}

export interface BootstrapDocument {
  document_id: string
  filename:    string
  mime_type?:  string
}

export interface BrainBootstrap {
  persona?:         BootstrapPersona | null
  user_context?:    BootstrapUserContext
  pins?:            BootstrapPin[]
  files?:           BootstrapFile[]
  connectors?:      BootstrapConnector[]
  available_models?: BootstrapModel[]
  project?:         BootstrapProject | null
  documents?:       BootstrapDocument[]
  loaded_skills?:   string[]
}

// ── SSE event payloads (named) ────────────────────────────────────────────────
// Mirror brain.yaml's x-sse-events. Optional fields use `?:` — required
// per spec are typed as non-optional. UserPromptKind reflects the new
// "permission" | "confirm" | "choice" | "input" vocabulary; plan approval
// arrives as a `choice` prompt with approve/counter/cancel options.

export interface MessageSavedEvent       { message_id: string }
export interface TitleEvent              { title: string }
export interface WebSearchEvent          { query: string; links: Array<Record<string, unknown> | string> }
export interface ImageEvent              { url: string; s3_key: string }
export interface GeneratedFileEvent      { url: string; s3_key: string; filename: string; mime_type: string }

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

export interface PlanProposedEvent {
  plan_id:              string
  summary:              string
  steps:                BackendPlanStep[]
  edges?:               Array<Record<string, unknown>>
  plan_text?:           string
  required_connectors?: string[]
}

export interface PlanApprovedEvent  { plan_id: string }
export interface PlanCounteredEvent { plan_id: string; counter_text: string }
export interface PlanCancelledEvent { plan_id: string }
export interface StepStartedEvent   { plan_id: string; step_id: string }
export interface StepCompletedEvent { plan_id: string; step_id: string }
export interface StepFailedEvent    { plan_id: string; step_id: string; error: string }

// Map of named event name → payload shape. Add new events here; the
// dispatcher in page.tsx is type-checked against this map.
export interface BrainNamedEvents {
  message_saved:       MessageSavedEvent
  title:               TitleEvent
  web_search:          WebSearchEvent
  image:               ImageEvent
  generated_file:      GeneratedFileEvent
  tool_progress:       ToolProgressEvent
  tool_connect_prompt: ToolConnectPromptEvent
  user_prompt:         UserPromptEvent
  plan_proposed:       PlanProposedEvent
  plan_approved:       PlanApprovedEvent
  plan_countered:      PlanCounteredEvent
  plan_cancelled:      PlanCancelledEvent
  step_started:        StepStartedEvent
  step_completed:      StepCompletedEvent
  step_failed:         StepFailedEvent
}

// ── SSE event payloads (inline) ───────────────────────────────────────────────
// Inline events arrive as `data: {"type": "<name>", ...}` with no `event:`
// header. Discriminated on `type`.

export interface ReasoningHeadingInline    { type: 'reasoning_heading'; content: string }
export interface ReasoningBodyInline       { type: 'reasoning_body';    content: string }
export interface ReasoningInline           { type: 'reasoning';         content: string }
export interface ContentInline             { type: 'content';           content: string }

export interface ToolCallPreview {
  id?:        string
  name?:      string
  arguments?: string | Record<string, unknown>
  result?:    string
  status?:    string
}

export interface ToolCallsStreamingInline {
  type:       'tool_calls_streaming'
  content:    string
  tool_call?: ToolCallPreview | null
}

export interface ToolExecutingInline {
  type:      'tool_executing'
  content:   string
  tool_call: ToolCallPreview
}

export interface ToolCompleteInline {
  type:      'tool_complete'
  content:   string
  tool_call: ToolCallPreview
}

export interface DoneInline {
  type:               'done'
  usage?:             Record<string, unknown> | null
  reasoning_details?: unknown[] | null
  tool_calls?:        ToolCallPreview[] | null
  finish_reason?:     string | null
}

export interface ErrorInline {
  type:  'error'
  error: string
}

export type BrainInlineEvent =
  | ReasoningHeadingInline
  | ReasoningBodyInline
  | ReasoningInline
  | ContentInline
  | ToolCallsStreamingInline
  | ToolExecutingInline
  | ToolCompleteInline
  | DoneInline
  | ErrorInline

// ── Prompt response body ──────────────────────────────────────────────────────
// Plan prompts use the documented approve/counter/cancel shape. Non-plan
// kinds (choice/input/confirm/permission) follow the same envelope but
// carry kind-specific fields — `value` for choice/input, `decision: 'skip'`
// for user-skipped clarifications, `decision: 'confirm'|'deny'` for confirm.
// The shape is intentionally open: the backend validates per prompt.

export type PromptResponseBody =
  | { response: { decision: 'approve' } }
  | { response: { decision: 'counter'; counter_text: string } }
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
  onNamed:  (name: string, data: unknown) => void
  onInline: (data: unknown) => void
  onClose?: () => void
  onError?: (e: Error) => void
}

// ── SSE stream consumer ───────────────────────────────────────────────────────

/**
 * Max gap between any bytes from the server before we declare the stream
 * dead. The backend sends `event: stream_heartbeat` every ~5s while blocked
 * on user prompts, but during model thinking and tool execution it can fall
 * silent for tens of seconds — extended-thinking turns and slow tools both
 * produce zero events until they're done. Two minutes covers realistic
 * worst-case latency while still catching a truly wedged backend.
 */
const STREAM_IDLE_TIMEOUT_MS = 120_000

/**
 * Reads a Brain SSE response body until the stream closes.
 *
 * Spec-compliant parsing: tolerates `\r\n` / `\n` line endings, optional
 * space after `event:` / `data:`, and multi-line `data:` (joined with `\n`
 * before JSON.parse, per WHATWG EventSource spec).
 *
 * Named events  (`event: <name>\ndata: {...}`)  → callbacks.onNamed
 * Inline events (`data: {...}`)                 → callbacks.onInline
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
  let buf = ''
  let timedOut = false
  let watchdog: ReturnType<typeof setTimeout> | null = null

  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      timedOut = true
      reader.cancel().catch(() => {})
    }, STREAM_IDLE_TIMEOUT_MS)
  }
  armWatchdog()

  // Matches `\n\n`, `\r\n\r\n`, and the mixed forms — per the SSE spec, any
  // of CR / LF / CRLF is a valid line terminator.
  const boundaryRe = /\r?\n\r?\n/

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      armWatchdog()

      let m: RegExpExecArray | null
      while ((m = boundaryRe.exec(buf)) !== null) {
        const block = buf.slice(0, m.index)
        buf = buf.slice(m.index + m[0].length)
        if (!block) continue

        let eventName = ''
        const dataLines: string[] = []
        for (const rawLine of block.split(/\r?\n/)) {
          if (rawLine.startsWith('event:')) {
            const v = rawLine.slice(6)
            eventName = v.startsWith(' ') ? v.slice(1) : v
          } else if (rawLine.startsWith('data:')) {
            const v = rawLine.slice(5)
            dataLines.push(v.startsWith(' ') ? v.slice(1) : v)
          }
          // `id:`, `retry:`, `:` comments, and blank lines are ignored.
        }
        if (dataLines.length === 0) continue

        const dataStr = dataLines.join('\n')
        let data: unknown
        try {
          data = JSON.parse(dataStr)
        } catch {
          console.warn('[Brain SSE] failed to parse data block:', dataStr.slice(0, 200))
          continue
        }

        if (eventName) callbacks.onNamed(eventName, data)
        else           callbacks.onInline(data)
      }
    }
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
      callbacks.onError?.(new Error('Brain went quiet for 2 minutes — the connection may have stalled. Please try again.'))
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

/** Build a FormData body for the /api/brain-chat server-side proxy. */
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
    // Route through the server-side proxy so FastAPI receives a complete
    // multipart body (content-length included) rather than a chunked stream.
    response = await apiFetch('/api/brain-chat', {
      method: 'POST',
      body:   buildFileBody(input, null, opts),
      signal,
    })
  } else {
    const { body, headers } = buildTextBody(input, opts)
    response = await apiFetch(BRAIN_CREATE, { method: 'POST', body, headers, signal })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] create failed', response.status, detail)
    throw new ApiError(response.status, 'brain_create_failed', 'Failed to start Brain chat')
  }

  const chatId = response.headers.get('X-Chat-Id') ?? ''
  return { chatId, stream: response }
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
    response = await apiFetch('/api/brain-chat', {
      method: 'POST',
      body:   buildFileBody(input, chatId, opts),
      signal,
    })
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

export async function getBrainPlans(chatId: string): Promise<BrainPlanResponse[]> {
  return apiFetchJson<BrainPlanResponse[]>(BRAIN_PLANS(chatId))
}

export async function listBrainChats(): Promise<BrainChatListItem[]> {
  return apiFetchJson<BrainChatListItem[]>(BRAIN_BASE)
}

/**
 * GET /brain/bootstrap — page-load context: persona in scope, user_context,
 * pins/files attached, linked connectors, available models, current project.
 * Seeds the ContextRail before the first turn.
 */
export async function getBrainBootstrap(): Promise<BrainBootstrap> {
  return apiFetchJson<BrainBootstrap>(BRAIN_BOOTSTRAP)
}

/**
 * POST /chats/prompts/{prompt_id} — submit approve / counter / cancel for a plan.
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
