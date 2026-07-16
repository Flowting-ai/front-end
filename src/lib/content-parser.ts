/**
 * content-parser.ts
 *
 * Splits an assistant content string into typed segments so the renderer can
 * apply the right component to each one.
 *
 * The backend emits structured XML blocks (STRUCTURED_TAGS) inline inside the
 * regular `content` SSE events. Everything else is plain Markdown.
 * See: docs/frontend-rendering.md
 */

/** XML block tags the assistant can emit inline. Adding a widget = add its tag
 *  here, add a case in ContentRenderer, and teach the model the format in the
 *  backend's core/prompts/system.yaml formatting block. */
export const STRUCTURED_TAGS = ["table", "chart", "metrics", "email", "funnel", "kanban", "schedule", "weather", "map"] as const
export type StructuredTag = (typeof STRUCTURED_TAGS)[number]

export type ContentSegment =
  | { type: "markdown"; text: string; start: number; end: number }
  | { type: StructuredTag; xml: string; start: number; end: number }
  | { type: "pending"; tag: StructuredTag; start: number; end: number }

// ---------------------------------------------------------------------------
// Code-fence exclusion
// ---------------------------------------------------------------------------

/**
 * Returns [start, end] byte ranges of every ``` ... ``` code fence in content.
 * XML found inside these ranges should be ignored (it's an example, not a real block).
 */
function getCodeFenceRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  // Match triple-backtick fences, possibly with a language hint, multiline
  const re = /```[^\n]*\n[\s\S]*?```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    ranges.push([m.index, m.index + m[0].length])
  }
  return ranges
}

function isInsideFence(idx: number, fences: Array<[number, number]>): boolean {
  return fences.some(([s, e]) => idx >= s && idx < e)
}

// ---------------------------------------------------------------------------
// Structured block detection
// ---------------------------------------------------------------------------

/**
 * Find the earliest occurrence of a structured-tag opening (e.g. <table,
 * <chart) that is NOT inside a code fence, searching from `fromIdx` onward.
 * Occurrences whose next character continues the tag name (<tableSomething)
 * are skipped.
 */
function findNextOpenTag(
  content: string,
  fromIdx: number,
  fences: Array<[number, number]>,
): { idx: number; tag: StructuredTag } | null {
  let best: { idx: number; tag: StructuredTag } | null = null

  for (const tag of STRUCTURED_TAGS) {
    const open = `<${tag}`
    let idx = content.indexOf(open, fromIdx)
    while (idx !== -1) {
      const nextChar = content[idx + open.length]
      const isTagBoundary =
        nextChar === " " || nextChar === ">" || nextChar === "\n" || nextChar === "\r" || nextChar === "/"
      if (isTagBoundary && !isInsideFence(idx, fences)) break
      idx = content.indexOf(open, idx + 1)
    }
    if (idx !== -1 && (best === null || idx < best.idx)) {
      best = { idx, tag }
    }
  }

  return best
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Splits an assistant content string into typed segments.
 *
 * - Complete `<table>...</table>` / `<chart>...</chart>` / `<metrics>...</metrics>`
 *   blocks → `{ type: <tag>, xml }`
 * - In-flight block (opening tag found but no closing tag yet) → `{ type: "pending" }`
 * - Everything else → `{ type: "markdown", text }`
 *
 * XML blocks inside triple-backtick code fences are left as Markdown text
 * (they are examples, not real structured blocks).
 */
export function parseContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const fences = getCodeFenceRanges(content)
  let cursor = 0

  while (cursor < content.length) {
    const found = findNextOpenTag(content, cursor, fences)

    if (!found) {
      // No more XML blocks - rest is Markdown
      segments.push({ type: "markdown", text: content.slice(cursor), start: cursor, end: content.length })
      break
    }

    // Text before the opening tag is Markdown
    if (found.idx > cursor) {
      segments.push({ type: "markdown", text: content.slice(cursor, found.idx), start: cursor, end: found.idx })
    }

    const closeTag = `</${found.tag}>`
    const closeIdx = content.toLowerCase().indexOf(closeTag.toLowerCase(), found.idx)

    if (closeIdx === -1) {
      // Block is still in-flight (streaming) - no closing tag yet
      segments.push({ type: "pending", tag: found.tag, start: found.idx, end: content.length })
      break // nothing more to parse; the rest is the incomplete block
    }

    // Complete block
    const xmlEnd = closeIdx + closeTag.length
    segments.push({ type: found.tag, xml: content.slice(found.idx, xmlEnd), start: found.idx, end: xmlEnd })
    cursor = xmlEnd
  }

  return segments
}
