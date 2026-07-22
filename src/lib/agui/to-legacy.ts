import type { AguiEvent } from "./schemas"
import { validateEventByName } from "@/lib/api/sse-schemas"

// ── AG-UI → internal event adapter ────────────────────────────────────────────
// use-streaming-chat's state machine consumes (eventName, parsed) pairs whose
// shapes predate AG-UI. This adapter maps each AG-UI event onto that internal
// contract so the entire rendering/state layer (activities, reasoning
// sections, prompts — and their animations) is untouched by the protocol swap.
//
// Named Souvenir events are handled by the shared SSE decoder. CUSTOM remains
// supported for older AG-UI producers whose `name`/`value` contains one of the
// same application event payloads.
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

    case "TEXT_MESSAGE_CHUNK":
      return event.delta ? { eventName: "chunk", parsed: { delta: event.delta } } : null

    case "THINKING_TEXT_MESSAGE_CONTENT":
    case "REASONING_MESSAGE_CONTENT":
      return { eventName: "reasoning", parsed: { delta: event.delta } }

    case "REASONING_MESSAGE_CHUNK":
      return event.delta ? { eventName: "reasoning", parsed: { delta: event.delta } } : null

    case "TOOL_CALL_START":
      // Model started streaming a tool call — early activity indicator.
      return {
        eventName: "tool_calls_streaming",
        parsed: {
          content: event.toolCallName,
          tool_call: { name: event.toolCallName, tool_call_id: event.toolCallId },
        },
      }

    case "TOOL_CALL_CHUNK":
      return event.toolCallName
        ? {
            eventName: "tool_calls_streaming",
            parsed: {
              content: event.toolCallName,
              tool_call: {
                id: event.toolCallId ?? undefined,
                name: event.toolCallName,
                tool_call_id: event.toolCallId ?? undefined,
              },
            },
          }
        : null

    case "CUSTOM":
      return { eventName: event.name, parsed: validateEventByName(event.name, asRecord(event.value)) }

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
    case "REASONING_MESSAGE_END":
    case "REASONING_END":
    case "REASONING_ENCRYPTED_VALUE":
    case "THINKING_START":
    case "THINKING_TEXT_MESSAGE_START":
    case "THINKING_TEXT_MESSAGE_END":
    case "THINKING_END":
    case "TOOL_CALL_ARGS":
    case "TOOL_CALL_END":
    case "TOOL_CALL_RESULT":
    case "STATE_SNAPSHOT":
    case "STATE_DELTA":
    case "MESSAGES_SNAPSHOT":
    case "ACTIVITY_SNAPSHOT":
    case "ACTIVITY_DELTA":
    case "RAW":
      return null
  }
}

/**
 * Per-stream AG-UI adapter. Tool call names arrive on TOOL_CALL_START while
 * execution/result frames only carry the id, so normalizing those frames must
 * retain a tiny amount of stream-local state. Never share one adapter between
 * concurrent responses.
 */
export function createAguiToInternal(): (event: AguiEvent) => InternalEvent | null {
  const toolNames = new Map<string, string>()

  return (event) => {
    if (event.type === "TOOL_CALL_START") {
      toolNames.set(event.toolCallId, event.toolCallName)
      return aguiToInternal(event)
    }

    if (event.type === "TOOL_CALL_CHUNK") {
      if (event.toolCallId && event.toolCallName) {
        toolNames.set(event.toolCallId, event.toolCallName)
      }
      return aguiToInternal(event)
    }

    if (event.type === "TOOL_CALL_END") {
      const toolName = toolNames.get(event.toolCallId) ?? "tool"
      return {
        eventName: "tool_executing",
        parsed: {
          content: toolName,
          tool_call: {
            id: event.toolCallId,
            name: toolName,
            tool_call_id: event.toolCallId,
          },
        },
      }
    }

    if (event.type === "TOOL_CALL_RESULT") {
      const toolName = toolNames.get(event.toolCallId) ?? "tool"
      toolNames.delete(event.toolCallId)
      return {
        eventName: "tool_complete",
        parsed: {
          content: toolName,
          tool_call: {
            id: event.toolCallId,
            name: toolName,
            tool_call_id: event.toolCallId,
            result: event.content,
          },
        },
      }
    }

    if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
      toolNames.clear()
    }
    return aguiToInternal(event)
  }
}
