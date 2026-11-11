import { AguiSSEDecoder, type DecodedSSEEvent } from "@/lib/sse-decoder"

/**
 * Reads an AG-UI SSE response body to the end, handing each decoded event to `onEvent` in order.
 * The fetch-based twin of the XHR reader in use-streaming-chat: both run every byte through the one
 * AguiSSEDecoder, so event mapping is shared. Decodes the trailing bytes and flushes a last event
 * without a blank line. Cancels the body on the way out, including when `onEvent` throws or the
 * request is aborted (the read then rejects with the AbortError for the caller to handle).
 */
export async function readAguiStream(body: ReadableStream<Uint8Array>, onEvent: (event: DecodedSSEEvent) => void): Promise<void> {
  const reader = body.getReader()
  const sse = new AguiSSEDecoder()
  const text = new TextDecoder()
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- an SSE stream is read in order
      const { done, value } = await reader.read()
      if (done) break
      sse.push(text.decode(value, { stream: true })).forEach(onEvent)
    }
    sse.push(text.decode()).forEach(onEvent)
    sse.flush().forEach(onEvent)
  } finally {
    reader.cancel().catch(() => {})
  }
}
