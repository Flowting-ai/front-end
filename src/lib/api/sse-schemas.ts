import { z } from "zod"

// ── Backend SSE vocabulary ────────────────────────────────────────────────────
// Mirrors services/llm/sse_schemas.py (SouvenirAI). Two kinds of events share
// the wire:
//   - named events:  `event: <name>\ndata: {...}` — lifecycle, tools, plan/run
//   - inline events: `data: {"type":"<name>",...}` — streamed LLM tokens
// Schemas are loose: unknown fields pass through so backend additions never
// break parsing. Validation failures log once per event name and hand back the
// raw payload — drift surfaces in the console, never as a dropped frame.

const promptOption = z.looseObject({
  value: z.string().optional(),
  label: z.string().optional(),
  style: z.string().optional(),
})

export const externalOutputActionSchema = z.looseObject({
  verb: z.string(),
  target: z.string(),
  connector: z.string(),
  connector_slug: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  view_url: z.string().nullable().optional(),
})

const toolProgressFields = {
  label: z.string().nullable().optional(),
  step: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  filename: z.string().optional(),
  code_preview: z.string().nullable().optional(),
  elapsed_seconds: z.number().nullable().optional(),
  percent: z.number().nullable().optional(),
  detail: z.string().nullable().optional(),
}

const promptGateFields = {
  prompt_id: z.string(),
  respond_url: z.string().optional().default(""),
  expires_at: z.string().optional().default(""),
}

export const namedEventSchemas = {
  message_saved: z.looseObject({ message_id: z.string().optional() }),
  title: z.looseObject({ title: z.string() }),
  web_search: z.looseObject({
    query: z.string().optional().default(""),
    links: z.array(z.unknown()).optional().default([]),
  }),
  image: z.looseObject({
    url: z.string(),
    s3_key: z.string().optional(),
    plan_id: z.string().nullable().optional(),
    step_id: z.string().nullable().optional(),
  }),
  generated_file: z.looseObject({
    url: z.string(),
    s3_key: z.string().optional(),
    filename: z.string(),
    mime_type: z.string().optional(),
    file_size: z.number().optional(),
  }),
  external_output: z.looseObject({
    actions: z.array(externalOutputActionSchema).optional().default([]),
    completed_at: z.string().nullable().optional(),
  }),
  memory_updated: z.looseObject({
    scope: z.string(),
    scope_id: z.string(),
    memory: z.string(),
    version: z.number(),
  }),
  model_selected: z.looseObject({
    model_id: z.string(),
    model_name: z.string(),
    deployment_name: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    complexity: z.string().nullable().optional(),
    thinking_enabled: z.boolean().nullable().optional(),
    effort: z.string().nullable().optional(),
  }),
  tool_progress: z.looseObject({
    tool: z.string(),
    status: z.string(),
    ...toolProgressFields,
  }),
  docx_progress: z.looseObject({
    step: z.string(),
    ...toolProgressFields,
  }),
  tool_connect_prompt: z.looseObject({
    connector_slug: z.string(),
    display_name: z.string(),
    auth_mode: z.string(),
    tool_name: z.string(),
    request_id: z.string(),
    icon_url: z.string().nullable().optional(),
    prompt_id: z.string().optional().default(""),
    respond_url: z.string().optional().default(""),
    expires_at: z.string().optional().default(""),
    api_key_fields: z.array(z.looseObject({})).optional().default([]),
    options: z.array(promptOption).optional().default([]),
  }),
  user_prompt: z.looseObject({
    ...promptGateFields,
    kind: z.string(),
    title: z.string(),
    description: z.string().optional().default(""),
    options: z.array(promptOption).optional().default([]),
    metadata: z.looseObject({}).optional().default({}),
  }),
  prompt_timeout: z.looseObject({
    prompt_id: z.string(),
    kind: z.string().optional().default(""),
  }),
  prompt_resolved: z.looseObject({
    prompt_id: z.string(),
    kind: z.string().optional().default(""),
  }),
  questions: z.looseObject({
    ...promptGateFields,
    title: z.string().optional().default(""),
    description: z.string().optional().default(""),
    questions: z.array(z.looseObject({})).optional().default([]),
  }),
  permission_prompt: z.looseObject({
    ...promptGateFields,
    connector_slug: z.string(),
    display_name: z.string(),
    tool_slug: z.string(),
    icon_url: z.string().nullable().optional(),
    summary: z.string().optional().default(""),
    suggested_args: z.looseObject({}).optional().default({}),
    idempotency_key: z.string().optional().default(""),
    persistable: z.boolean().optional().default(true),
    options: z.array(promptOption).optional().default([]),
  }),
  approval_prompt: z.looseObject({
    ...promptGateFields,
    verb: z.string(),
    connector_slug: z.string(),
    display_name: z.string(),
    tool_slug: z.string().optional().default(""),
    target: z.string().optional().default(""),
    preview_xml: z.string().optional().default(""),
    arguments: z.looseObject({}).optional().default({}),
    options: z.array(promptOption).optional().default([]),
  }),
  context: z.looseObject({
    persona: z.looseObject({}).nullable().optional(),
    user_context: z.looseObject({}).nullable().optional(),
    pins: z.array(z.looseObject({})).optional().default([]),
    files: z.array(z.looseObject({})).optional().default([]),
    connectors: z.array(z.looseObject({})).optional().default([]),
    available_models: z.array(z.looseObject({})).optional().default([]),
    project: z.looseObject({}).nullable().optional(),
    documents: z.array(z.looseObject({})).optional().default([]),
    loaded_skills: z.array(z.string()).optional().default([]),
  }),
  plan_ready: z.looseObject({ plan_id: z.string() }),
  plan_approved: z.looseObject({ plan_id: z.string() }),
  plan_countered: z.looseObject({ plan_id: z.string(), counter_text: z.string() }),
  plan_cancelled: z.looseObject({ plan_id: z.string() }),
  run_queued: z.looseObject({ plan_id: z.string() }),
  run_started: z.looseObject({ plan_id: z.string() }),
  run_summarizing: z.looseObject({ plan_id: z.string() }),
  run_completed: z.looseObject({ plan_id: z.string() }),
  run_failed: z.looseObject({ plan_id: z.string(), error: z.string().nullable().optional() }),
  run_cancelled: z.looseObject({ plan_id: z.string() }),
  step_started: z.looseObject({ plan_id: z.string(), step_id: z.string() }),
  step_completed: z.looseObject({ plan_id: z.string(), step_id: z.string() }),
  step_failed: z.looseObject({ plan_id: z.string(), step_id: z.string(), error: z.string() }),
  step_skipped: z.looseObject({
    plan_id: z.string(),
    step_id: z.string(),
    reason: z.string().nullable().optional(),
  }),
  step_content: z.looseObject({ plan_id: z.string(), step_id: z.string(), content: z.string() }),
  step_reasoning: z.looseObject({
    plan_id: z.string(),
    step_id: z.string(),
    content: z.string(),
    heading: z.boolean().optional().default(false),
  }),
  stream_heartbeat: z.looseObject({ elapsed_seconds: z.number().optional() }),
} as const

export type NamedEventName = keyof typeof namedEventSchemas
export type NamedEventPayload<K extends NamedEventName> = z.infer<(typeof namedEventSchemas)[K]>

// Inline stream events (services/llm/schemas.py StreamEvent + sse_schemas.py
// inline models). On the raw stream the name rides in the JSON `type` field;
// on the AG-UI chat stream the same payloads arrive as CUSTOM events keyed by
// name — so payload schemas are kept name-addressable too.
export const inlineEventSchemas = {
  content: z.looseObject({ content: z.string() }),
  reasoning: z.looseObject({ content: z.string().optional().default("") }),
  reasoning_heading: z.looseObject({ content: z.string().optional().default("") }),
  reasoning_body: z.looseObject({ content: z.string().optional().default("") }),
  tool_calls_streaming: z.looseObject({
    content: z.string().optional().default(""),
    tool_call: z.looseObject({}).nullable().optional(),
  }),
  tool_executing: z.looseObject({
    content: z.string().optional().default(""),
    tool_call: z.looseObject({}).optional(),
  }),
  tool_complete: z.looseObject({
    content: z.string().optional().default(""),
    tool_call: z.looseObject({}).optional(),
  }),
  tool_call: z.looseObject({
    content: z.string().nullable().optional(),
    tool_call: z.looseObject({}).nullable().optional(),
  }),
  tool_error: z.looseObject({
    content: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
  }),
  done: z.looseObject({
    usage: z.looseObject({}).nullable().optional(),
    reasoning_details: z.array(z.unknown()).nullable().optional(),
    tool_calls: z.array(z.looseObject({})).nullable().optional(),
    finish_reason: z.string().nullable().optional(),
  }),
  error: z.looseObject({
    error: z.string(),
    source: z.string().optional(),
  }),
} as const

export type InlineEventName = keyof typeof inlineEventSchemas

const warnedEvents = new Set<string>()

function warnOnce(key: string, message: string, issue: unknown): void {
  if (warnedEvents.has(key)) return
  warnedEvents.add(key)
  console.warn(message, issue)
}

/** Validate a named SSE event payload against the backend contract.
 *  Unknown event names pass through untouched (legacy/FE-only events);
 *  validation failures warn once per name and return the raw payload so a
 *  contract drift never drops a frame. */
export function validateNamedEvent(
  name: string,
  payload: unknown,
): Record<string, unknown> {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  const schema = (namedEventSchemas as Record<string, z.ZodType | undefined>)[name]
  if (!schema) return raw
  const result = schema.safeParse(raw)
  if (result.success) return result.data as Record<string, unknown>
  warnOnce(`named:${name}`, `[sse] '${name}' event failed schema validation`, result.error.issues)
  return raw
}

/** Validate an inline (`data`-only, `type`-tagged) stream event. Same
 *  never-drop policy as validateNamedEvent. */
export function validateInlineEvent(payload: unknown): Record<string, unknown> {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  if (typeof raw.type !== "string") return raw
  const schema = (inlineEventSchemas as Record<string, z.ZodType | undefined>)[raw.type]
  if (!schema) return raw
  const result = schema.safeParse(raw)
  if (result.success) return { ...(result.data as Record<string, unknown>), type: raw.type }
  warnOnce(`inline:${raw.type}`, `[sse] inline '${raw.type}' event failed schema validation`, result.error.issues)
  return raw
}

/** Resolve an event payload by name alone — named vocabulary first, then the
 *  inline vocabulary (AG-UI CUSTOM events carry inline payloads keyed by
 *  name). Unknown names pass through untouched. */
export function validateEventByName(name: string, payload: unknown): Record<string, unknown> {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  if (name in namedEventSchemas) return validateNamedEvent(name, raw)
  const schema = (inlineEventSchemas as Record<string, z.ZodType | undefined>)[name]
  if (!schema) return raw
  const result = schema.safeParse(raw)
  if (result.success) return result.data as Record<string, unknown>
  warnOnce(`custom:${name}`, `[sse] '${name}' event failed schema validation`, result.error.issues)
  return raw
}
