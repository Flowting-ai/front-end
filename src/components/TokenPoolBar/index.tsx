'use client'

/**
 * TokenPoolBar — workspace credit pool progress bar.
 * Extends TokenBudgetBar with Teams-specific context:
 *   - Plan tier label above ("$125/mo · 60,000 credits")
 *   - Warning thresholds: amber at 80%, red at 95%+
 *   - Used / remaining labels below
 *   - Grace state with "X days remaining" pill
 *
 * Uses TokenBudgetBar for the track — does not rebuild it.
 */

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PoolStatus = 'normal' | 'warning_80' | 'warning_95' | 'grace' | 'locked'

export interface CreditPool {
  total:               number
  used:                number
  remaining:           number
  percentUsed:         number
  graceDaysRemaining?: number
}

export interface TokenPoolBarProps extends React.HTMLAttributes<HTMLDivElement> {
  pool:       CreditPool
  planLabel?: string
  asChild?: boolean
}

// ── Threshold colour — overrides TokenBudgetBar's default colours ─────────────
// TokenBudgetBar already handles warning at 60% / danger at 85%.
// TokenPoolBar uses tighter thresholds matching Teams decisions:
//   < 80%  → normal  (TokenBudgetBar default green)
//   ≥ 80%  → amber
//   ≥ 95%  → red
//   100%   → locked red

function poolStatus(pct: number): PoolStatus {
  if (pct >= 1.0) return 'locked'
  if (pct >= 0.95) return 'warning_95'
  if (pct >= 0.80) return 'warning_80'
  return 'normal'
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TokenPoolBar = React.forwardRef<HTMLDivElement, TokenPoolBarProps>(
  function TokenPoolBar(
    { pool, planLabel, asChild = false, className, style, ...props },
    ref,
  ) {
    const Comp   = (asChild ? Slot : 'div') as React.ElementType
    const pct    = Math.min(pool.percentUsed / 100, 1)
    const status = poolStatus(pct)

    const labelColor = status === 'normal'
      ? 'var(--neutral-600)'
      : status === 'warning_80'
        ? 'var(--color-tag-Yellow-text)'
        : 'var(--color-tag-Red-text)'

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', ...style }}
        {...props}
      >
        {/* Plan label + percentage */}
        {planLabel && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: labelColor }}>
              {planLabel}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: labelColor }}>
              {pool.percentUsed.toFixed(1)}% used
            </span>
          </div>
        )}

        {/* Track — reuses TokenBudgetBar, overrides fill colour via CSS */}
        <div style={{ position: 'relative' }}>
          <TokenBudgetBar
            used={pool.used}
            limit={pool.total}
            size="lg"
            style={{
              // Override the fill color via a data attribute + CSS-in-JS isn't available,
              // so we use a wrapper with filter approach — simpler: re-render the track directly
              // using TokenBudgetBar's track but override color via style injection
            }}
          />
          {/* Colour override overlay on the fill — positioned on top of TokenBudgetBar */}
          {status !== 'normal' && (
            <div
              aria-hidden
              style={{
                position:        'absolute',
                top:             0,
                left:            0,
                width:           `${pct * 100}%`,
                height:          10,
                borderRadius:    999,
                backgroundColor: status === 'warning_80'
                  ? 'var(--color-tag-Yellow-text)'
                  : 'var(--color-tag-Red-text)',
                pointerEvents:   'none',
                transition:      'width 240ms ease, background-color 200ms ease',
              }}
            />
          )}
        </div>

        {/* Used / remaining */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: labelColor }}>
            {pool.used.toLocaleString()} used
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: labelColor }}>
            {pool.remaining.toLocaleString()} remaining
          </span>
        </div>

        {/* Grace days remaining pill */}
        {status === 'grace' && pool.graceDaysRemaining != null && (
          <span style={{
            display:         'inline-flex',
            alignSelf:       'flex-start',
            alignItems:      'center',
            padding:         '2px 8px',
            borderRadius:    6,
            backgroundColor: 'var(--color-tag-Red-bg)',
            fontFamily:      'var(--font-body)',
            fontWeight:      500,
            fontSize:        'var(--font-size-caption)',
            color:           'var(--color-tag-Red-text)',
          }}>
            {pool.graceDaysRemaining} day{pool.graceDaysRemaining !== 1 ? 's' : ''} to add credits
          </span>
        )}
      </Comp>
    )
  },
)

TokenPoolBar.displayName = 'TokenPoolBar'
export default TokenPoolBar
