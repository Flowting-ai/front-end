/**
 * content-parser.ts
 *
 * Splits an assistant content string into typed segments so the renderer can
 * apply the right component to each one.
 *
 * The backend emits <table> and <chart> XML blocks inline inside the regular
 * `content` SSE events. Everything else is plain Markdown.
 * See: docs/frontend-rendering.md
 */

export type ContentSegment =
  | { type: "markdown"; text: string }
  | { type: "table"; xml: string }
  | { type: "chart"; xml: string }
  | { type: "pending"; tag: "table" | "chart" }

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
 * Find the earliest occurrence of an XML opening tag (<table or <chart) that
 * is NOT inside a code fence, searching from `fromIdx` onward.
 */
function findNextOpenTag(
  content: string,
  fromIdx: number,
  fences: Array<[number, number]>,
): { idx: number; tag: "table" | "chart" } | null {
  // We scan character by character, but for efficiency we use indexOf + fence check.
  let tableIdx = content.indexOf("<table", fromIdx)
  let chartIdx = content.indexOf("<chart", fromIdx)

  // Skip fence-enclosed occurrences
  while (tableIdx !== -1 && isInsideFence(tableIdx, fences)) {
    tableIdx = content.indexOf("<table", tableIdx + 1)
  }
  while (chartIdx !== -1 && isInsideFence(chartIdx, fences)) {
    chartIdx = content.indexOf("<chart", chartIdx + 1)
  }

  // Validate that the character after "<table" / "<chart" is either a space or ">"
  // (so we don't match a hypothetical <tableSomething tag)
  if (tableIdx !== -1) {
    const nextChar = content[tableIdx + 6]
    if (nextChar !== " " && nextChar !== ">" && nextChar !== "\n" && nextChar !== "\r" && nextChar !== "/") {
      tableIdx = -1
    }
  }
  if (chartIdx !== -1) {
    const nextChar = content[chartIdx + 6]
    if (nextChar !== " " && nextChar !== ">" && nextChar !== "\n" && nextChar !== "\r" && nextChar !== "/") {
      chartIdx = -1
    }
  }

  if (tableIdx === -1 && chartIdx === -1) return null
  if (tableIdx === -1) return { idx: chartIdx, tag: "chart" }
  if (chartIdx === -1) return { idx: tableIdx, tag: "table" }
  return tableIdx <= chartIdx
    ? { idx: tableIdx, tag: "table" }
    : { idx: chartIdx, tag: "chart" }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Splits an assistant content string into typed segments.
 *
 * - Complete `<table>...</table>` blocks → `{ type: "table", xml }`
 * - Complete `<chart ...>...</chart>` blocks → `{ type: "chart", xml }`
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
      // No more XML blocks — rest is Markdown
      segments.push({ type: "markdown", text: content.slice(cursor) })
      break
    }

    // Text before the opening tag is Markdown
    if (found.idx > cursor) {
      segments.push({ type: "markdown", text: content.slice(cursor, found.idx) })
    }

    const closeTag = `</${found.tag}>`
    const closeIdx = content.toLowerCase().indexOf(closeTag.toLowerCase(), found.idx)

    if (closeIdx === -1) {
      // Block is still in-flight (streaming) — no closing tag yet
      segments.push({ type: "pending", tag: found.tag })
      break // nothing more to parse; the rest is the incomplete block
    }

    // Complete block
    const xmlEnd = closeIdx + closeTag.length
    segments.push({ type: found.tag, xml: content.slice(found.idx, xmlEnd) })
    cursor = xmlEnd
  }

  return segments
}
