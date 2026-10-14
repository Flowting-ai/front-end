import React from 'react'
import { matchRanges } from '@/lib/search/text-match'

export type HighlightVariant = 'bold' | 'background'

// Splits `text` on the first case-insensitive occurrence of `query` and
// returns a React node with the matched segment called out — bolded in
// neutral-900 ('bold'), or given a yellow background ('background', the
// classic <mark> search-hit look). Returns plain text when query is empty
// or has no match.
/**
 * Bold every occurrence of every query term, case- and diacritic-insensitive
 * ("cafe paris" marks both words in "Café in Paris"). Global search uses this.
 */
export function highlightTerms(text: string, query: string): React.ReactNode {
  const ranges = matchRanges(text, query)
  if (ranges.length === 0) return text
  const parts: React.ReactNode[] = []
  let at = 0
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(<strong key={i} style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{text.slice(start, end)}</strong>)
    at = end
  })
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

export function highlightMatch(text: string, query: string, variant: HighlightVariant = 'bold'): React.ReactNode {
  if (!query.trim()) return text
  const lower      = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  const idx        = lower.indexOf(lowerQuery)
  if (idx === -1) return text

  const match = text.slice(idx, idx + lowerQuery.length)
  const matched = variant === 'background' ? (
    <mark style={{ background: 'var(--yellow-100)', color: 'inherit', borderRadius: 2 }}>{match}</mark>
  ) : (
    <strong style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{match}</strong>
  )

  return (
    <>
      {text.slice(0, idx)}
      {matched}
      {text.slice(idx + lowerQuery.length)}
    </>
  )
}
