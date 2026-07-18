import type { AguiEvent } from "./schemas"

// ── AG-UI → internal event adapter ────────────────────────────────────────────
// use-streaming-chat's state machine consumes (eventName, parsed) pairs whose
// shapes predate AG-UI. This adapter maps each AG-UI event onto that internal
// contract so the entire rendering/state layer (activities, reasoning
// sections, prompts — and their animations) is untouched by the protocol swap.
//
// Souvenir-specific metadata arrives as CUSTOM events whose `name`/`value` are
// exactly the legacy event name/payload (tool_executing, tool_complete,
// reasoning_heading, message_saved, …), so CUSTOM dispatches directly.
//
// Returns null for lifecycle events with no UI meaning of their own
// (TEXT_MESSAGE_START/END, TOOL_CALL_ARGS deltas, THINKING boundaries — the
// content and meta events carry everything the UI renders).

export interface InternalEvent {
  eventName: string
  parsed: Record<string, unknown>
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : { value }

export function aguiToInternal(event: AguiEvent): InternalEvent | null {
  switch (event.type) {
    case "TEXT_MESSAGE_CONTENT":
      return { eventName: "chunk", parsed: { delta: event.delta } }

    case "THINKING_TEXT_MESSAGE_CONTENT":
      return { eventName: "reasoning", parsed: { delta: event.delta } }

    case "TOOL_CALL_START":
      // Model started streaming a tool call — early activity indicator.
      return {
        eventName: "tool_calls_streaming",
        parsed: {
          content: event.toolCallName,
          tool_call: { name: event.toolCallName, tool_call_id: event.toolCallId },
        },
      }

    case "CUSTOM":
      return { eventName: event.name, parsed: asRecord(event.value) }

    case "RUN_ERROR":
      return { eventName: "error", parsed: { error: event.message } }

    case "RUN_FINISHED": {
      const result = asRecord(event.result)
      return {
        eventName: "done",
        parsed: { finish_reason: "stop", usage: result.usage },
      }
    }

    case "RUN_STARTED":
    case "TEXT_MESSAGE_START":
    case "TEXT_MESSAGE_END":
    // Run lifecycle — only the native run stream emits these (see
    // lib/brain/runStream.ts); the chat path never sees them.
    case "STEP_STARTED":
    case "STEP_FINISHED":
    case "REASONING_START":
    case "REASONING_MESSAGE_START":
    case "REASONING_MESSAGE_CONTENT":
    case "REASONING_MESSAGE_END":
    case "REASONING_END":
    case "THINKING_START":
    case "THINKING_TEXT_MESSAGE_START":
    case "THINKING_TEXT_MESSAGE_END":
    case "THINKING_END":
    case "TOOL_CALL_ARGS":
    case "TOOL_CALL_END":
    case "TOOL_CALL_RESULT":
      return null
  }
}
