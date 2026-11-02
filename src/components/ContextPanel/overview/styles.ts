import type React from 'react'

// Shared typography and motion constants for the overview's pieces.

// ── Typography ────────────────────────────────────────────────────────────────

export const TEXT: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--neutral-800)',
}

export const CAPTION: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-500)',
}

export const ONE_LINE: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

export const TWO_LINES: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

export const EASE = [0.32, 0.72, 0, 1] as const

export const ROW_CLASS = 'bg-transparent hover:bg-[var(--neutral-200)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue-500)]'
