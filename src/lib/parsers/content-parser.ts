// ── extractThinkingContent ────────────────────────────────────────────────────

// Only a <think> block that opens the message is reasoning. A tag anywhere else
// (prose, inline code, a code fence) is part of the answer and stays as written.
const LEADING_THINK_OPEN = /^\s*<think>/i
const THINK_CLOSE = /<\/think>/i
// A dash-only separator line some models put between the reasoning and the answer.
const LEADING_SEPARATOR = /^\s*[-–—]+[ \t]*(?:\r?\n|$)/

export interface ThinkingParseResult {
  visibleText: string
  thinkingText: string | null
  /** The leading <think> block has no closing tag, so everything after it is
   *  reasoning. Mid-stream the model is still thinking; at the end of a stream
   *  the answer was never written. */
  thinkingOpen: boolean
}

/**
 * Splits a leading <think>…</think> block off an assistant message.
 * Returns the visible answer and the reasoning content.
 * Safe to call on partial streaming text.
 */
export const extractThinkingContent = (
  value: string | null | undefined,
): ThinkingParseResult => {
  if (!value) return { visibleText: "", thinkingText: null, thinkingOpen: false }

  const open = LEADING_THINK_OPEN.exec(value)
  if (!open) return { visibleText: value.trim(), thinkingText: null, thinkingOpen: false }

  const rest = value.slice(open[0].length)
  const close = THINK_CLOSE.exec(rest)
  if (!close) return { visibleText: "", thinkingText: rest.trim() || null, thinkingOpen: true }

  return {
    visibleText: rest.slice(close.index + close[0].length).replace(LEADING_SEPARATOR, "").trim(),
    thinkingText: rest.slice(0, close.index).trim() || null,
    thinkingOpen: false,
  }
}

// ── extractSources ────────────────────────────────────────────────────────────

export interface ContentSource {
  url: string
  title?: string
}

/**
 * Extracts HTTP/HTTPS source URLs from raw Markdown assistant content.
 * Pass 1: Markdown links [text](url) - captures title.
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
