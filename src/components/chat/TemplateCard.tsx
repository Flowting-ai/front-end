'use client'

import React, { useState } from 'react'

// ── Template card ─────────────────────────────────────────────────────────────
// Shared by chat/page.tsx and project/[id]/chat/[chatId]/page.tsx — both had
// an identical copy of this "pick a starting template" card. Distinct from
// agents/templates/page.tsx's own TemplateCard, which takes a different prop
// shape ({ name }, not { icon, label }) for a different kind of card.

export interface TemplateCardProps {
  icon:    React.ReactNode
  label:   string
  onClick: () => void
  /** `tile` = icon above label (3-up grid). `row` = icon beside label (stacked list). @default 'tile' */
  layout?: 'tile' | 'row'
  /** Drops the card background, border and shadow. */
  bare?:   boolean
}

export function TemplateCard({ icon, label, onClick, layout = 'tile', bare = false }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false)
  const isRow = layout === 'row'
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:          1,
        background:    bare ? 'transparent' : 'var(--neutral-white)',
        border:        bare ? '1px solid transparent' : `1px solid ${hovered ? 'var(--neutral-300)' : 'var(--neutral-200)'}`,
        borderRadius:  '12px',
        padding:       isRow ? '12px' : '14px 12px',
        cursor:        'pointer',
        display:       'flex',
        flexDirection: isRow ? 'row' : 'column',
        alignItems:    isRow ? 'center' : 'flex-start',
        gap:           isRow ? '12px' : '10px',
        textAlign:     'left',
        boxShadow:     bare ? 'none' : hovered ? '0 2px 8px color-mix(in srgb, var(--static-black) 8%, transparent)' : '0 1px 3px color-mix(in srgb, var(--static-black) 4%, transparent)',
        transition:    'box-shadow 150ms, border-color 150ms',
        minWidth:      0,
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize:   '13px',
          fontWeight: 500,
          color:      'var(--neutral-700)',
          margin:     0,
          lineHeight: 1.4,
        }}
      >
        {label}
      </p>
    </button>
  )
}

export default TemplateCard
