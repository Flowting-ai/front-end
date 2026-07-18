import { parseAguiEvent } from "../agui/schemas"
import type { BrainSSECallbacks } from "../api/brain"

// ── Brain run-stream dispatcher ───────────────────────────────────────────────
// The detached cortex run streams NATIVE AG-UI events (unlike the planner turn,
// which is legacy-translated). This object decodes each frame with the shared
// Zod schema and maps it onto the run-view's existing (onNamed/onInline)
// contract, so the battle-tested handler switch in page.tsx is untouched.
//
// It is stateful for exactly one thing: the current step. Cortex runs nodes
// sequentially and brackets each with STEP_STARTED/STEP_FINISHED, so any text /
// reasoning / tool frame between the brackets belongs to that node. Node
// message ids are `<stepId>:text:N` / `<stepId>:reasoning:N`, so attribution
// prefers the id prefix and falls back to the open bracket.
//
// Instantiate one per stream (`createBrainRunDispatcher()`); it holds no React
// state and is fully unit-testable.

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : { value }

/** Node id embedded in a `<stepId>:text:N` message/tool id, or null. */
export function stepIdOf(id: string): string | null {
  const idx = id.indexOf(":")
  return idx > 0 ? id.slice(0, idx) : null
}

export type BrainRunDispatcher = (
  data: Record<string, unknown>,
  callbacks: BrainSSECallbacks,
) => boolean

export function createBrainRunDispatcher(): BrainRunDispatcher {
  let currentStep: string | null = null

  return (data, callbacks): boolean => {
    const event = parseAguiEvent(data)
    if (!event) return false
    // Every run row carries a monotonic `seq`; thread it through so the run
    // view's reconnect dedup (activeRunSeqRef) keeps working on replay.
    const seq = data.seq

    switch (event.type) {
      case "RUN_STARTED":
        callbacks.onRunStarted?.(event.threadId, event.runId)
        callbacks.onNamed("run_started", { plan_id: event.runId, seq })
        return true

      case "STEP_STARTED":
        currentStep = event.stepName
        callbacks.onNamed("step_started", { step_id: event.stepName, seq })
        return true

      case "STEP_FINISHED":
        if (currentStep === event.stepName) currentStep = null
        callbacks.onNamed("step_completed", { step_id: event.stepName, seq })
        return true

      case "TEXT_MESSAGE_CONTENT": {
        const step = stepIdOf(event.messageId) ?? currentStep
        callbacks.onNamed("step_content", { step_id: step, content: event.delta, seq })
        return true
      }

      case "REASONING_MESSAGE_CONTENT":
        // Node thinking rides the shared live-reasoning UI, same as chat.
        callbacks.onInline({ type: "reasoning", content: event.delta, seq })
        return true

      case "TOOL_CALL_START":
        callbacks.onInline({
          type: "tool_calls_streaming",
          content: event.toolCallName,
          tool_call: {
            name: event.toolCallName,
            tool_call_id: event.toolCallId,
            step_id: currentStep,
          },
          seq,
        })
        return true

      case "TOOL_CALL_ARGS":
        callbacks.onInline({
          type: "tool_calls_streaming",
          content: "",
          tool_call: { tool_call_id: event.toolCallId, args_delta: event.delta, step_id: currentStep },
          seq,
        })
        return true

      case "CUSTOM": {
        // Souvenir sidecars: tool_executing / tool_complete / tool_error /
        // reasoning_heading / reasoning_body carry their own `type` (→ inline);
        // run_queued / run_summarizing / run_cancelled / step_failed /
        // step_skipped / external_output / message_saved are named events.
        const value = asRecord(event.value)
        if (typeof value.seq === "undefined" && typeof seq !== "undefined") value.seq = seq
        if (value.type === event.name) callbacks.onInline(value)
        else callbacks.onNamed(event.name, value)
        return true
      }

      case "RUN_FINISHED": {
        // A cancelled run already emitted its run_cancelled sidecar; the
        // protocol terminal is then a no-op for the view.
        const result = asRecord(event.result)
        if (result.cancelled) return true
        callbacks.onNamed("run_completed", { plan_id: event.runId, seq })
        return true
      }

      case "RUN_ERROR":
        callbacks.onNamed("run_failed", { error: event.message, seq })
        return true

      // Lifecycle boundaries with no view meaning of their own — the content,
      // sidecar, and terminal frames above carry everything the UI renders.
      case "TEXT_MESSAGE_START":
      case "TEXT_MESSAGE_END":
      case "REASONING_START":
      case "REASONING_MESSAGE_START":
      case "REASONING_MESSAGE_END":
      case "REASONING_END":
      case "TOOL_CALL_END":
      case "TOOL_CALL_RESULT":
      case "THINKING_START":
      case "THINKING_TEXT_MESSAGE_START":
      case "THINKING_TEXT_MESSAGE_CONTENT":
      case "THINKING_TEXT_MESSAGE_END":
      case "THINKING_END":
        return true
    }
  }
}
