'use client'

import React, { useState } from 'react'
import { UserIcon } from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersonaActiveBarProps {
  personaName:       string
  onChangePersona?:  () => void
  onRemovePersona?:  () => void
}

// ── Inline action ─────────────────────────────────────────────────────────────

function InlineAction({ label, onClick }: { label: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:  'none',
        border:      'none',
        padding:     0,
        cursor:      'pointer',
        fontFamily:  'var(--font-body)',
        fontSize:    'var(--font-size-caption)',
        lineHeight:  'var(--line-height-caption)',
        color:       hovered ? 'var(--neutral-600)' : 'var(--neutral-400)',
        transition:  'color 0.12s ease',
      }}
    >
      {label}
    </button>
  )
}

// ── PersonaActiveBar ──────────────────────────────────────────────────────────

export function PersonaActiveBar({
  personaName,
  onChangePersona,
  onRemovePersona,
}: PersonaActiveBarProps) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        8,
      padding:    '6px 0',
      flexWrap:   'wrap',
    }}>
      <span style={{ flexShrink: 0, lineHeight: 0 }}>
        <UserIcon size={12} color="var(--neutral-400)" />
      </span>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-400)',
      }}>
        Using
      </span>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-700)',
      }}>
        {personaName}
      </span>

      <InlineAction label="Change" onClick={onChangePersona} />

      <span
        aria-hidden
        style={{
          color:      'var(--neutral-300)',
          userSelect: 'none',
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
        }}
      >
        ·
      </span>

      <InlineAction label="Don't use" onClick={onRemovePersona} />
    </div>
  )
}

PersonaActiveBar.displayName = 'PersonaActiveBar'
