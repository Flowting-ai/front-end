import type { ResponseBlock } from "@/hooks/use-chat-state"

const RESPONSE_BLOCK_KINDS = new Set<ResponseBlock["kind"]>([
  "text",
  "table",
  "bar-chart",
  "steps",
  "code",
  "callout",
  "tags",
  "follow-ups",
  "pie-chart",
  "line-chart",
  "card",
  "connector-error",
  "search-timeout",
])

export function isResponseBlock(value: unknown): value is ResponseBlock {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.kind !== "string" || !RESPONSE_BLOCK_KINDS.has(candidate.kind as ResponseBlock["kind"])) {
    return false
  }
  return candidate.kind === "text"
    ? typeof candidate.content === "string"
    : Boolean(candidate.data && typeof candidate.data === "object")
}

/** Accept both the app envelope and the preview contract's direct block payload. */
export function responseBlockFromEventPayload(payload: Record<string, unknown>): ResponseBlock | null {
  if (isResponseBlock(payload.block)) return payload.block
  return isResponseBlock(payload) ? payload : null
}
