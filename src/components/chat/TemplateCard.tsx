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
}

export function TemplateCard({ icon, label, onClick }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:          1,
        background:    'var(--neutral-white)',
        border:        `1px solid ${hovered ? 'var(--neutral-300)' : 'var(--neutral-200)'}`,
        borderRadius:  '12px',
        padding:       '14px 12px',
        cursor:        'pointer',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-start',
        gap:           '10px',
        textAlign:     'left',
        boxShadow:     hovered ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
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
