'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UsageLimitStripProps {
  /** Fraction consumed (0..1). Values outside range are clamped. */
  pctUsed: number
  /** Credits remaining — null if unavailable. */
  remaining: number | null
  /** Total credit allocation — null if unavailable. */
  total: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────


export type UsageLevel = 'normal' | 'warning' | 'danger' | 'exhausted'

export function resolveUsageLevel(pct: number): UsageLevel {
  if (pct >= 1)    return 'exhausted'
  if (pct >= 0.9)  return 'danger'
  if (pct >= 0.75) return 'warning'
  return 'normal'
}

// KDS tag palette — same tokens used by Chip, OrgBadge, CreditStatusBanner.
export const USAGE_LEVEL_TOKENS: Record<UsageLevel, { bg: string; text: string }> = {
  normal:    { bg: 'var(--color-tag-Neutral-bg)',     text: 'var(--color-tag-Neutral-text)' },
  warning:   { bg: 'var(--color-tag-Yellow-bg-soft)', text: 'var(--color-tag-Yellow-text)'  },
  danger:    { bg: 'var(--color-tag-Red-bg-soft)',    text: 'var(--color-tag-Red-text)'     },
  exhausted: { bg: 'var(--color-tag-Red-bg-soft)',    text: 'var(--color-tag-Red-text)'     },
}

// ── Component ──────────────────────────────────────────────────────────────────
// Renders as the top strip row inside the encasing border container.
// The border itself lives on the parent wrapper in ChatInterface so that it
// wraps both this strip and the ChatInput as one visual unit.

export function UsageLimitStrip({ pctUsed, remaining, total }: UsageLimitStripProps) {
  const router = useRouter()
  const [topUpHovered, setTopUpHovered] = React.useState(false)
  const pct    = Math.min(Math.max(pctUsed, 0), 1)
  const level  = resolveUsageLevel(pct)
  const tokens = USAGE_LEVEL_TOKENS[level]

  const pctDisplay = Math.round(pct * 100)

  // Left: generic usage message
  const leftText = pct >= 1
    ? "You've reached 100% of your plan's usage limit"
    : `You've consumed ${pctDisplay}% of your plan's usage limit`

  // Right chip: percentage
  const rightText = `${pctDisplay}% used`

  const baseText: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   'var(--font-size-caption)',
    lineHeight: 'var(--line-height-caption)',
    color:      tokens.text,
    whiteSpace: 'nowrap',
  }

  const chipStyle: React.CSSProperties = {
    flexShrink:      0,
    display:         'inline-flex',
    alignItems:      'center',
    padding:         '2px 8px',
    borderRadius:    '6px',
    fontFamily:      'var(--font-body)',
    fontWeight:      500,
    fontSize:        'var(--font-size-caption)',
    lineHeight:      'var(--line-height-caption)',
    whiteSpace:      'nowrap',
  }

  return (
    <div
      role="status"
      aria-label={`${rightText}. ${leftText}`}
      style={{
        width:      '100%',
        display:    'flex',
        alignItems: 'center',
        gap:        '10px',
        padding:    '7px 16px',
      }}
    >
      {/* Left — usage message */}
      <span style={{ ...baseText, fontWeight: 500, flex: '1 1 0', minWidth: 0 }}>
        {leftText}
      </span>

      {/* Top up credits — actionable chip */}
      <button
        type="button"
        onClick={() => router.push('/settings/billing')}
        onMouseEnter={() => setTopUpHovered(true)}
        onMouseLeave={() => setTopUpHovered(false)}
        style={{
          ...chipStyle,
          backgroundColor: topUpHovered ? tokens.text : tokens.bg,
          boxShadow:       'none',
          border:          `1px solid ${tokens.text}`,
          color:           topUpHovered ? 'var(--neutral-white)' : tokens.text,
          cursor:          'pointer',
          transition:      'background-color 0.12s ease, color 0.12s ease',
        }}
      >
        Buy more credits
      </button>

      {/* Percentage — red indicator chip */}
      <span style={{
        flexShrink:      0,
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '2px 8px',
        borderRadius:    '6px',
        backgroundColor: 'var(--color-tag-Red-bg)',
        boxShadow:       'var(--color-tag-Red-shadow)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        'var(--font-size-caption)',
        lineHeight:      'var(--line-height-caption)',
        color:           'var(--color-tag-Red-text)',
        whiteSpace:      'nowrap',
      }}>
        {rightText}
      </span>
    </div>
  )
}

UsageLimitStrip.displayName = 'UsageLimitStrip'
export default UsageLimitStrip
