import { z } from "zod"

// ── Souvenir AG-UI CUSTOM vocabulary ─────────────────────────────────────────
// Standard lifecycle, text, tool, and activity frames are validated by
// lib/agui/schemas.ts. These schemas cover only product-specific CUSTOM values.
// Prompt cards have their own schemas in lib/api/prompts.ts.

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
  // The catalog model a turn actually runs on. A Souvenir tier is routed to a
  // real model, so this is the only way the chat learns which one answered.
  model_selected: z.looseObject({
    model_id: z.string(),
    model_name: z.string(),
    deployment_name: z.string(),
    company: z.string(),
  }),
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
  // Opens every read of a turn's stream with when the run started, and closes it with when it ended (UTC, ISO 8601).
  run: z.looseObject({ id: z.string(), startedAt: z.string(), endedAt: z.string().optional() }),
  stream_heartbeat: z.looseObject({ elapsed_seconds: z.number().optional() }),
  // The turn's whole to-do list, sent in full on every write_todos.
  plan_updated: z.looseObject({
    items: z.array(z.looseObject({
      id:     z.string(),
      title:  z.string(),
      status: z.enum(["pending", "in_progress", "completed", "failed"]),
    })),
  }),
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
