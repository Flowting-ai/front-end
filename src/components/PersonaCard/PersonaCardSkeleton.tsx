'use client'

import React from 'react'
import { PERSONA_CARD_HEIGHT } from './index'

// Loading placeholder shaped like the full agent card (PersonaCard), measured off the real card:
// the hero image inset 6px (14px corners, 154px tall) with the 110px avatar and the ⋯ button on it,
// the name / "by" / two description lines in their real line boxes, and the bordered action row
// with the 93×32 "Use in chat" button — so the real cards replace it without anything moving.
// Uses the shared .kaya-skeleton pulse utility (globals.css).

const HERO_INSET = 6
const HERO_HEIGHT = 154
const ACTION_ROW_HEIGHT = 48

/** A pulse bar of `height` centred in a line box of `lineHeight`, like a line of text. */
function Line({ lineHeight, height, width }: { lineHeight: number; height: number; width: number | string }) {
  return (
    <div style={{ height: lineHeight, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="kaya-skeleton" style={{ height, width, borderRadius: 6 }} />
    </div>
  )
}

export function PersonaCardSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position:        'relative',
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
      {/* Hero image with the avatar centred on it and the ⋯ button top-right */}
      <div
        className="kaya-skeleton"
        style={{ position: 'relative', margin: HERO_INSET, marginBottom: 0, height: HERO_HEIGHT, flexShrink: 0, borderRadius: 14 }}
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
            opacity:         0.6,
          }}
        />
        <div
          style={{
            position:        'absolute',
            top:             6,
            right:           6,
            width:           26,
            height:          26,
            borderRadius:    9,
            backgroundColor: 'var(--agent-card-bg)',
            opacity:         0.6,
          }}
        />
      </div>

      {/* Name (18/24), "by" line (11/18), 8px gap, two description lines (11/16) */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 18px 0' }}>
        <Line lineHeight={24} height={16} width="56%" />
        <Line lineHeight={18} height={10} width={34} />
        <div style={{ height: 8 }} />
        <Line lineHeight={16} height={9} width="92%" />
        <Line lineHeight={16} height={9} width="68%" />
      </div>

      {/* Action row: the "Use in chat" button */}
      <div style={{ height: ACTION_ROW_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 14, borderTop: '1px solid var(--neutral-100)', boxSizing: 'border-box' }}>
        <div className="kaya-skeleton" style={{ height: 32, width: 93, borderRadius: 8 }} />
      </div>
    </div>
  )
}

export default PersonaCardSkeleton
