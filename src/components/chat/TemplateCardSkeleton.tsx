'use client'

import React from 'react'

// ── Template card skeleton ────────────────────────────────────────────────────
// Loading placeholder for the starter cards (TemplateCard). Same border, radius,
// padding and gaps as TemplateCard in the matching layout, so the real cards
// replace it without the layout shifting. Uses the shared .kaya-skeleton pulse
// utility (globals.css).

export interface TemplateCardSkeletonProps {
  /** How many placeholder cards to render. @default 3 */
  count?: number
  /** `tile` = 3-up grid (icon above two label lines). `row` = stacked list. @default 'tile' */
  layout?: 'tile' | 'row'
  /** Drops the card background, border and shadow. */
  bare?: boolean
}

export function TemplateCardSkeleton({ count = 3, layout = 'tile', bare = false }: TemplateCardSkeletonProps) {
  const isRow = layout === 'row'
  return (
    <div
      aria-hidden
      style={{
        display:       'flex',
        flexDirection: isRow ? 'column' : 'row',
        gap:           isRow ? '8px' : '10px',
        alignItems:    'stretch',
        width:         '100%',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            flex:          isRow ? undefined : 1,
            width:         isRow ? '100%' : undefined,
            minWidth:      0,
            background:    bare ? 'transparent' : 'var(--neutral-white)',
            border:        bare ? '1px solid transparent' : '1px solid var(--border-default)',
            borderRadius:  '12px',
            padding:       isRow ? '12px' : '14px 12px',
            display:       'flex',
            flexDirection: isRow ? 'row' : 'column',
            alignItems:    isRow ? 'center' : 'flex-start',
            gap:           isRow ? '12px' : '10px',
            boxShadow:     bare ? 'none' : '0 1px 3px color-mix(in srgb, var(--static-black) 4%, transparent)',
          }}
        >
          <div className="kaya-skeleton" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
          {isRow ? (
            <div className="kaya-skeleton" style={{ height: 11, width: '60%', borderRadius: 6 }} />
          ) : (
            <div style={{ width: '100%', minHeight: 36, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 3 }}>
              <div className="kaya-skeleton" style={{ height: 11, width: '90%', borderRadius: 6 }} />
              <div className="kaya-skeleton" style={{ height: 11, width: '60%', borderRadius: 6 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default TemplateCardSkeleton
