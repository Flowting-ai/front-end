import { parseAguiEvent, type AguiEvent } from "@/lib/agui/schemas"
import {
  createAguiToAppEvent,
  type AppStreamEvent,
} from "@/lib/agui/to-app-event"

export interface DecodedSSEEvent {
  event: AguiEvent
  appEvent: AppStreamEvent | null
  raw: Record<string, unknown>
}

const stripProtocolSpace = (value: string): string =>
  value.startsWith(" ") ? value.slice(1) : value

const warnedFrames = new Set<string>()

function warnFrameOnce(kind: string, message: string, detail: unknown): void {
  if (warnedFrames.has(kind)) return
  warnedFrames.add(kind)
  console.warn(message, detail)
}

/** Incrementally decode one AG-UI SSE response. */
export class AguiSSEDecoder {
  private buffer = ""
  private readonly toAppEvent = createAguiToAppEvent()

  push(text: string): DecodedSSEEvent[] {
    this.buffer += text
    const events: DecodedSSEEvent[] = []
    const boundary = /(?:\r\n)(?:\r\n|\r|\n)|\n(?:\r\n|\r|\n)|\r(?:\r\n|\r)/
    let match: RegExpExecArray | null
    while ((match = boundary.exec(this.buffer)) !== null) {
      const block = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const decoded = this.decodeBlock(block)
      if (decoded) events.push(decoded)
    }
    return events
  }

  flush(): DecodedSSEEvent[] {
    const block = this.buffer
    this.buffer = ""
    const decoded = this.decodeBlock(block)
    return decoded ? [decoded] : []
  }

  private decodeBlock(block: string): DecodedSSEEvent | null {
    if (!block.trim()) return null

    const dataLines: string[] = []
    for (const line of block.split(/\r\n|\r|\n/)) {
      if (line.startsWith("data:")) {
        dataLines.push(stripProtocolSpace(line.slice(5)))
      }
    }
    if (dataLines.length === 0) return null

    let raw: unknown
    try {
      raw = JSON.parse(dataLines.join("\n"))
    } catch (error) {
      warnFrameOnce("invalid-json", "[ag-ui] Dropped an SSE frame with invalid JSON", error)
      return null
    }

    const event = parseAguiEvent(raw)
    if (!event) {
      warnFrameOnce("invalid-event", "[ag-ui] Dropped an SSE frame outside the supported event schema", raw)
      return null
    }
    return {
      event,
      appEvent: this.toAppEvent(event),
      raw: raw as Record<string, unknown>,
    }
  }
}
