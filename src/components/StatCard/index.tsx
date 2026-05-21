'use client'

import React from 'react'
import { Eyebrow } from '@/components/Eyebrow'
import { DeltaPill, type DeltaTrend } from '@/components/DeltaPill'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Uppercase Eyebrow label, e.g. "Tokens this month". */
  label: string
  /** Display value, e.g. "12,408" or "$48.6k". */
  value: React.ReactNode
  /** Optional delta + trend. */
  delta?:     string
  deltaTrend?: DeltaTrend
  /** Caption beneath the delta, e.g. "vs. last 30d". */
  sub?:        React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatCard(
  { label, value, delta, deltaTrend = 'up', sub, className, style, ref, ...props }: StatCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [hovered, setHovered] = React.useState(false)

    return (
      <div
        ref={ref}
        className={cn(className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          isolation:       'isolate',
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          gap:             8,
          padding:         '16px 18px',
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       hovered ? 'var(--shadow-surface-card-hover)' : 'var(--shadow-surface-card)',
          transition:      'box-shadow 150ms ease',
          minWidth:        0,
          ...style,
        }}
        {...props}
      >
        <Eyebrow>{label}</Eyebrow>

        <div
          style={{
            fontFamily:    'var(--font-title)',
            fontSize:      'var(--font-size-heading)',
            lineHeight:    'var(--line-height-heading)',
            fontWeight:    'var(--font-weight-medium)',
            color:         'var(--neutral-900)',
          }}
        >
          {value}
        </div>

        {(delta || sub) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {delta && <DeltaPill trend={deltaTrend} value={delta} />}
            {sub && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-500)',
                }}
              >
                {sub}
              </span>
            )}
          </div>
        )}
      </div>
    )
}

StatCard.displayName = 'StatCard'
export default StatCard
