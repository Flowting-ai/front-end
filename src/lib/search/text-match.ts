/**
 * Text matching for search boxes: case- and diacritic-insensitive ("cafe"
 * finds "Café"), multi-term (every term must match), ranked, with match
 * ranges in the ORIGINAL string so highlighting lines up even when folding
 * changes length.
 */

const MARKS = /\p{M}/gu

/** Lower-case and strip combining marks: "Café Ñandú" → "cafe nandu". */
export function foldText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(MARKS, '').toLowerCase()
}

/** Distinct folded terms of a query, longest first (so a longer term claims its range). */
export function queryTerms(query: string): string[] {
  const terms = foldText(query).split(/\s+/).filter(Boolean)
  return [...new Set(terms)].sort((a, b) => b.length - a.length)
}

/** Every term appears somewhere across these (already folded) haystacks. */
export function matchesAllTerms(haystacks: string[], terms: string[]): boolean {
  return terms.length > 0 && terms.every(term => haystacks.some(text => text.includes(term)))
}

export const MATCH_RANK = { exact: 4, prefix: 3, wordStart: 2, substring: 1, none: 0 } as const

/** The folded query as one phrase, whitespace collapsed. */
export function queryPhrase(query: string): string {
  return foldText(query).trim().replace(/\s+/g, ' ')
}

/**
 * How well a folded title matches: the whole query exactly, the title starting
 * with it (or a term), a term starting a word, or any substring. Ties keep source order.
 */
export function rankTitle(foldedTitle: string, query: string): number {
  const phrase = queryPhrase(query)
  const terms = queryTerms(query)
  if (!phrase) return MATCH_RANK.none
  if (foldedTitle === phrase) return MATCH_RANK.exact
  if (foldedTitle.startsWith(phrase) || terms.some(t => foldedTitle.startsWith(t))) return MATCH_RANK.prefix
  if (terms.some(t => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(t)}`, 'u').test(foldedTitle))) return MATCH_RANK.wordStart
  if (terms.some(t => foldedTitle.includes(t))) return MATCH_RANK.substring
  return MATCH_RANK.none
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * [start, end) ranges in `text` (original, unfolded) where any query term
 * matches, merged and sorted. Folding is applied per character, so an index
 * in the folded string maps back to the character it came from.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const terms = queryTerms(query)
  if (!text || terms.length === 0) return []
  let folded = ''
  const origin: number[] = []
  // Iterate by code point so surrogate pairs stay together.
  let i = 0
  for (const ch of text) {
    const f = foldText(ch)
    for (let k = 0; k < f.length; k++) origin.push(i)
    folded += f
    i += ch.length
  }
  const ends = (foldedEnd: number) => {
    const startOfLast = origin[foldedEnd - 1]
    const ch = String.fromCodePoint(text.codePointAt(startOfLast)!)
    return startOfLast + ch.length
  }
  const raw: [number, number][] = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = folded.indexOf(term, from)
      if (at < 0) break
      raw.push([origin[at], ends(at + term.length)])
      from = at + term.length
    }
  }
  raw.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of raw) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}
