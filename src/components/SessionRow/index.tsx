'use client'

import React from 'react'
import { Badge } from '@/components/Badge'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'ended'

export interface SessionRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 1-indexed session number, rendered inside the lead avatar. */
  num:        number
  /** Pre-formatted time, e.g. "Today, 2:14 PM". */
  time:       string
  /** Message count for the session. */
  messages:   number
  /** Token usage for the session (already in token-count units). */
  tokens:     number
  status:     SessionStatus
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionRow({ num, time, messages, tokens, status, className, style, ref, ...props }: SessionRowProps & { ref?: React.Ref<HTMLDivElement> }) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          padding:        '12px 0',
          ...style,
        }}
        {...props}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           28,
              height:          28,
              borderRadius:    '50%',
              backgroundColor: 'var(--neutral-50)',
              boxShadow:       '0 0 0 1px var(--neutral-100)',
              color:           'var(--neutral-500)',
              fontFamily:      'var(--font-body)',
              fontSize:        'var(--font-size-caption)',
              lineHeight:      'var(--line-height-caption)',
              fontWeight:      'var(--font-weight-medium)',
              flexShrink:      0,
            }}
          >
            {num}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)',
                fontWeight: 'var(--font-weight-medium)',
                color:      'var(--neutral-900)',
              }}
            >
              {time}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-500)',
              }}
            >
              {messages} messages · {fmtK(tokens)} tokens
            </span>
          </div>
        </div>
        <Badge
          color={status === 'active' ? 'Green' : 'Neutral'}
          label={status === 'active' ? 'Active' : 'Ended'}
        />
      </div>
    )
}

SessionRow.displayName = 'SessionRow'
export default SessionRow
