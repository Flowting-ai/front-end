import { describe, expect, it } from "vitest"

import { parseAguiEvent } from "./schemas"
import { aguiToInternal } from "./to-legacy"

const decode = (data: unknown) => {
  const event = parseAguiEvent(data)
  return event ? aguiToInternal(event) : null
}

describe("parseAguiEvent", () => {
  it("accepts known events and passes unknown fields through", () => {
    const event = parseAguiEvent({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "m1",
      delta: "hi",
      timestamp: 123,
    })
    expect(event).not.toBeNull()
    expect(event?.type).toBe("TEXT_MESSAGE_CONTENT")
  })

  it("returns null for unknown event types and malformed payloads", () => {
    expect(parseAguiEvent({ type: "SOMETHING_NEW" })).toBeNull()
    expect(parseAguiEvent({ type: "TOOL_CALL_START" })).toBeNull() // missing ids
    expect(parseAguiEvent("not an object")).toBeNull()
    expect(parseAguiEvent(null)).toBeNull()
  })
})

describe("aguiToInternal", () => {
  it("maps text deltas to chunk events", () => {
    expect(
      decode({ type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "Hello " }),
    ).toEqual({ eventName: "chunk", parsed: { delta: "Hello " } })
  })

  it("maps thinking deltas to reasoning events", () => {
    expect(
      decode({ type: "THINKING_TEXT_MESSAGE_CONTENT", delta: "hmm" }),
    ).toEqual({ eventName: "reasoning", parsed: { delta: "hmm" } })
  })

  it("maps tool call start to the preliminary activity event with the real id", () => {
    expect(
      decode({ type: "TOOL_CALL_START", toolCallId: "call-1", toolCallName: "web_search" }),
    ).toEqual({
      eventName: "tool_calls_streaming",
      parsed: {
        content: "web_search",
        tool_call: { name: "web_search", tool_call_id: "call-1" },
      },
    })
  })

  it("dispatches CUSTOM events to their legacy handlers by name", () => {
    const payload = {
      type: "tool_executing",
      content: "send_email",
      label: "Sending email",
      tool_call: { name: "send_email", tool_call_id: "call-2", arguments: { to: "x" } },
    }
    expect(decode({ type: "CUSTOM", name: "tool_executing", value: payload })).toEqual({
      eventName: "tool_executing",
      parsed: payload,
    })
    expect(
      decode({ type: "CUSTOM", name: "message_saved", value: { message_id: "m9" } }),
    ).toEqual({ eventName: "message_saved", parsed: { message_id: "m9" } })
    expect(
      decode({ type: "CUSTOM", name: "reasoning_heading", value: { content: "Plan" } }),
    ).toEqual({ eventName: "reasoning_heading", parsed: { content: "Plan" } })
  })

  it("maps run lifecycle to done/error events", () => {
    expect(
      decode({
        type: "RUN_FINISHED",
        threadId: "t",
        runId: "r",
        result: { usage: { total_tokens: 12 } },
      }),
    ).toEqual({
      eventName: "done",
      parsed: { finish_reason: "stop", usage: { total_tokens: 12 } },
    })
    expect(decode({ type: "RUN_ERROR", message: "boom" })).toEqual({
      eventName: "error",
      parsed: { error: "boom" },
    })
  })

  it("returns null for lifecycle-only events", () => {
    expect(decode({ type: "RUN_STARTED", threadId: "t", runId: "r" })).toBeNull()
    expect(decode({ type: "TEXT_MESSAGE_START", messageId: "m1" })).toBeNull()
    expect(decode({ type: "TEXT_MESSAGE_END", messageId: "m1" })).toBeNull()
    expect(decode({ type: "TOOL_CALL_ARGS", toolCallId: "c", delta: "{" })).toBeNull()
    expect(decode({ type: "TOOL_CALL_END", toolCallId: "c" })).toBeNull()
    expect(
      decode({ type: "TOOL_CALL_RESULT", messageId: "m", toolCallId: "c", content: "ok" }),
    ).toBeNull()
    expect(decode({ type: "THINKING_START" })).toBeNull()
    expect(decode({ type: "THINKING_END" })).toBeNull()
  })

  it("wraps non-object CUSTOM values so handlers always get a record", () => {
    expect(decode({ type: "CUSTOM", name: "weird", value: 42 })).toEqual({
      eventName: "weird",
      parsed: { value: 42 },
    })
  })
})
