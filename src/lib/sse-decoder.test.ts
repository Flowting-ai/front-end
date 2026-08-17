import { describe, expect, it } from "vitest"

import { AguiSSEDecoder } from "@/lib/sse-decoder"

describe("AguiSSEDecoder", () => {
  it("decodes standard and CUSTOM AG-UI events on one stream", () => {
    const decoder = new AguiSSEDecoder()
    const events = decoder.push(
      'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"hi"}\n\n' +
      'data: {"type":"CUSTOM","name":"message_saved","value":{"message_id":"m1"}}\n\n',
    )

    expect(events[0]?.appEvent).toEqual({
      eventName: "content",
      parsed: { content: "hi" },
    })
    expect(events[1]?.appEvent).toEqual({
      eventName: "message_saved",
      parsed: { message_id: "m1" },
    })
  })

  it("does not accept named or inline legacy frames", () => {
    const decoder = new AguiSSEDecoder()
    const events = decoder.push(
      'event: title\ndata: {"title":"Old"}\n\n' +
      'data: {"type":"content","content":"Old"}\n\n',
    )
    expect(events).toEqual([])
  })

  it("keeps reasoning headings and bodies as two distinct CUSTOM events", () => {
    const decoder = new AguiSSEDecoder()
    const events = decoder.push(
      'data: {"type":"CUSTOM","name":"reasoning_heading","value":{"content":"Plan","round_index":2}}\n\n' +
      'data: {"type":"CUSTOM","name":"reasoning_body","value":{"content":"Checking","round_index":2}}\n\n',
    )
    expect(events.map((event) => event.appEvent)).toEqual([
      {
        eventName: "reasoning_heading",
        parsed: { content: "Plan", round_index: 2 },
      },
      {
        eventName: "reasoning_body",
        parsed: { content: "Checking", round_index: 2 },
      },
    ])
  })

  it("retains partial frames and flushes an unterminated final frame", () => {
    const decoder = new AguiSSEDecoder()
    expect(decoder.push('data: {"type":"CUSTOM","name":"question_prompt","value":{"prompt_id":"p1",')).toEqual([])
    expect(decoder.push('"respond_url":"/p","questions":[]}}')).toEqual([])
    expect(decoder.flush()[0]?.appEvent).toEqual({
      eventName: "question_prompt",
      parsed: {
        prompt_id: "p1",
        respond_url: "/p",
        expires_at: "",
        title: "",
        description: "",
        questions: [],
      },
    })
  })

  it("correlates the native AG-UI tool lifecycle by tool call id", () => {
    const decoder = new AguiSSEDecoder()
    const events = decoder.push(
      'data: {"type":"TOOL_CALL_START","toolCallId":"c1","toolCallName":"web_search"}\n\n' +
      'data: {"type":"TOOL_CALL_END","toolCallId":"c1"}\n\n' +
      'data: {"type":"TOOL_CALL_RESULT","messageId":"m1","toolCallId":"c1","content":"ok"}\n\n',
    )

    expect(events.map((event) => event.appEvent?.eventName)).toEqual([
      "tool_calls_streaming",
      "tool_executing",
      "tool_complete",
    ])
    expect(events[2]?.appEvent?.parsed.tool_call).toEqual({
      id: "c1",
      name: "web_search",
      tool_call_id: "c1",
      result: "ok",
    })
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
      const decoder = new AguiSSEDecoder()
      const [event] = decoder.push(`data: ${JSON.stringify(fixture)}\n\n`)
      expect(event?.event.type, fixture.type).toBe(fixture.type)
    }
  })
})
