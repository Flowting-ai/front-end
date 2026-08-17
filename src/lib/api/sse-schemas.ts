import { z } from "zod"

// ── Souvenir AG-UI CUSTOM vocabulary ─────────────────────────────────────────
// Standard lifecycle, text, tool, and activity frames are validated by
// lib/agui/schemas.ts. These schemas cover only product-specific CUSTOM values.

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

export const customEventSchemas = {
  reasoning_heading: z.looseObject({
    content: z.string().optional().default(""),
    round_index: z.number().nullable().optional(),
  }),
  reasoning_body: z.looseObject({
    content: z.string().optional().default(""),
    round_index: z.number().nullable().optional(),
  }),
  message_saved: z.looseObject({ message_id: z.string().optional() }),
  title: z.looseObject({ title: z.string() }),
  web_search: z.looseObject({
    query: z.string().optional().default(""),
    links: z.array(z.unknown()).optional().default([]),
    results: z.array(z.unknown()).optional().default([]),
  }),
  image: z.looseObject({
    url: z.string(),
    s3_key: z.string().optional(),
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
  tool_progress: z.looseObject({
    tool: z.string(),
    status: z.string(),
    ...toolProgressFields,
  }),
  docx_progress: z.looseObject({
    ...toolProgressFields,
    step: z.string(),
  }),
  tool_connect_prompt: z.looseObject({
    connector_slug: z.string(),
    display_name: z.string(),
    auth_mode: z.string(),
    tool_slug: z.string(),
    prompt_id: z.string(),
    icon_url: z.string().nullable().optional(),
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
  question_prompt: z.looseObject({
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
  agent_started: z.looseObject({
    agent: z.string(),
    handle: z.string().optional().default(""),
    image_url: z.string().nullable().optional(),
    task: z.string(),
  }),
  agent_content: z.looseObject({ agent: z.string(), content: z.string() }),
  agent_finished: z.looseObject({
    agent: z.string(),
    error: z.string().nullable().optional(),
  }),
  stream_heartbeat: z.looseObject({ elapsed_seconds: z.number().optional() }),
} as const

export type CustomEventName = keyof typeof customEventSchemas
export type CustomEventPayload<K extends CustomEventName> = z.infer<(typeof customEventSchemas)[K]>

const warnedEvents = new Set<string>()

function warnOnce(key: string, message: string, issue: unknown): void {
  if (warnedEvents.has(key)) return
  warnedEvents.add(key)
  console.warn(message, issue)
}

/** Validate an AG-UI CUSTOM value against the backend contract. */
export function validateCustomEvent(
  name: string,
  payload: unknown,
): Record<string, unknown> {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  const schema = (customEventSchemas as Record<string, z.ZodType | undefined>)[name]
  if (!schema) return raw
  const result = schema.safeParse(raw)
  if (result.success) return result.data as Record<string, unknown>
  warnOnce(`custom:${name}`, `[ag-ui] '${name}' CUSTOM event failed schema validation`, result.error.issues)
  return raw
}
