/**
 * xml-widgets.ts
 *
 * Shared scanner for the flat XML widget blocks the assistant emits
 * (<metrics>, <funnel>, <kanban>, <schedule>, <weather>, <email>). Tags carry
 * data in attributes; some wrap inner content. Regex-based rather than
 * DOMParser so it behaves identically in the browser, SSR, and node tests.
 *
 * Not for <table>/<chart> — those have nested structure and keep their own
 * DOMParser-based parsing.
 */

export interface ScannedTag {
  attrs: Record<string, string>
  /** Raw inner content for paired tags; "" for self-closing. */
  inner: string
}

const ATTR_RE = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

/**
 * Returns every `<tag …/>` or `<tag …>inner</tag>` occurrence in document
 * order, with attribute values entity-unescaped. Same-name nesting is not
 * supported (none of the widget formats nest a tag inside itself).
 */
export function scanTags(xml: string, tag: string): ScannedTag[] {
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, "gi")
  const out: ScannedTag[] = []
  for (const m of xml.matchAll(re)) {
    const attrs: Record<string, string> = {}
    for (const a of m[1].matchAll(ATTR_RE)) {
      attrs[a[1].toLowerCase()] = unescapeXml(a[2])
    }
    out.push({ attrs, inner: m[2] ?? "" })
  }
  return out
}
