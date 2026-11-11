import { describe, expect, it } from "vitest"
import { readAguiStream } from "@/lib/agui-stream"
import type { DecodedSSEEvent } from "@/lib/sse-decoder"

/** A body that delivers `parts` as separate chunks, so events split across reads are exercised. */
function body(...parts: string[]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(bytes.encode(part))
      controller.close()
    },
  })
}

const names = (events: DecodedSSEEvent[]) => events.map((event) => event.appEvent?.eventName)

describe("readAguiStream", () => {
  it("decodes events in order, including one split across chunks", async () => {
    const events: DecodedSSEEvent[] = []
    await readAguiStream(
      body('data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","del', 'ta":"hi"}\n\n', 'data: {"type":"CUSTOM","name":"message_saved","value":{}}\n\n'),
      (event) => events.push(event),
    )
    expect(names(events)).toEqual(["content", "message_saved"])
  })

  it("flushes a last event that has no blank line after it", async () => {
    const events: DecodedSSEEvent[] = []
    await readAguiStream(body('data: {"type":"CUSTOM","name":"message_saved","value":{}}'), (event) => events.push(event))
    expect(names(events)).toEqual(["message_saved"])
  })

  it("keeps a multi-byte character split across chunks intact", async () => {
    const encoded = new TextEncoder().encode('data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"é"}\n\n')
    const cut = encoded.indexOf(0xc3) + 1
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, cut))
        controller.enqueue(encoded.slice(cut))
        controller.close()
      },
    })
    const events: DecodedSSEEvent[] = []
    await readAguiStream(stream, (event) => events.push(event))
    expect(events[0]?.appEvent?.parsed).toEqual({ content: "é" })
  })

  it("stops and rethrows when the handler throws", async () => {
    await expect(
      readAguiStream(body('data: {"type":"CUSTOM","name":"message_saved","value":{}}\n\n'), () => { throw new Error("boom") }),
    ).rejects.toThrow("boom")
  })
})
