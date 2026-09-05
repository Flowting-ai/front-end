'use client'

import React, { useState } from 'react'
import { Chip } from '@/components/Chip'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleCardProps {
  id:           string
  name:         string
  description?: string
  /** When this runs, in words — "Every 5 minutes", "Every weekday at 9:30 AM
   *  (America/Chicago)". Built by the backend (services/automations/schedule.py),
   *  shown as the chip label verbatim. */
  frequency:    string
  isActive:     boolean
  /** Brain chat permanently bound to this schedule (set once on create). */
  chatId?:      string
  onClick?:     (id: string) => void
}

// ── ScheduleCard ──────────────────────────────────────────────────────────────

export function ScheduleCard({
  id,
  name,
  description,
  frequency,
  isActive,
  onClick,
}: ScheduleCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        flexDirection:   'column',
        gap:             10,
        padding:         16,
        borderRadius:    12,
        border:          hovered ? '1px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
        backgroundColor: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'border-color 150ms ease, background-color 150ms ease',
        boxSizing:       'border-box',
        width:           '100%',
      }}
    >
      {/* Name row + active indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          flex:         '1 0 0',
          minWidth:     0,
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body)',
          fontWeight:   'var(--font-weight-medium)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--neutral-800)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {name}
        </span>

        {/* Active dot */}
        {isActive && (
          <span
            aria-label="Active"
            style={{
              width:           7,
              height:          7,
              borderRadius:    '50%',
              backgroundColor: 'var(--color-tag-Green-text, #1e8a3c)',
              flexShrink:      0,
            }}
          />
        )}
      </div>

      {/* Description */}
      {description && (
        <span style={{
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--font-size-caption)',
          lineHeight:      'var(--line-height-caption)',
          color:           'var(--neutral-500)',
          display:         '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
        }}>
          {description}
        </span>
      )}

      {/* Frequency chip */}
      <Chip size="Small" color={isActive ? 'Green' : 'Neutral'} label={frequency} />

    </button>
  )
}

ScheduleCard.displayName = 'ScheduleCard'
