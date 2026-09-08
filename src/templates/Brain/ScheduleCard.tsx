'use client'

import React, { useState } from 'react'
import { CalendarThreeIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleCardProps {
  id:           string
  name:         string
  description?: string
  /** When this runs, in words — "Every 5 minutes", "Every weekday at 9:30 AM
   *  (America/Chicago)". Built by the backend (services/automations/schedule.py),
   *  shown verbatim. */
  frequency:    string
  isActive:     boolean
  /** Pre-formatted creation date, e.g. "January 5, 2026". */
  createdAt?:   string
  /** Brain chat permanently bound to this schedule (set once on create). */
  chatId?:      string
  onClick?:     (id: string) => void
}

// ── ScheduleCard — same shell (fixed height, boxShadow ring, title/description/
// divider/footer layout) as ProjectCard, so the two grids read as one system. ──

export function ScheduleCard({
  id,
  name,
  description,
  frequency,
  isActive,
  createdAt,
  onClick,
}: ScheduleCardProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const backgroundColor = focused
    ? 'rgba(74,131,191,0.07)'
    : hovered
      ? 'var(--neutral-50)'
      : 'var(--neutral-white)'

  const boxShadow = focused
    ? '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 2px var(--blue-300)'
    : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display:         'flex',
        flexDirection:   'column',
        height:          '220px',
        overflow:        'hidden',
        padding:         '20px',
        boxSizing:       'border-box',
        borderRadius:    '12px',
        backgroundColor,
        boxShadow,
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'background-color 120ms ease, box-shadow 120ms ease',
        outline:         'none',
        width:           '100%',
      }}
    >
      {/* Top row — "Created on" (left), status badge (right) — same slots as
          ProjectCard's "Created by" + visibility badge. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          {createdAt && (
            <span style={{
              fontFamily:   'var(--font-body)',
              fontWeight:   400,
              fontSize:     '11px',
              lineHeight:   '16px',
              color:        'var(--neutral-500)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              Created on {createdAt}
            </span>
          )}
        </div>
        <Badge color={isActive ? 'Green' : 'Neutral'} label={isActive ? 'Active' : 'Paused'} />
      </div>

      {/* Title */}
      <p style={{
        fontFamily:      'var(--font-title)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        '18px',
        lineHeight:      '24px',
        color:           'var(--neutral-900)',
        overflow:        'hidden',
        display:         '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        margin:          0,
        marginTop:       '8px',
        flexShrink:      0,
      }}>
        {name}
      </p>

      {/* Description — 3 lines max, same clamp/height cap as ProjectCard's */}
      <p style={{
        maxHeight:       '51px',
        flexShrink:      0,
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-regular)',
        fontSize:        '12px',
        lineHeight:      '17px',
        color:           'var(--neutral-500)',
        overflow:        'hidden',
        textOverflow:    'ellipsis',
        display:         '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        margin:          0,
        marginTop:       '10px',
      }}>
        {description ?? ''}
      </p>

      {/* Spacer — pushes the divider/footer to the bottom regardless of content above */}
      <div style={{ flex: '1 1 auto', minHeight: 12 }} />

      {/* Divider */}
      <div style={{ height: 1, width: '100%', backgroundColor: 'var(--divider-color)', flexShrink: 0 }} />

      {/* Footer — frequency, icon + text (same meta-row style as ProjectCard's member/chat counts) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--neutral-400)', minWidth: 0 }}>
          <CalendarThreeIcon size={14} />
          <span style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     '12px',
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {frequency}
          </span>
        </div>
      </div>
    </button>
  )
}

ScheduleCard.displayName = 'ScheduleCard'
