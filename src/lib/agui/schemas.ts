import { z } from "zod"

// ── AG-UI wire events ─────────────────────────────────────────────────────────
// The backend streams AG-UI protocol events (ag-ui.com) when the request opts
// in via ?protocol=agui. Field names are camelCase on the wire (the ag_ui
// encoder serialises by alias). Schemas are loose: unknown fields pass through
// so protocol additions never break parsing.

export const aguiEventSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("RUN_STARTED"),
    threadId: z.string(),
    runId: z.string(),
  }),
  z.looseObject({
    type: z.literal("RUN_FINISHED"),
    threadId: z.string(),
    runId: z.string(),
    result: z.unknown().optional(),
  }),
  z.looseObject({
    type: z.literal("RUN_ERROR"),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.looseObject({ type: z.literal("TEXT_MESSAGE_START"), messageId: z.string() }),
  z.looseObject({
    type: z.literal("TEXT_MESSAGE_CONTENT"),
    messageId: z.string(),
    delta: z.string(),
  }),
  z.looseObject({ type: z.literal("TEXT_MESSAGE_END"), messageId: z.string() }),
  z.looseObject({
    type: z.literal("TEXT_MESSAGE_CHUNK"),
    messageId: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    delta: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  }),
  // Run lifecycle — the detached cortex run brackets each node's stream with a
  // STEP_STARTED/STEP_FINISHED pair (stepName = node id) and streams node
  // reasoning as the standard REASONING_* lifecycle.
  z.looseObject({ type: z.literal("STEP_STARTED"), stepName: z.string() }),
  z.looseObject({ type: z.literal("STEP_FINISHED"), stepName: z.string() }),
  z.looseObject({ type: z.literal("REASONING_START"), messageId: z.string() }),
  z.looseObject({
    type: z.literal("REASONING_MESSAGE_START"),
    messageId: z.string(),
    role: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("REASONING_MESSAGE_CONTENT"),
    messageId: z.string(),
    delta: z.string(),
  }),
  z.looseObject({ type: z.literal("REASONING_MESSAGE_END"), messageId: z.string() }),
  z.looseObject({
    type: z.literal("REASONING_MESSAGE_CHUNK"),
    messageId: z.string().nullable().optional(),
    delta: z.string().nullable().optional(),
  }),
  z.looseObject({ type: z.literal("REASONING_END"), messageId: z.string() }),
  z.looseObject({
    type: z.literal("REASONING_ENCRYPTED_VALUE"),
    subtype: z.enum(["tool-call", "message"]),
    entityId: z.string(),
    encryptedValue: z.string(),
  }),
  z.looseObject({ type: z.literal("THINKING_START"), title: z.string().optional() }),
  z.looseObject({ type: z.literal("THINKING_TEXT_MESSAGE_START") }),
  z.looseObject({
    type: z.literal("THINKING_TEXT_MESSAGE_CONTENT"),
    delta: z.string(),
  }),
  z.looseObject({ type: z.literal("THINKING_TEXT_MESSAGE_END") }),
  z.looseObject({ type: z.literal("THINKING_END") }),
  z.looseObject({
    type: z.literal("TOOL_CALL_START"),
    toolCallId: z.string(),
    toolCallName: z.string(),
  }),
  z.looseObject({
    type: z.literal("TOOL_CALL_ARGS"),
    toolCallId: z.string(),
    delta: z.string(),
  }),
  z.looseObject({ type: z.literal("TOOL_CALL_END"), toolCallId: z.string() }),
  z.looseObject({
    type: z.literal("TOOL_CALL_CHUNK"),
    toolCallId: z.string().nullable().optional(),
    toolCallName: z.string().nullable().optional(),
    parentMessageId: z.string().nullable().optional(),
    delta: z.string().nullable().optional(),
  }),
  z.looseObject({
    type: z.literal("TOOL_CALL_RESULT"),
    messageId: z.string(),
    toolCallId: z.string(),
    content: z.string(),
  }),
  z.looseObject({
    type: z.literal("CUSTOM"),
    name: z.string(),
    value: z.unknown(),
  }),
  z.looseObject({ type: z.literal("STATE_SNAPSHOT"), snapshot: z.unknown() }),
  z.looseObject({ type: z.literal("STATE_DELTA"), delta: z.array(z.unknown()) }),
  z.looseObject({ type: z.literal("MESSAGES_SNAPSHOT"), messages: z.array(z.unknown()) }),
  z.looseObject({
    type: z.literal("ACTIVITY_SNAPSHOT"),
    messageId: z.string(),
    activityType: z.string(),
    content: z.unknown(),
    replace: z.boolean().optional(),
  }),
  z.looseObject({
    type: z.literal("ACTIVITY_DELTA"),
    messageId: z.string(),
    activityType: z.string(),
    patch: z.array(z.unknown()),
  }),
  z.looseObject({
    type: z.literal("RAW"),
    event: z.unknown(),
    source: z.string().nullable().optional(),
  }),
])

export type AguiEvent = z.infer<typeof aguiEventSchema>

/** Parse one SSE `data:` payload into a typed AG-UI event.
 *  Returns null for events this client doesn't know (never throws). */
export function parseAguiEvent(data: unknown): AguiEvent | null {
  const result = aguiEventSchema.safeParse(data)
  return result.success ? result.data : null
}
