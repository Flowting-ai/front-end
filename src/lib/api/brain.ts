'use client'

import { z } from 'zod'
import { apiFetch, apiFetchJson, ApiError } from './client'
import { API_BASE_URL, directUpload, shouldUseDirectBackend } from '../config'
import type { ReasoningSection } from '../reasoning'

// ── Endpoint helpers ──────────────────────────────────────────────────────────

const withBase = (path: string) => `${API_BASE_URL}${path}`

const BRAIN_BASE      = withBase('/brain')
const BRAIN_BOOTSTRAP = withBase('/brain/bootstrap')
const BRAIN_CREATE    = withBase('/brain/create?protocol=agui')
const BRAIN_RENAME    = withBase('/brain/rename')
const BRAIN_STREAM    = (chatId: string) => withBase(`/brain/${chatId}/stream?protocol=agui`)
const BRAIN_MESSAGES  = (chatId: string) => withBase(`/brain/${chatId}/messages`)
const BRAIN_PLANS     = (chatId: string) => withBase(`/brain/${chatId}/plans`)
const BRAIN_RUN       = (planId: string) => withBase(`/brain/runs/${planId}`)
const BRAIN_RUN_EVENTS = (planId: string, afterSeq?: number) => {
  const path = withBase(`/brain/runs/${planId}/events`)
  return afterSeq != null && afterSeq > 0
    ? `${path}?after=${encodeURIComponent(String(afterSeq))}`
    : path
}
const BRAIN_RUN_STOP  = (planId: string) => withBase(`/brain/runs/${planId}/stop`)
const BRAIN_PLAN_APPROVE = (planId: string) => withBase(`/brain/plans/${planId}/approve`)
const BRAIN_PLAN_COUNTER = (planId: string) => withBase(`/brain/plans/${planId}/counter`)
const BRAIN_PLAN_CANCEL  = (planId: string) => withBase(`/brain/plans/${planId}/cancel`)
const BRAIN_STOP      = (chatId: string) => withBase(`/brain/${chatId}/stop`)
const BRAIN_STAR      = (chatId: string) => withBase(`/brain/${chatId}/star`)
const PROMPT_RESPOND  = (promptId: string) => withBase(`/chats/prompts/${promptId}`)

// ── Backend types ─────────────────────────────────────────────────────────────

// The unified plan node (services/cortex/schema.py Node + runtime state).
// `plan_proposed.steps` and persisted `plan_json.nodes` both carry this shape.
// Zod-validated (like the context event / recovery prompts) so a backend schema
// drift surfaces here as a dropped row, not a silent `undefined` in the UI.
// Lenient: only `id`/`task` are load-bearing; unknown extra keys pass through.
const nodeContextSchema = z.object({
  connectors: z.array(z.string()).default([]),
  pins:       z.array(z.string()).default([]),
  files:      z.array(z.string()).default([]),
}).partial().passthrough()

export const backendPlanNodeSchema = z.object({
  id:              z.string().trim().min(1),
  task:            z.string().default(''),
  persona_id:      z.string().nullish(),
  model_id:        z.string().nullish(),
  model_name:      z.string().nullish(),
  model_company:   z.string().nullish(),
  context:         nodeContextSchema.optional(),
  is_critical:     z.boolean().optional(),
  status:          z.string().optional(),
  result_preview:  z.string().optional(),
  error:           z.string().optional(),
  started_at:      z.string().optional(),
  completed_at:    z.string().optional(),
}).passthrough()

export type BackendPlanNode = z.output<typeof backendPlanNodeSchema>
// Back-compat alias: the event field is still named `steps`.
export type BackendPlanStep = BackendPlanNode

/** Validate a raw plan-node array (plan_proposed.steps or plan_json.nodes),
 *  dropping any row that fails rather than letting a malformed node through. */
export function parsePlanNodes(value: unknown): BackendPlanNode[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const parsed = backendPlanNodeSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
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
  status:         'proposed' | 'countered' | 'cancelled' | 'queued' | 'running' | 'summarizing' | 'completed' | 'failed' | string
  supersedes_id?: string | null
  counter_text?:  string | null
  plan_json:      BackendPlanJson
  final_error?:   string | null
  started_at?:    string | null
  completed_at?:  string | null
  cancel_requested_at?: string | null
  created_at?:    string | null
}

export interface BrainPlanActionResponse {
  plan_id: string
  status:  string
}

export interface BrainRunResponse {
  id:             string
  status:         BrainPlanResponse['status']
  plan_json:      BackendPlanJson
  final_error?:   string | null
  latest_seq:     number
  started_at?:    string | null
  completed_at?:  string | null
  cancel_requested_at?: string | null
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
  plan?:               BrainPlanResponse | null
  attachments?:        BrainAttachment[]
  // External writes this turn performed ("Done in the world"). Persisted on the
  // message (MessageMetadata.external_output) so the card survives a reload —
  // same shape as the live `external_output` SSE event.
  external_output?:    ExternalOutputAction[] | null
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

// The model router emits this before generation starts. Keep this at the API
// boundary so Brain can disclose the actual routed model without trusting an
// arbitrary SSE object in the page component.
const optionalEventString = z.string().trim().min(1).optional()

export const modelSelectedEventSchema = z.looseObject({
  model_id:        optionalEventString,
  model_name:      optionalEventString,
  // Some legacy streams used camelCase for this one field.
  modelName:       optionalEventString,
  deployment_name: optionalEventString,
  company:         optionalEventString,
  complexity:      optionalEventString,
  thinking_enabled: z.boolean().optional(),
  effort:          optionalEventString,
}).transform((event) => ({
  modelId:         event.model_id,
  modelName:       event.model_name ?? event.modelName,
  deploymentName: event.deployment_name,
  company:         event.company,
  complexity:      event.complexity,
  thinkingEnabled: event.thinking_enabled,
  effort:          event.effort,
}))

export type ModelSelectedEvent = z.output<typeof modelSelectedEventSchema>

export function parseModelSelectedEvent(value: unknown): ModelSelectedEvent | null {
  const parsed = modelSelectedEventSchema.safeParse(value)
  return parsed.success && parsed.data.modelName ? parsed.data : null
}

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
export interface RunQueuedEvent     { plan_id: string; seq?: number }
export interface RunStartedEvent    { plan_id: string; seq?: number }
export interface RunSummarizingEvent { plan_id: string; seq?: number }
export interface RunCompletedEvent  { plan_id: string; seq?: number }
export interface RunFailedEvent     { plan_id: string; error?: string | null; seq?: number }
export interface RunCancelledEvent  { plan_id: string; seq?: number }
export interface StepStartedEvent   { plan_id: string; step_id: string; seq?: number }
export interface StepCompletedEvent { plan_id: string; step_id: string }
export interface StepFailedEvent    { plan_id: string; step_id: string; error: string }
export interface StepSkippedEvent   { plan_id: string; step_id: string; reason?: string | null; seq?: number }

// Map of named event name → payload shape. Add new events here; the
// dispatcher in page.tsx is type-checked against this map.
export interface BrainNamedEvents {
  message_saved:       MessageSavedEvent
  title:               TitleEvent
  model_selected:      ModelSelectedEvent
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
  run_queued:          RunQueuedEvent
  run_started:         RunStartedEvent
  run_summarizing:     RunSummarizingEvent
  run_completed:       RunCompletedEvent
  run_failed:          RunFailedEvent
  run_cancelled:       RunCancelledEvent
  step_started:        StepStartedEvent
  step_completed:      StepCompletedEvent
  step_failed:         StepFailedEvent
  step_skipped:        StepSkippedEvent
}

// ── SSE event payloads (inline) ───────────────────────────────────────────────
// Inline events arrive as `data: {"type": "<name>", ...}` with no `event:`
// header. Discriminated on `type`.

export interface ReasoningHeadingInline    { type: 'reasoning_heading'; content?: string; delta?: string }
export interface ReasoningBodyInline       { type: 'reasoning_body';    content?: string; delta?: string }
export interface ReasoningInline           { type: 'reasoning';         content?: string; delta?: string }
export interface ContentInline             { type: 'content';           content: string }

const toolArgumentsSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.string(),
])

export const toolCallPreviewSchema = z.looseObject({
  id:            optionalEventString,
  tool_call_id:  optionalEventString,
  name:          optionalEventString,
  arguments:     toolArgumentsSchema.optional(),
  raw_arguments: z.string().optional(),
  result:        z.string().optional(),
  status:        optionalEventString,
  duration_s:    z.number().nonnegative().optional(),
})

export type ToolCallPreview = z.output<typeof toolCallPreviewSchema>

export type BrainToolActivityStatus = 'streaming' | 'executing' | 'complete'

export interface BrainToolActivity {
  /** Provider call id when present; tool name is the stable legacy fallback. */
  key:       string
  status:    BrainToolActivityStatus
  label?:    string
  tool_call: ToolCallPreview
  /** Owning plan node when the event came from a subtask (dispatcher stamps it). */
  stepId?:   string
}

const toolActivityEventSchema = z.looseObject({
  type: z.enum(['tool_calls_streaming', 'tool_executing', 'tool_complete']),
  content: optionalEventString,
  label:   optionalEventString,
  step_id: optionalEventString,
  tool_call: toolCallPreviewSchema.nullish(),
})

function parseToolArguments(value: ToolCallPreview['arguments']): ToolCallPreview['arguments'] {
  if (typeof value !== 'string') return value
  try {
    const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : value
  } catch {
    // Argument fragments are expected during tool_calls_streaming. Preserve the
    // string for correlation, but never render it directly in the UI.
    return value
  }
}

/** Parse one untrusted inline tool lifecycle event into a UI-safe activity. */
export function parseBrainToolActivity(value: unknown): BrainToolActivity | null {
  const parsed = toolActivityEventSchema.safeParse(value)
  if (!parsed.success) return null

  const rawCall = parsed.data.tool_call ?? {}
  const name = rawCall.name ?? parsed.data.content
  if (!name) return null

  const toolCall: ToolCallPreview = {
    ...rawCall,
    name,
    arguments: parseToolArguments(rawCall.arguments),
  }
  const status: BrainToolActivityStatus =
    parsed.data.type === 'tool_calls_streaming' ? 'streaming'
      : parsed.data.type === 'tool_executing' ? 'executing'
        : 'complete'

  return {
    key: rawCall.tool_call_id ?? rawCall.id ?? name,
    status,
    label: parsed.data.label,
    tool_call: toolCall,
    stepId: parsed.data.step_id,
  }
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
  /** AG-UI RUN_STARTED — carries the backend thread (chat) id. The one
   *  reliable source of a new chat's id on cross-origin streams. */
  onRunStarted?: (threadId: string, runId: string) => void
}

// ── AG-UI frame mapping ───────────────────────────────────────────────────────
// The backend re-encodes the brain stream as AG-UI events when the request
// carries ?protocol=agui. Souvenir named events ride as CUSTOM (name/value),
// legacy inline meta frames ride as CUSTOM whose value keeps its `type`, and
// the text/thinking/tool lifecycles replace the legacy inline frames. Frames
// are detected per-block, so legacy streams (e.g. the files proxy) keep
// working through the same consumer.

const AGUI_LIFECYCLE_NOOP = new Set([
  'TEXT_MESSAGE_START', 'TEXT_MESSAGE_END',
  'THINKING_START', 'THINKING_END',
  'THINKING_TEXT_MESSAGE_START', 'THINKING_TEXT_MESSAGE_END',
  'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT',
  'STATE_SNAPSHOT', 'STATE_DELTA', 'MESSAGES_SNAPSHOT', 'RAW',
])

function dispatchAguiFrame(d: Record<string, unknown>, callbacks: BrainSSECallbacks): boolean {
  const t = d.type
  if (typeof t !== 'string') return false
  switch (t) {
    case 'RUN_STARTED':
      callbacks.onRunStarted?.(String(d.threadId ?? ''), String(d.runId ?? ''))
      return true
    case 'TEXT_MESSAGE_CONTENT':
      callbacks.onInline({ type: 'content', content: String(d.delta ?? '') })
      return true
    case 'THINKING_TEXT_MESSAGE_CONTENT':
      callbacks.onInline({ type: 'reasoning', content: String(d.delta ?? '') })
      return true
    case 'TOOL_CALL_START':
      callbacks.onInline({
        type: 'tool_calls_streaming',
        content: String(d.toolCallName ?? ''),
        tool_call: { name: d.toolCallName, tool_call_id: d.toolCallId },
      })
      return true
    case 'CUSTOM': {
      const name = typeof d.name === 'string' ? d.name : 'unknown'
      const value = (typeof d.value === 'object' && d.value !== null
        ? d.value : { value: d.value }) as Record<string, unknown>
      // Legacy inline meta (tool_executing, tool_complete, tool_error,
      // reasoning_heading/body) keeps its `type` inside the value.
      if (value.type === name) callbacks.onInline(value)
      else callbacks.onNamed(name, value)
      return true
    }
    case 'RUN_FINISHED': {
      const result = (typeof d.result === 'object' && d.result !== null
        ? d.result : {}) as Record<string, unknown>
      callbacks.onInline({ type: 'done', finish_reason: 'stop', usage: result.usage })
      return true
    }
    case 'RUN_ERROR':
      callbacks.onInline({ type: 'error', error: String(d.message ?? 'stream error') })
      return true
    default:
      return AGUI_LIFECYCLE_NOOP.has(t)
  }
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
 * Spec-compliant parsing: tolerates `\r\n` / `\n` / `\r` line endings, optional
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

  const dispatchBlock = (block: string) => {
    if (!block.trim()) return

    let eventName = ''
    const dataLines: string[] = []
    for (const rawLine of block.split(/\r\n|\r|\n/)) {
      if (rawLine.startsWith('event:')) {
        const v = rawLine.slice(6)
        eventName = v.startsWith(' ') ? v.slice(1) : v
      } else if (rawLine.startsWith('data:')) {
        const v = rawLine.slice(5)
        dataLines.push(v.startsWith(' ') ? v.slice(1) : v)
      }
      // `id:`, `retry:`, `:` comments, and blank lines are ignored.
    }
    if (dataLines.length === 0) return

    const dataStr = dataLines.join('\n')
    let data: unknown
    try {
      data = JSON.parse(dataStr)
    } catch {
      console.warn('[Brain SSE] failed to parse data block:', dataStr.slice(0, 200))
      return
    }

    if (!eventName && data && typeof data === 'object'
        && dispatchAguiFrame(data as Record<string, unknown>, callbacks)) return
    if (eventName) callbacks.onNamed(eventName, data)
    else           callbacks.onInline(data)
  }

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
  const boundaryRe = /\r\n\r\n|\n\n|\r\r/

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
        dispatchBlock(block)
      }
    }
    buf += decoder.decode()
    // Some streaming servers close immediately after the final event instead
    // of writing one more blank-line delimiter. Dispatch that complete tail
    // before onClose classifies the stream as terminal or disconnected.
    dispatchBlock(buf)
    buf = ''
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

export async function getBrainPlans(chatId: string): Promise<BrainPlanResponse[]> {
  return apiFetchJson<BrainPlanResponse[]>(BRAIN_PLANS(chatId))
}

export async function getBrainRun(planId: string): Promise<BrainRunResponse> {
  return apiFetchJson<BrainRunResponse>(BRAIN_RUN(planId))
}

export async function approveBrainPlan(planId: string): Promise<BrainPlanActionResponse> {
  return apiFetchJson<BrainPlanActionResponse>(BRAIN_PLAN_APPROVE(planId), { method: 'POST' })
}

export async function counterBrainPlan(
  planId: string,
  counterText: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await apiFetch(BRAIN_PLAN_COUNTER(planId), {
    method: 'POST',
    body: JSON.stringify({ counter_text: counterText }),
    signal,
  })
  if (!response.ok) {
    throw new ApiError(response.status, 'brain_plan_counter_failed', 'Failed to revise Brain plan')
  }
  return response
}

export async function cancelBrainPlan(planId: string): Promise<BrainPlanActionResponse> {
  return apiFetchJson<BrainPlanActionResponse>(BRAIN_PLAN_CANCEL(planId), { method: 'POST' })
}

export async function subscribeBrainRun(
  planId: string,
  afterSeq?: number,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await apiFetch(BRAIN_RUN_EVENTS(planId, afterSeq), { method: 'GET', signal })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Brain] run stream failed', response.status, detail)
    throw new ApiError(response.status, 'brain_run_stream_failed', 'Failed to stream Brain run')
  }
  return response
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

export async function stopBrainRun(planId: string): Promise<void> {
  await apiFetch(BRAIN_RUN_STOP(planId), { method: 'POST' })
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
