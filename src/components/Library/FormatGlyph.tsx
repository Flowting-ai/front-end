'use client'

import React from 'react'
import { AudioWaveOneIcon, FileTwoIcon, ImageTwoIcon } from '@strange-huge/icons'
import type { Format } from '@/lib/library/schemas'
import { formatLabel } from '@/lib/library/format'

type Tint = 'Red' | 'Green' | 'Blue' | 'Purple' | 'Yellow' | 'Brown'

const TINT_BY_FORMAT: Record<Format, Tint> = {
  pdf: 'Red',
  document: 'Blue',
  slides: 'Yellow',
  text: 'Brown',
  web: 'Brown',
  email: 'Purple',
  sheet: 'Green',
  image: 'Purple',
  audio: 'Blue',
}

const SIZES = { xs: { box: 24, icon: 14, radius: 6 }, sm: { box: 32, icon: 16, radius: 8 }, md: { box: 40, icon: 20, radius: 10 }, lg: { box: 56, icon: 28, radius: 14 } } as const

/** A tiny grid mark for spreadsheets (the icon set has no table glyph). */
function SheetGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12M2 10h12M6.2 2.5v11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/** A page with a fold and the letters "PDF", as in the prototype. */
export function PdfGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <g strokeWidth="1.5">
        <path d="M6.2 18v-5h1.7a1.5 1.5 0 0 1 0 3H6.2" />
        <path d="M10.6 13v5h1.1a2.5 2.5 0 0 0 0-5z" />
        <path d="M15.2 18v-5H18M15.2 15.4h2" />
      </g>
    </svg>
  )
}

/** The tint text colour of a format, for icons drawn outside the tile (the Filter menu). */
export function formatTintText(format: Format): string {
  return `var(--color-tag-${TINT_BY_FORMAT[format]}-text)`
}

export interface FormatGlyphProps {
  format: Format
  size?: keyof typeof SIZES
  /** Show the text label beside the glyph. File type is never colour alone. */
  showLabel?: boolean
}

/** The file type as a tinted tile with an icon, and optionally its word, so type never depends on colour alone. */
export function FormatGlyph({ format, size = 'sm', showLabel = false }: FormatGlyphProps) {
  const dims = SIZES[size]
  const tint = TINT_BY_FORMAT[format]
  const icon =
    format === 'pdf' ? <PdfGlyph size={dims.icon} /> :
    format === 'sheet' ? <SheetGlyph size={dims.icon} /> :
    format === 'image' ? <ImageTwoIcon size={dims.icon} /> :
    format === 'audio' ? <AudioWaveOneIcon size={dims.icon} /> :
    <FileTwoIcon size={dims.icon} />
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: dims.box, height: dims.box, borderRadius: dims.radius,
          background: `var(--color-tag-${tint}-bg)`, color: `var(--color-tag-${tint}-text)`,
        }}
      >
        {icon}
      </span>
      {showLabel && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)' }}>{formatLabel(format)}</span>
      )}
    </span>
  )
}
