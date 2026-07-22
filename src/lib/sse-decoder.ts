import { parseAguiEvent, type AguiEvent } from "@/lib/agui/schemas"
import {
  createAguiToInternal,
  type InternalEvent,
} from "@/lib/agui/to-legacy"
import {
  validateInlineEvent,
  validateNamedEvent,
} from "@/lib/api/sse-schemas"

export type DecodedSSEEvent =
  | { kind: "named"; name: string; data: Record<string, unknown> }
  | { kind: "inline"; name: string; data: Record<string, unknown> }
  | {
      kind: "agui"
      event: AguiEvent
      internal: InternalEvent | null
      raw: Record<string, unknown>
    }

const stripProtocolSpace = (value: string): string =>
  value.startsWith(" ") ? value.slice(1) : value

/**
 * Incremental decoder for Souvenir's hybrid SSE wire:
 * standard named application events plus unnamed AG-UI/legacy inline events.
 * One decoder belongs to one response stream because it owns both the partial
 * frame buffer and AG-UI tool-call correlation state.
 */
export class HybridSSEDecoder {
  private buffer = ""
  private readonly normalizeAgui = createAguiToInternal()

  push(text: string): DecodedSSEEvent[] {
    this.buffer += text
    const events: DecodedSSEEvent[] = []
    // Match two line terminators without letting the regex backtrack and
    // reinterpret a single CRLF as separate CR + LF terminators.
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

    let eventName = ""
    const dataLines: string[] = []
    for (const line of block.split(/\r\n|\r|\n/)) {
      if (line.startsWith("event:")) {
        eventName = stripProtocolSpace(line.slice(6))
      } else if (line.startsWith("data:")) {
        dataLines.push(stripProtocolSpace(line.slice(5)))
      }
    }
    if (dataLines.length === 0) return null

    let raw: unknown
    try {
      raw = JSON.parse(dataLines.join("\n"))
    } catch {
      return null
    }

    if (eventName) {
      return {
        kind: "named",
        name: eventName,
        data: validateNamedEvent(eventName, raw),
      }
    }

    const agui = parseAguiEvent(raw)
    if (agui) {
      return {
        kind: "agui",
        event: agui,
        internal: this.normalizeAgui(agui),
        raw: raw as Record<string, unknown>,
      }
    }

    const data = validateInlineEvent(raw)
    const name = typeof data.type === "string" ? data.type : "message"
    return { kind: "inline", name, data }
  }
}

/** Convert an AG-UI adapter result back to the legacy inline shape consumed by
 * older reducers while the surfaces migrate independently. */
export function internalToInline(event: InternalEvent): Record<string, unknown> {
  if (event.eventName === "chunk") {
    return { type: "content", content: event.parsed.delta ?? "" }
  }
  if (event.eventName === "reasoning") {
    return { type: "reasoning", content: event.parsed.delta ?? "" }
  }
  return { ...event.parsed, type: event.eventName }
}
