'use client'

import React from 'react'
import { PERSONA_CARD_HEIGHT } from './index'

// Loading placeholder shaped like the full agent card (PersonaCard): same height, radius and
// layout — a coloured hero banner with a round avatar, a centred name and "by" line, three
// description lines and the centred action row (50 / 35 / 15, like the card) — so the real cards
// replace it without the grid shifting. Uses the shared .kaya-skeleton pulse utility (globals.css).

export function PersonaCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width:           '100%',
        height:          PERSONA_CARD_HEIGHT,
        boxSizing:       'border-box',
        borderRadius:    20,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--agent-card-bg)',
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
        ...style,
      }}
    >
      {/* Hero banner with the avatar centred on it */}
      <div
        className="kaya-skeleton"
        style={{ position: 'relative', height: PERSONA_CARD_HEIGHT * 0.5, flexShrink: 0, borderRadius: '20px 20px 0 0' }}
      >
        <div
          style={{
            position:        'absolute',
            left:            '50%',
            top:             '50%',
            transform:       'translate(-50%, -50%)',
            width:           110,
            height:          110,
            borderRadius:    '50%',
            backgroundColor: 'var(--agent-card-bg)',
          }}
        />
      </div>

      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 14px 0' }}>
        {/* Name, "by" line, description */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          <div className="kaya-skeleton" style={{ height: 14, width: '42%', borderRadius: 6 }} />
          <div className="kaya-skeleton" style={{ height: 11, width: '28%', borderRadius: 6 }} />
          <div className="kaya-skeleton" style={{ height: 11, width: '86%', borderRadius: 6 }} />
          <div className="kaya-skeleton" style={{ height: 11, width: '64%', borderRadius: 6 }} />
        </div>
      </div>

      {/* Action row */}
      <div style={{ height: PERSONA_CARD_HEIGHT * 0.15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 14, borderTop: '1px solid var(--neutral-100)' }}>
        <div className="kaya-skeleton" style={{ height: 28, width: 104, borderRadius: 14 }} />
      </div>
    </div>
  )
}

export default PersonaCardSkeleton
