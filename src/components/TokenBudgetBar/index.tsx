'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenBudgetBarSize = 'sm' | 'lg'

export interface TokenBudgetBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tokens consumed so far. */
  used:  number
  /** Total budget. */
  limit: number
  /** sm = 6px track (in-card), lg = 10px track (in-drawer). */
  size?: TokenBudgetBarSize
  /** When true, renders the `64% used · 32K / 50K tok` row beneath the bar. */
  showLabel?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function colourForPct(pct: number): { fill: string, text: string } {
  if (pct >= 0.85) return { fill: '#ef4444', text: '#b91c1c' }
  if (pct >= 0.60) return { fill: '#f59e0b', text: '#b45309' }
  return                 { fill: '#22c55e', text: '#15803d' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TokenBudgetBar({ ref, used, limit, size = 'sm', showLabel = false, className, style, ...props }: TokenBudgetBarProps & { ref?: React.Ref<HTMLDivElement> }) {
    const pct  = limit > 0 ? Math.max(0, Math.min(used / limit, 1)) : 0
    const col  = colourForPct(pct)
    const h    = size === 'lg' ? 10 : 6

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label={`${Math.round(pct * 100)}% of credit budget used`}
        className={cn(className)}
        style={{ display: 'flex', flexDirection: 'column', gap: showLabel ? 4 : 0, width: '100%', ...style }}
        {...props}
      >
        <div
          style={{
            height:          h,
            borderRadius:    999,
            backgroundColor: 'var(--neutral-100)',
            overflow:        'hidden',
          }}
        >
          <div
            style={{
              width:           `${pct * 100}%`,
              height:          '100%',
              backgroundColor: col.fill,
              borderRadius:    999,
              transition:      'width 240ms ease, background-color 200ms ease',
            }}
          />
        </div>
        {showLabel && (
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              fontFamily:     'var(--font-body)',
              fontSize:       'var(--font-size-caption)',
              lineHeight:     'var(--line-height-caption)',
            }}
          >
            <span style={{ color: col.text, fontWeight: 'var(--font-weight-medium)' }}>
              {Math.round(pct * 100)}% used
            </span>
            <span style={{ color: 'var(--neutral-500)' }}>
              {fmtK(used)} / {fmtK(limit)} credits
            </span>
          </div>
        )}
      </div>
    )
}

TokenBudgetBar.displayName = 'TokenBudgetBar'
export default TokenBudgetBar
