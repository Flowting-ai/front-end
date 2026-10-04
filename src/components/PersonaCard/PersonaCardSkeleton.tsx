'use client'

import React from 'react'
import { PERSONA_CARD_HEIGHT } from './index'

// Loading placeholder shaped like the full agent card (PersonaCard): same height, radius and
// layout — a round avatar with its halo, a centred name, two description lines and the
// footer (status badge left, "Created by" right) — so the real cards replace it without the
// grid shifting. Uses the shared .kaya-skeleton pulse utility (globals.css).

export function PersonaCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width:           '100%',
        height:          PERSONA_CARD_HEIGHT,
        boxSizing:       'border-box',
        borderRadius:    16,
        padding:         12,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--agent-card-bg)',
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
        ...style,
      }}
    >
      {/* Identity block, centred like the card's */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div className="kaya-skeleton" style={{ width: 88, height: 88, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          <div className="kaya-skeleton" style={{ height: 14, width: '46%', borderRadius: 6 }} />
          <div className="kaya-skeleton" style={{ height: 11, width: '80%', borderRadius: 6 }} />
          <div className="kaya-skeleton" style={{ height: 11, width: '56%', borderRadius: 6 }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--neutral-100)' }}>
        <div className="kaya-skeleton" style={{ height: 20, width: 56, borderRadius: 10 }} />
        <div className="kaya-skeleton" style={{ height: 11, width: 92, borderRadius: 6 }} />
      </div>
    </div>
  )
}

export default PersonaCardSkeleton
