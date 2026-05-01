// ── extractThinkingContent ────────────────────────────────────────────────────

const THINK_TAG_PATTERN = /<think>([\s\S]*?)<\/think>/gi

export interface ThinkingParseResult {
  visibleText: string
  thinkingText: string | null
}

/**
 * Strips <think>…</think> blocks from an assistant message.
 * Returns the cleaned visible text and the aggregated reasoning content.
 * Safe to call on partial streaming text.
 */
export const extractThinkingContent = (
  value: string | null | undefined,
): ThinkingParseResult => {
  if (!value) return { visibleText: "", thinkingText: null }

  const captured: string[] = []
  let hasThoughts = false

  const stripped = value.replace(THINK_TAG_PATTERN, (_match, inner) => {
    hasThoughts = true
    const trimmed = typeof inner === "string" ? inner.trim() : ""
    if (trimmed) captured.push(trimmed)
    return ""
  })

  const cleaned = hasThoughts
    ? stripped.replace(/^\s*(?:[-–—]+\s*)?/, "").trim()
    : stripped.trim()

  return {
    visibleText: cleaned,
    thinkingText: hasThoughts ? captured.filter(Boolean).join("\n\n") : null,
  }
}

// ── extractSources ────────────────────────────────────────────────────────────

export interface ContentSource {
  url: string
  title?: string
}

/**
 * Extracts HTTP/HTTPS source URLs from raw Markdown assistant content.
 * Pass 1: Markdown links [text](url) — captures title.
 * Pass 2: Bare URLs not already captured in pass 1.
 */
export function extractSources(content: string): ContentSource[] {
  if (!content || typeof content !== "string") return []

  const seen = new Set<string>()
  const out: ContentSource[] = []

  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(content)) !== null) {
    const url = m[2].trim()
    if (seen.has(url)) continue
    seen.add(url)
    const title = m[1].trim()
    out.push({ url, title: title || undefined })
  }

  const urlRegex = /https?:\/\/[^\s)\]">]+/g
  while ((m = urlRegex.exec(content)) !== null) {
    const url = m[0].replace(/[.)]+$/, "")
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url })
  }

  return out
}
