import type { WebCitation } from '@/types/chat'

// The backend sends no citation data for a normal web-search turn. What it does
// send is the model's own answer, which the system prompt has end with a
// `Sources:` block of `[N] [title](url)` lines backing the `[N]` markers in the
// text. This module turns that trailing block into citations so the markers can
// render as chips and the block itself can give way to the SourceList.

export interface DerivedCitations {
  /** Citation N sits at index N - 1, so the `[N]` markers resolve by number.
   *  Numbers the block skips are holes in the array: array methods skip them,
   *  a lookup returns `undefined`, and the chip shows as unavailable. */
  citations: WebCitation[]
  /** `content` without the Sources block (unchanged when there is none). */
  contentWithoutSourcesBlock: string
}

const HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*sources\s*:?\s*(?:\*\*|__)?\s*:?\s*$/i
// `[1] …`, `- [1] …`, `1. …` — the marker, then the source itself.
const ENTRY = /^\s*(?:[-*+]\s+)?(?:\[(\d+)\]|(\d+)[.)])\s*[:.)\-–—]?\s*(.+?)\s*$/
// The start of an entry whose line has not finished streaming yet.
const PARTIAL_ENTRY = /^\s*(?:[-*+]\s+)?(?:\[\d*\]?|\d+[.)]?)(?:\s.*)?$/
const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*<?(https?:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/
const BARE_URL = /<?(https?:\/\/[^\s<>]+?)>?(?=[\s)\],;]|$)/
const FENCE = /^\s*(?:```|~~~)/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
// A full reference link, `[text][N]`. Two citations side by side (`[1][2]`) also
// match, so the caller skips an all-digit first label.
const REFERENCE_LINK = /\[([^\]\n]+)\]\[(\d+)\]/g

function domainOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function parseEntry(line: string): { n: number; citation: WebCitation } | null {
  const entry = ENTRY.exec(line)
  if (!entry) return null
  const n = Number(entry[1] ?? entry[2])
  if (!Number.isSafeInteger(n) || n < 1) return null
  const body = entry[3]

  const link = MARKDOWN_LINK.exec(body)
  if (link) {
    const url = link[2]
    const title = link[1].trim() || body.replace(link[0], '').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '') || url
    return { n, citation: { title, url, domain: domainOf(url) } }
  }

  const bare = BARE_URL.exec(body)
  if (!bare) return null
  const url = bare[1].replace(/[.,;:]+$/, '')
  // "Title — https://…" / "Title (https://…)": whatever surrounds the URL is its title.
  const title = body
    .replace(bare[0], '')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
  return { n, citation: { title: title || url, url, domain: domainOf(url) } }
}

/**
 * Parse the answer's trailing Sources block. The block is only taken when it
 * is the last thing in the message, outside any code fence, and every line in
 * it parses as a source; otherwise the content is returned untouched with no
 * citations.
 *
 * With `streaming`, the block is still being written: a heading with no
 * entries yet, or a last line that is a half-written entry, still counts (so
 * the raw block never flashes up before it disappears), and only finished
 * entries become citations.
 */
export function deriveCitationsFromSources(
  content: string,
  options: { streaming?: boolean } = {},
): DerivedCitations {
  const unchanged: DerivedCitations = { citations: [], contentWithoutSourcesBlock: content }
  if (!content || !/sources/i.test(content)) return unchanged

  const lines = content.split('\n')
  let end = lines.length
  while (end > 0 && !lines[end - 1].trim()) end -= 1

  // A last line without its newline may still be growing.
  const lastLineOpen = Boolean(options.streaming) && end === lines.length

  const citations: WebCitation[] = []
  let entries = 0
  let heading = -1
  for (let i = end - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line.trim()) continue
    if (HEADING.test(line)) {
      heading = i
      break
    }
    const parsed = parseEntry(line)
    if (parsed) {
      entries += 1
      // Keep the first line for a number the model listed twice.
      citations[parsed.n - 1] = parsed.citation
      continue
    }
    if (lastLineOpen && i === end - 1 && PARTIAL_ENTRY.test(line)) continue
    return unchanged
  }

  if (heading < 0) return unchanged
  if (entries === 0 && !options.streaming) return unchanged
  // An odd number of fence lines above the heading means it sits inside an open code block.
  const fences = lines.slice(0, heading).filter((line) => FENCE.test(line)).length
  if (fences % 2 === 1) return unchanged
  // `[1]: url` lines are also Markdown link definitions. When the answer uses
  // one as a reference link (`[docs][1]`), removing the block would break it.
  for (const ref of lines.slice(0, heading).join('\n').matchAll(REFERENCE_LINK)) {
    if (!/^\s*\d+\s*$/.test(ref[1]) && citations[Number(ref[2]) - 1]) return unchanged
  }

  let cut = heading
  while (cut > 0 && !lines[cut - 1].trim()) cut -= 1
  if (cut > 0 && RULE.test(lines[cut - 1])) cut -= 1

  return { citations, contentWithoutSourcesBlock: lines.slice(0, cut).join('\n').trimEnd() }
}

/**
 * The entries a source list shows: each citation with its own number N,
 * skipping numbers the model left out, and each URL once (at its lowest N).
 */
export function listedSources(citations: WebCitation[]): Array<{ n: number; citation: WebCitation }> {
  const seen = new Set<string>()
  return citations.flatMap((citation, i) => {
    if (citation.url) {
      if (seen.has(citation.url)) return []
      seen.add(citation.url)
    }
    return [{ n: i + 1, citation }]
  })
}
