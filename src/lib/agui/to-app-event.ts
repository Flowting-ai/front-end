import type { AguiEvent } from "./schemas"
import { validateCustomEvent } from "@/lib/api/sse-schemas"

export interface AppStreamEvent {
  eventName: string
  parsed: Record<string, unknown>
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : { value }

export function aguiToAppEvent(event: AguiEvent): AppStreamEvent | null {
  switch (event.type) {
    case "TEXT_MESSAGE_CONTENT":
      return { eventName: "content", parsed: { content: event.delta } }

    case "TEXT_MESSAGE_CHUNK":
      return event.delta
        ? { eventName: "content", parsed: { content: event.delta } }
        : null

    case "TOOL_CALL_START":
      return {
        eventName: "tool_calls_streaming",
        parsed: {
          content: event.toolCallName,
          tool_call: {
            id: event.toolCallId,
            name: event.toolCallName,
            tool_call_id: event.toolCallId,
          },
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
      return {
        eventName: event.name,
        parsed: validateCustomEvent(event.name, asRecord(event.value)),
      }

    case "RUN_ERROR":
      return { eventName: "error", parsed: { error: event.message } }

    case "RUN_FINISHED": {
      const result = asRecord(event.result)
      return {
        eventName: "done",
        parsed: {
          finish_reason: result.finishReason ?? "stop",
          usage: result.usage,
        },
      }
    }

    case "RUN_STARTED":
    case "TEXT_MESSAGE_START":
    case "TEXT_MESSAGE_END":
    case "STEP_STARTED":
    case "STEP_FINISHED":
    case "REASONING_START":
    case "REASONING_MESSAGE_START":
    case "REASONING_MESSAGE_CONTENT":
    case "REASONING_MESSAGE_END":
    case "REASONING_MESSAGE_CHUNK":
    case "REASONING_END":
    case "REASONING_ENCRYPTED_VALUE":
    case "THINKING_START":
    case "THINKING_TEXT_MESSAGE_START":
    case "THINKING_TEXT_MESSAGE_CONTENT":
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

/** Correlate AG-UI tool result ids with their names for the UI activity model. */
export function createAguiToAppEvent(): (event: AguiEvent) => AppStreamEvent | null {
  const toolNames = new Map<string, string>()
  const toolArguments = new Map<string, string>()

  return (event) => {
    if (event.type === "TOOL_CALL_START") {
      toolNames.set(event.toolCallId, event.toolCallName)
      toolArguments.set(event.toolCallId, "")
      return aguiToAppEvent(event)
    }

    if (event.type === "TOOL_CALL_CHUNK") {
      if (event.toolCallId && event.toolCallName) {
        toolNames.set(event.toolCallId, event.toolCallName)
      }
      if (event.toolCallId && event.delta) {
        toolArguments.set(
          event.toolCallId,
          `${toolArguments.get(event.toolCallId) ?? ""}${event.delta}`,
        )
      }
      const appEvent = aguiToAppEvent(event)
      const toolCall = appEvent?.parsed.tool_call
      if (!appEvent || !toolCall || typeof toolCall !== "object") return appEvent
      const toolCallId = event.toolCallId ?? undefined
      return {
        ...appEvent,
        parsed: {
          ...appEvent.parsed,
          tool_call: {
            ...(toolCall as Record<string, unknown>),
            id: toolCallId,
            arguments: toolCallId ? toolArguments.get(toolCallId) ?? "" : "",
          },
        },
      }
    }

    if (event.type === "TOOL_CALL_ARGS") {
      const argumentsText = `${toolArguments.get(event.toolCallId) ?? ""}${event.delta}`
      toolArguments.set(event.toolCallId, argumentsText)
      const toolName = toolNames.get(event.toolCallId) ?? "tool"
      return {
        eventName: "tool_calls_streaming",
        parsed: {
          content: toolName,
          tool_call: {
            id: event.toolCallId,
            name: toolName,
            tool_call_id: event.toolCallId,
            arguments: argumentsText,
          },
        },
      }
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
            arguments: toolArguments.get(event.toolCallId) ?? "",
          },
        },
      }
    }

    if (event.type === "TOOL_CALL_RESULT") {
      const toolName = toolNames.get(event.toolCallId) ?? "tool"
      const argumentsText = toolArguments.get(event.toolCallId) ?? ""
      toolNames.delete(event.toolCallId)
      toolArguments.delete(event.toolCallId)
      return {
        eventName: "tool_complete",
        parsed: {
          content: toolName,
          tool_call: {
            id: event.toolCallId,
            name: toolName,
            tool_call_id: event.toolCallId,
            arguments: argumentsText,
            result: event.content,
          },
        },
      }
    }

    if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
      toolNames.clear()
      toolArguments.clear()
    }
    return aguiToAppEvent(event)
  }
}
