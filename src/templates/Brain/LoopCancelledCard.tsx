'use client'

import React from 'react'
import { StopCircleIcon } from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopCancelledCardProps {
  completedSteps?: number
  totalSteps?:     number
  context?:        string
}

// ── LoopCancelledCard ─────────────────────────────────────────────────────────

export function LoopCancelledCard({
  completedSteps,
  totalSteps,
  context = "No output was produced.",
}: LoopCancelledCardProps) {
  const hasProgress = completedSteps != null && totalSteps != null

  return (
    <div style={{
      borderRadius:    12,
      padding:         20,
      border:          '1px solid var(--neutral-200)',
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      backgroundColor: 'var(--neutral-white)',
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          <StopCircleIcon size={16} color="var(--neutral-400)" />
        </span>
        <span style={{
          flex:        '1 0 0',
          fontFamily:  'var(--font-body)',
          fontSize:    'var(--font-size-body)',
          fontWeight:  'var(--font-weight-medium)',
          lineHeight:  'var(--line-height-body)',
          color:       'var(--neutral-700)',
        }}>
          Loop cancelled
        </span>
        {hasProgress && (
          <span style={{
            flexShrink:  0,
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-caption)',
            lineHeight:  'var(--line-height-caption)',
            color:       'var(--neutral-400)',
          }}>
            {completedSteps} of {totalSteps} steps completed
          </span>
        )}
      </div>

      {/* Context */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-500)',
      }}>
        {context}
      </p>

    </div>
  )
}

LoopCancelledCard.displayName = 'LoopCancelledCard'
