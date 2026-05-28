'use client'

import React, { useState } from 'react'
import { Chip } from '@/components/Chip'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleCardProps {
  id:           string
  name:         string
  description?: string
  /** Human-readable or raw frequency string — e.g. "Daily · 08:00", "Weekly · Monday · 08:00",
   *  "Daily • 8:00 AM", "Daily", "Scheduled". The chip label is derived by parseFrequency. */
  frequency:    string
  isActive:     boolean
  /** Brain chat permanently bound to this schedule (set once on create). */
  chatId?:      string
  onClick?:     (id: string) => void
}

// ── parseFrequency ─────────────────────────────────────────────────────────────
// Derives a display label from whatever frequency string is stored.
//
// Handled patterns:
//   "Daily · 08:00"              → "Daily • 8:00 AM"
//   "Weekly · Monday · 08:00"    → "Weekly • Monday 8:00 AM"
//   "Daily • 8:00 AM"            → pass-through (already correct)
//   "Weekly • Monday 8:00 AM"    → pass-through
//   "daily" / "Daily" (no time)  → "Daily"
//   "weekly" / "Weekly" (no time)→ "Weekly"
//   anything else                → returned as-is

function parseFrequency(frequency: string, name?: string, description?: string): string {
  const src = frequency || name || description || ''
  const lc  = src.toLowerCase()

  const isDaily  = /\bdaily\b/.test(lc)
  const isWeekly = /\bweekly\b/.test(lc)

  if (!isDaily && !isWeekly) return frequency || src

  // Try to extract HH:MM with optional AM/PM from the frequency string first,
  // then fall back to scanning name / description for a time component.
  const TIME_RE = /(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i
  const timeMatch = src.match(TIME_RE)
    ?? [name, description].filter(Boolean).join(' ').match(TIME_RE)

  if (!timeMatch) return isDaily ? 'Daily' : 'Weekly'

  return formatLabel(isDaily, isWeekly, src, timeMatch)
}

function formatLabel(
  isDaily: boolean,
  isWeekly: boolean,
  src: string,
  timeMatch: RegExpMatchArray,
): string {
  let hour     = parseInt(timeMatch[1], 10)
  const minute = timeMatch[2]
  const ampm   = timeMatch[3]?.toUpperCase()

  // Convert to 24-hour if an explicit AM/PM was given
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  const period = hour < 12 ? 'AM' : 'PM'
  const h12    = hour % 12 === 0 ? 12 : hour % 12
  const time   = `${h12}:${minute} ${period}`

  if (isDaily) return `Daily • ${time}`

  // Weekly — extract day name from src
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const day  = DAYS.find(d => src.toLowerCase().includes(d.toLowerCase()))
  return day ? `Weekly • ${day} ${time}` : `Weekly • ${time}`
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
  const chipLabel = parseFrequency(frequency, name, description)

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
      <Chip size="Small" color={isActive ? 'Green' : 'Neutral'} label={chipLabel} />

    </button>
  )
}

ScheduleCard.displayName = 'ScheduleCard'
