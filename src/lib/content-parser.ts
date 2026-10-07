/**
 * content-parser.ts
 *
 * Splits an assistant content string into typed segments so the renderer can
 * apply the right component to each one.
 *
 * The backend emits structured XML blocks (STRUCTURED_TAGS) inline inside the
 * regular `content` SSE events. Everything else is plain Markdown.
 * See: docs/ui/frontend-rendering.md
 */

/** XML block tags the assistant can emit inline. Adding a widget = add its tag
 *  here, add a case in ContentRenderer, and teach the model the format in the
 *  backend's core/prompts/system.yaml formatting block. */
export const STRUCTURED_TAGS = ["table", "chart", "metrics", "email", "funnel", "kanban", "schedule", "weather", "map", "steps", "callout", "tags"] as const
export type StructuredTag = (typeof STRUCTURED_TAGS)[number]

export type ContentSegment =
  | { type: "markdown"; text: string; start: number; end: number }
  | { type: StructuredTag; xml: string; start: number; end: number }
  | { type: "pending"; tag: StructuredTag; start: number; end: number }
  /** A block whose closing tag never arrived and never will. */
  | { type: "incomplete"; tag: StructuredTag; xml: string; start: number; end: number }

export interface ParseContentOptions {
  /**
   * True while the response is still arriving. Only then can an unclosed
   * block still complete, so only then is it reported as `pending`. Defaults
   * to false (final content: finished, stopped, or loaded from history).
   */
  streaming?: boolean
}

// ---------------------------------------------------------------------------
// Code-range exclusion
// ---------------------------------------------------------------------------

/** Container prefixes a fence may sit behind: list markers and quote markers. */
const CONTAINER_PREFIX = String.raw`(?:[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+|[ \t]*>)*[ \t]*`

const FENCE_OPEN_RE = new RegExp(`${CONTAINER_PREFIX}(\`{3,}|~{3,})([^\\n]*)`, "y")

/**
 * When the line starting at `lineStart` opens a ``` / ~~~ fence, returns the
 * index just past its closing fence (the end of content when it is never
 * closed); otherwise -1. The fence may be indented or sit behind list / quote
 * markers ("2. ```bash", "> ```") so fences inside list items count too.
 */
function fenceEnd(content: string, lineStart: number): number {
  FENCE_OPEN_RE.lastIndex = lineStart
  const m = FENCE_OPEN_RE.exec(content)
  if (!m) return -1
  const marker = m[1]
  // A backtick info string can't contain backticks: "```js```" is inline code.
  if (marker[0] === "`" && m[2].includes("`")) return -1

  const close = new RegExp(`^[ \\t>]*\\${marker[0]}{${marker.length},}[ \\t]*\\r?$`, "gm")
  close.lastIndex = lineStart + m[0].length
  const c = close.exec(content)
  return c ? c.index + c[0].length : content.length
}

/** A structured block opening at the start of a later line. */
const LINE_START_OPEN_TAG_RE = new RegExp(`\\n[ \\t]*<(?:${STRUCTURED_TAGS.join("|")})(?=[\\s/>])`, "gi")

/**
 * Returns the index just past the inline code span opened by the run of
 * `runLength` backticks at `idx` (closed by a run of exactly the same length
 * within the same paragraph), or -1 when the run is never closed. A widget
 * tag starting a line also ends the search, so a stray backtick in prose
 * can't pair with one inside the next widget.
 */
function codeSpanEnd(content: string, idx: number, runLength: number): number {
  const re = new RegExp(`\`+|\\n[ \\t\\r]*\\n|${LINE_START_OPEN_TAG_RE.source}`, "gi")
  re.lastIndex = idx + runLength
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m[0][0] !== "`") return -1 // paragraph or widget boundary
    if (m[0].length === runLength) return m.index + runLength
  }
  return -1
}

/**
 * When a fenced code block or an inline code span starts at `pos`, returns
 * the index just past it; otherwise -1. While streaming, a backtick run on
 * the last line that isn't closed yet is still being typed, so it counts as
 * code to the end.
 */
function codeEnd(content: string, pos: number, streaming: boolean): number {
  if (pos === 0 || content[pos - 1] === "\n") {
    const end = fenceEnd(content, pos)
    if (end !== -1) return end
  }
  if (content[pos] !== "`" || content[pos - 1] === "\\") return -1
  let runLength = 1
  while (content[pos + runLength] === "`") runLength++
  const end = codeSpanEnd(content, pos, runLength)
  if (end !== -1) return end
  return streaming && !content.includes("\n", pos) ? content.length : -1
}

/** Index past a backtick run at `pos` that is not code: an escaped backtick
 *  (only that one is literal) or an unmatched run. */
function skipLiteralBackticks(content: string, pos: number): number {
  if (content[pos - 1] === "\\") return pos + 1
  while (content[pos] === "`") pos++
  return pos
}

/**
 * [start, end) ranges of fenced code blocks (``` / ~~~, an unclosed fence
 * running to the end) and inline code spans, for text transforms that must
 * leave code alone. Indented code blocks are not included.
 */
export function findCodeRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let pos = 0
  while (pos < content.length) {
    const end = codeEnd(content, pos, false)
    if (end !== -1) {
      ranges.push([pos, end])
      pos = end
    } else if (content[pos] === "`") {
      pos = skipLiteralBackticks(content, pos)
    } else {
      pos++
    }
  }
  return ranges
}

// ---------------------------------------------------------------------------
// Structured block detection
// ---------------------------------------------------------------------------

/** A structured-tag opening at the regex's lastIndex; the name must end at a
 *  tag boundary so <chartreuse> or <metricsystem> never match. At the start
 *  of a line the match is case-insensitive (<TABLE> renders like <table>);
 *  mid-line only the lowercase form counts, so a JSX-style <Table> mentioned
 *  in prose stays text. */
const OPEN_TAG_ANY_CASE_RE = new RegExp(`<(${STRUCTURED_TAGS.join("|")})(?=[\\s/>])`, "iy")
const OPEN_TAG_LOWERCASE_RE = new RegExp(`<(${STRUCTURED_TAGS.join("|")})(?=[\\s/>])`, "y")

/** A bare `<name` at the very end of the content (no boundary character yet). */
const TRAILING_TAG_NAME_RE = /^<([a-z]*)$/i

/** The backend's trailing interruption marker; mirrors lib/model-error.ts. */
const RESPONSE_INTERRUPTED_RE = /\n*\[Response interrupted:\s*[\s\S]*\]\s*$/

// table/chart are parsed with an XML-mode DOMParser, whose querySelector is
// case-sensitive, so their element names are normalised to lowercase. The
// other widgets go through the case-insensitive scanTags and keep their text
// (which may legitimately contain "<Like this>") untouched.
function normaliseXml(tag: StructuredTag, xml: string): string {
  if (tag !== "table" && tag !== "chart") return xml
  return xml.replace(/<(\/?)([A-Za-z][\w.:-]*)/g, (_, slash: string, name: string) => `<${slash}${name.toLowerCase()}`)
}

function isAtLineStart(content: string, idx: number): boolean {
  const lineStart = content.lastIndexOf("\n", idx - 1) + 1
  return /^[ \t]*$/.test(content.slice(lineStart, idx))
}

/**
 * Widgets never nest a block inside one of the same type, so another opening
 * that starts a line (outside code) between `from` and `to` means the block
 * opened before `from` will never close.
 */
function reopensBefore(content: string, from: number, to: number, tag: StructuredTag): boolean {
  const open = new RegExp(`<${tag}(?=[\\s/>])`, "iy")
  let pos = from
  while (pos < to) {
    const end = codeEnd(content, pos, false)
    if (end !== -1) {
      pos = end
      continue
    }
    if (content[pos] === "`") {
      pos = skipLiteralBackticks(content, pos)
      continue
    }
    if (content[pos] === "<" && isAtLineStart(content, pos)) {
      open.lastIndex = pos
      if (open.test(content)) return true
    }
    pos++
  }
  return false
}

/**
 * Where the raw text of a block that will never close ends: at the first
 * blank line after which prose resumes (the next non-blank line doesn't start
 * with "<"), or at the next structured block starting a line, whichever comes
 * first. Blank lines between the block's own elements stay inside it. With
 * neither, the block runs to the end of the content.
 */
function incompleteBlockEnd(content: string, start: number): number {
  LINE_START_OPEN_TAG_RE.lastIndex = start
  const limit = LINE_START_OPEN_TAG_RE.exec(content)?.index ?? content.length

  const blank = /\n[ \t\r]*\n/g
  blank.lastIndex = start
  let m: RegExpExecArray | null
  while ((m = blank.exec(content)) !== null && m.index < limit) {
    if (!content.slice(blank.lastIndex).trimStart().startsWith("<")) return m.index
    blank.lastIndex = m.index + 1 // consecutive blank lines share a newline
  }
  return limit
}

function parseBody(content: string, streaming: boolean): ContentSegment[] {
  const segments: ContentSegment[] = []
  let textStart = 0
  let pos = 0

  const pushMarkdown = (end: number) => {
    if (end > textStart) segments.push({ type: "markdown", text: content.slice(textStart, end), start: textStart, end })
  }

  while (pos < content.length) {
    const ch = content[pos]

    // Code (fences and inline spans): XML inside is an example, not a real block.
    const codeStop = codeEnd(content, pos, streaming)
    if (codeStop !== -1) {
      pos = codeStop
      continue
    }
    if (ch === "`") {
      pos = skipLiteralBackticks(content, pos)
      continue
    }

    if (ch !== "<") {
      pos++
      continue
    }

    const atLineStart = isAtLineStart(content, pos)
    const openRe = atLineStart ? OPEN_TAG_ANY_CASE_RE : OPEN_TAG_LOWERCASE_RE
    openRe.lastIndex = pos
    const open = openRe.exec(content)

    if (!open) {
      // A tag name still being typed at the very end of the stream ("<",
      // "<tabl", "<table"): hide it rather than flash it as literal text.
      // Only a line-start tag can become a pending block.
      const partial = streaming ? TRAILING_TAG_NAME_RE.exec(content.slice(pos)) : null
      const name = partial && (atLineStart ? partial[1].toLowerCase() : partial[1])
      if (name !== null) {
        const fullTag = STRUCTURED_TAGS.find((tag) => tag === name)
        if (fullTag || STRUCTURED_TAGS.some((tag) => tag.startsWith(name))) {
          pushMarkdown(pos)
          if (fullTag && atLineStart) segments.push({ type: "pending", tag: fullTag, start: pos, end: content.length })
          return segments
        }
      }
      pos++
      continue
    }

    const tag = open[1].toLowerCase() as StructuredTag
    const close = new RegExp(`</${tag}\\s*>`, "gi")
    close.lastIndex = pos + open[0].length
    const closeMatch = close.exec(content)
    const reopened = reopensBefore(content, pos + open[0].length, closeMatch?.index ?? content.length, tag)

    if (closeMatch && !reopened) {
      const end = closeMatch.index + closeMatch[0].length
      pushMarkdown(pos)
      segments.push({ type: tag, xml: normaliseXml(tag, content.slice(pos, end)), start: pos, end })
      pos = textStart = end
      continue
    }

    // An unclosed tag mid-line is prose that mentions it ("use the <table>
    // element"): it stays literal text, mid-stream too.
    if (!atLineStart) {
      pos += open[0].length
      continue
    }

    if (streaming && !reopened) {
      // Block is still in-flight - no closing tag yet; the rest is the incomplete block.
      pushMarkdown(pos)
      segments.push({ type: "pending", tag, start: pos, end: content.length })
      return segments
    }

    // The block will never close (the stream is over, or the same tag opens again).
    const end = incompleteBlockEnd(content, pos)
    pushMarkdown(pos)
    segments.push({ type: "incomplete", tag, xml: content.slice(pos, end), start: pos, end })
    pos = textStart = end
  }

  pushMarkdown(content.length)
  return segments
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Splits an assistant content string into typed segments.
 *
 * - Complete `<table>...</table>` / `<chart>...</chart>` / ... blocks
 *   → `{ type: <tag>, xml }` (case-insensitive at the start of a line,
 *   lowercase only mid-line)
 * - While streaming, a block starting a line whose closing tag hasn't
 *   arrived yet → `{ type: "pending" }`, which ends the parse
 * - A block starting a line that will never close (the stream is over, or
 *   another block of the same type opens first) → `{ type: "incomplete",
 *   xml }`, and parsing continues after it
 * - An unclosed tag mid-line stays literal Markdown text, streaming or not
 *   (a prose mention like "use the <table> element")
 * - Everything else → `{ type: "markdown", text }`
 *
 * Tags inside fenced code (``` or ~~~, also inside list items and quotes) or
 * inline code spans are left as Markdown text (they are examples, not real
 * structured blocks).
 *
 * A trailing "[Response interrupted: …]" marker means the stream is over, so
 * the content before it is parsed as final and the marker always lands in a
 * Markdown segment (where preprocessMarkdown turns it into a friendly line)
 * instead of being swallowed by an unclosed block.
 */
export function parseContentSegments(content: string, options: ParseContentOptions = {}): ContentSegment[] {
  const interrupted = RESPONSE_INTERRUPTED_RE.exec(content)
  if (!interrupted) return parseBody(content, options.streaming ?? false)

  const segments = parseBody(content.slice(0, interrupted.index), false)
  const last = segments[segments.length - 1]
  if (last?.type === "markdown") {
    last.text = content.slice(last.start)
    last.end = content.length
  } else {
    segments.push({ type: "markdown", text: content.slice(interrupted.index), start: interrupted.index, end: content.length })
  }
  return segments
}
