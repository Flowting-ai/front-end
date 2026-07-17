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
])

export type AguiEvent = z.infer<typeof aguiEventSchema>

/** Parse one SSE `data:` payload into a typed AG-UI event.
 *  Returns null for events this client doesn't know (never throws). */
export function parseAguiEvent(data: unknown): AguiEvent | null {
  const result = aguiEventSchema.safeParse(data)
  return result.success ? result.data : null
}
