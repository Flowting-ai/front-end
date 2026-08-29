import React from 'react'

export type HighlightVariant = 'bold' | 'background'

// Splits `text` on the first case-insensitive occurrence of `query` and
// returns a React node with the matched segment called out — bolded in
// neutral-900 ('bold'), or given a yellow background ('background', the
// classic <mark> search-hit look). Returns plain text when query is empty
// or has no match.
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
