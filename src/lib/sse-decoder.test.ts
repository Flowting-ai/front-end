import { describe, expect, it } from "vitest"

import { HybridSSEDecoder, internalToInline } from "@/lib/sse-decoder"

describe("HybridSSEDecoder", () => {
  it("decodes named application events and AG-UI events on the same stream", () => {
    const decoder = new HybridSSEDecoder()
    const events = decoder.push(
      'event: message_saved\r\ndata: {"message_id":"m1"}\r\n\r\n' +
      'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"hi"}\n\n',
    )

    expect(events[0]).toEqual({
      kind: "named",
      name: "message_saved",
      data: { message_id: "m1" },
    })
    expect(events[1]?.kind).toBe("agui")
    if (events[1]?.kind === "agui") {
      expect(events[1].internal).toEqual({ eventName: "chunk", parsed: { delta: "hi" } })
    }
  })

  it("decodes the legacy inline wire (backends not yet on AG-UI) as 'inline', not 'agui'", () => {
    // Reproduces a real production payload: named title/model_selected
    // events, unnamed legacy `data:` frames carrying `{"type":"content",...}`
    // and `{"type":"done",...}` — the exact shape a backend sends when it
    // hasn't been upgraded to the AG-UI protocol yet.
    const decoder = new HybridSSEDecoder()
    const events = decoder.push(
      'event: title\r\ndata: {"title":"Why Question"}\r\n\r\n' +
      'event: model_selected\r\ndata: {"model_id":"m1","model_name":"Claude"}\r\n\r\n' +
      'data: {"type": "content", "content": "I\'m"}\r\n\r\n' +
      'data: {"type": "content", "content": " here"}\r\n\r\n' +
      'data: {"type": "done", "finish_reason": "stop"}\r\n\r\n' +
      'event: message_saved\r\ndata: {"message_id":"m2"}\r\n\r\n',
    )

    expect(events[0]).toEqual({ kind: "named", name: "title", data: { title: "Why Question" } })
    expect(events[1]?.kind).toBe("named")
    expect(events[1]).toMatchObject({ kind: "named", name: "model_selected" })

    expect(events[2]).toEqual({
      kind: "inline",
      name: "content",
      data: { type: "content", content: "I'm" },
    })
    expect(events[3]).toEqual({
      kind: "inline",
      name: "content",
      data: { type: "content", content: " here" },
    })
    expect(events[4]).toEqual({
      kind: "inline",
      name: "done",
      data: expect.objectContaining({ type: "done", finish_reason: "stop" }),
    })
    expect(events[5]).toEqual({ kind: "named", name: "message_saved", data: { message_id: "m2" } })
  })

  it("retains partial frames and flushes an unterminated final frame", () => {
    const decoder = new HybridSSEDecoder()
    expect(decoder.push('event: questions\ndata: {"prompt_id":"p1",')).toEqual([])
    expect(decoder.push('"respond_url":"/p","questions":[]}')).toEqual([])
    expect(decoder.flush()).toEqual([{
      kind: "named",
      name: "questions",
      data: {
        prompt_id: "p1",
        respond_url: "/p",
        expires_at: "",
        title: "",
        description: "",
        questions: [],
      },
    }])
  })

  it("correlates the native AG-UI tool lifecycle by tool call id", () => {
    const decoder = new HybridSSEDecoder()
    const events = decoder.push(
      'data: {"type":"TOOL_CALL_START","toolCallId":"c1","toolCallName":"web_search"}\n\n' +
      'data: {"type":"TOOL_CALL_END","toolCallId":"c1"}\n\n' +
      'data: {"type":"TOOL_CALL_RESULT","messageId":"m1","toolCallId":"c1","content":"ok"}\n\n',
    )
    const normalized = events.flatMap((event) =>
      event.kind === "agui" && event.internal ? [internalToInline(event.internal)] : [],
    )

    expect(normalized).toEqual([
      {
        type: "tool_calls_streaming",
        content: "web_search",
        tool_call: { name: "web_search", tool_call_id: "c1" },
      },
      {
        type: "tool_executing",
        content: "web_search",
        tool_call: { id: "c1", name: "web_search", tool_call_id: "c1" },
      },
      {
        type: "tool_complete",
        content: "web_search",
        tool_call: {
          id: "c1",
          name: "web_search",
          tool_call_id: "c1",
          result: "ok",
        },
      },
    ])
  })

  it("accepts the complete backend AG-UI vocabulary", () => {
    const fixtures = [
      { type: "TEXT_MESSAGE_CHUNK", delta: "x" },
      { type: "TOOL_CALL_CHUNK", toolCallId: "c", toolCallName: "tool", delta: "{}" },
      { type: "STATE_SNAPSHOT", snapshot: {} },
      { type: "STATE_DELTA", delta: [] },
      { type: "MESSAGES_SNAPSHOT", messages: [] },
      { type: "ACTIVITY_SNAPSHOT", messageId: "m", activityType: "x", content: {} },
      { type: "ACTIVITY_DELTA", messageId: "m", activityType: "x", patch: [] },
      { type: "RAW", event: {} },
      { type: "REASONING_MESSAGE_CHUNK", delta: "r" },
      { type: "REASONING_ENCRYPTED_VALUE", subtype: "message", entityId: "m", encryptedValue: "x" },
    ]

    for (const fixture of fixtures) {
      const decoder = new HybridSSEDecoder()
      const [event] = decoder.push(`data: ${JSON.stringify(fixture)}\n\n`)
      expect(event?.kind, fixture.type).toBe("agui")
    }
  })
})
