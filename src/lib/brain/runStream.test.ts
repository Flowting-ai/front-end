import { describe, expect, it, vi } from "vitest"

import { createBrainRunDispatcher, stepIdOf } from "./runStream"
import type { BrainSSECallbacks } from "../api/brain"

function harness() {
  const named: Array<{ name: string; data: Record<string, unknown> }> = []
  const inline: Array<Record<string, unknown>> = []
  const runStarted: Array<[string, string]> = []
  const callbacks: BrainSSECallbacks = {
    onNamed: (name, data) => named.push({ name, data: data as Record<string, unknown> }),
    onInline: (data) => inline.push(data as Record<string, unknown>),
    onRunStarted: (threadId, runId) => runStarted.push([threadId, runId]),
  }
  return { named, inline, runStarted, callbacks, dispatch: createBrainRunDispatcher() }
}

describe("stepIdOf", () => {
  it("extracts the step id prefix", () => {
    expect(stepIdOf("s1:text:2")).toBe("s1")
    expect(stepIdOf("synthesis:reasoning:1")).toBe("synthesis")
    expect(stepIdOf("plain-uuid")).toBeNull()
  })
})

describe("createBrainRunDispatcher", () => {
  it("maps RUN_STARTED to onRunStarted + run_started", () => {
    const h = harness()
    const handled = h.dispatch({ type: "RUN_STARTED", threadId: "t1", runId: "p1", seq: 1 }, h.callbacks)
    expect(handled).toBe(true)
    expect(h.runStarted).toEqual([["t1", "p1"]])
    expect(h.named).toEqual([{ name: "run_started", data: { plan_id: "p1", seq: 1 } }])
  })

  it("brackets a step and attributes content by the open step", () => {
    const h = harness()
    h.dispatch({ type: "STEP_STARTED", stepName: "s1", seq: 2 }, h.callbacks)
    h.dispatch({ type: "TEXT_MESSAGE_CONTENT", messageId: "s1:text:1", delta: "hello", seq: 3 }, h.callbacks)
    h.dispatch({ type: "STEP_FINISHED", stepName: "s1", seq: 4 }, h.callbacks)

    expect(h.named.map((n) => n.name)).toEqual(["step_started", "step_content", "step_completed"])
    expect(h.named[1].data).toEqual({ step_id: "s1", content: "hello", seq: 3 })
  })

  it("prefers the messageId prefix over the open bracket for attribution", () => {
    const h = harness()
    h.dispatch({ type: "STEP_STARTED", stepName: "s2", seq: 1 }, h.callbacks)
    // A late frame tagged for s1 still attributes to s1, not the open s2.
    h.dispatch({ type: "TEXT_MESSAGE_CONTENT", messageId: "s1:text:9", delta: "x", seq: 2 }, h.callbacks)
    expect(h.named[1].data.step_id).toBe("s1")
  })

  it("falls back to the open step when the id has no prefix", () => {
    const h = harness()
    h.dispatch({ type: "STEP_STARTED", stepName: "s3", seq: 1 }, h.callbacks)
    h.dispatch({ type: "TEXT_MESSAGE_CONTENT", messageId: "bareid", delta: "y", seq: 2 }, h.callbacks)
    expect(h.named[1].data.step_id).toBe("s3")
  })

  it("routes node reasoning to the shared live-reasoning UI", () => {
    const h = harness()
    h.dispatch({ type: "REASONING_MESSAGE_CONTENT", messageId: "s1:reasoning:1", delta: "thinking", seq: 5 }, h.callbacks)
    expect(h.inline).toEqual([{ type: "reasoning", content: "thinking", seq: 5 }])
  })

  it("opens a tool call from TOOL_CALL_START/ARGS stamped with the open step", () => {
    const h = harness()
    h.dispatch({ type: "STEP_STARTED", stepName: "s1", seq: 1 }, h.callbacks)
    h.dispatch({ type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "web_search", seq: 2 }, h.callbacks)
    h.dispatch({ type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: '{"q":1}', seq: 3 }, h.callbacks)

    expect(h.inline[0]).toMatchObject({
      type: "tool_calls_streaming",
      tool_call: { name: "web_search", tool_call_id: "c1", step_id: "s1" },
    })
    expect(h.inline[1].tool_call).toMatchObject({ tool_call_id: "c1", args_delta: '{"q":1}', step_id: "s1" })
  })

  it("routes a CUSTOM sidecar carrying its own type to onInline", () => {
    const h = harness()
    h.dispatch({
      type: "CUSTOM",
      name: "tool_complete",
      value: { type: "tool_complete", step_id: "s1", tool_call: { name: "web_search", result: "ok" } },
      seq: 7,
    }, h.callbacks)
    expect(h.inline).toHaveLength(1)
    expect(h.inline[0]).toMatchObject({ type: "tool_complete", step_id: "s1", seq: 7 })
    expect(h.named).toHaveLength(0)
  })

  it("routes a named CUSTOM sidecar to onNamed", () => {
    const h = harness()
    h.dispatch({ type: "CUSTOM", name: "step_failed", value: { step_id: "s1", error: "boom" }, seq: 8 }, h.callbacks)
    expect(h.named).toEqual([{ name: "step_failed", data: { step_id: "s1", error: "boom", seq: 8 } }])
    expect(h.inline).toHaveLength(0)
  })

  it("maps RUN_FINISHED to run_completed", () => {
    const h = harness()
    h.dispatch({ type: "RUN_FINISHED", threadId: "t1", runId: "p1", seq: 9 }, h.callbacks)
    expect(h.named).toEqual([{ name: "run_completed", data: { plan_id: "p1", seq: 9 } }])
  })

  it("treats a cancelled RUN_FINISHED as a no-op (sidecar already fired)", () => {
    const h = harness()
    const handled = h.dispatch({
      type: "RUN_FINISHED", threadId: "t1", runId: "p1", result: { cancelled: true }, seq: 9,
    }, h.callbacks)
    expect(handled).toBe(true)
    expect(h.named).toHaveLength(0)
    expect(h.inline).toHaveLength(0)
  })

  it("maps RUN_ERROR to run_failed", () => {
    const h = harness()
    h.dispatch({ type: "RUN_ERROR", message: "provider died", code: "run_failed", seq: 4 }, h.callbacks)
    expect(h.named).toEqual([{ name: "run_failed", data: { error: "provider died", seq: 4 } }])
  })

  it("treats lifecycle boundary frames as handled no-ops", () => {
    const h = harness()
    for (const type of ["TEXT_MESSAGE_START", "TEXT_MESSAGE_END", "REASONING_START", "TOOL_CALL_END"]) {
      expect(h.dispatch({ type, messageId: "m", toolCallId: "c", stepName: "s" }, h.callbacks)).toBe(true)
    }
    expect(h.named).toHaveLength(0)
    expect(h.inline).toHaveLength(0)
  })

  it("returns false for unknown frames so the caller can fall back", () => {
    const h = harness()
    expect(h.dispatch({ type: "SOMETHING_NEW" }, h.callbacks)).toBe(false)
  })

  it("clears the open step only when the matching bracket closes", () => {
    const h = harness()
    const onNamed = vi.fn()
    const cbs: BrainSSECallbacks = { onNamed, onInline: vi.fn() }
    const dispatch = createBrainRunDispatcher()
    dispatch({ type: "STEP_STARTED", stepName: "s1", seq: 1 }, cbs)
    dispatch({ type: "STEP_FINISHED", stepName: "s2", seq: 2 }, cbs) // different step
    // s1 still open → content attributes to s1
    dispatch({ type: "TEXT_MESSAGE_CONTENT", messageId: "bare", delta: "z", seq: 3 }, cbs)
    expect(onNamed).toHaveBeenLastCalledWith("step_content", { step_id: "s1", content: "z", seq: 3 })
  })
})
