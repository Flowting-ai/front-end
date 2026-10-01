'use client'

import React from 'react'

// ── Template card skeleton ────────────────────────────────────────────────────
// Loading placeholder for the starter cards (TemplateCard). Same border, radius,
// padding and gaps as TemplateCard, with a two-line label area, so the real cards
// replace it without the row changing height. Uses the shared .kaya-skeleton pulse
// utility (globals.css).

export interface TemplateCardSkeletonProps {
  /** How many placeholder cards to render. @default 3 */
  count?: number
}

export function TemplateCardSkeleton({ count = 3 }: TemplateCardSkeletonProps) {
  return (
    <div
      aria-hidden
      style={{ display: 'flex', gap: '10px', alignItems: 'stretch', width: '100%' }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            flex:          1,
            minWidth:      0,
            background:    'var(--neutral-white)',
            border:        '1px solid var(--neutral-200)',
            borderRadius:  '12px',
            padding:       '14px 12px',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'flex-start',
            gap:           '10px',
            boxShadow:     '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div className="kaya-skeleton" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ width: '100%', minHeight: 36, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 3 }}>
            <div className="kaya-skeleton" style={{ height: 11, width: '90%', borderRadius: 6 }} />
            <div className="kaya-skeleton" style={{ height: 11, width: '60%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default TemplateCardSkeleton
