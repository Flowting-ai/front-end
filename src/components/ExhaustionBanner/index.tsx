'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useCreditStatus } from '@/hooks/use-credit-status'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { TokenCircleIcon } from '@strange-huge/icons'

// Wraps the ChatInput with an orange container and a credit status row when
// individual credits apply. Renders children directly when not applicable.

export function ExhaustionBanner({ children }: { children?: React.ReactNode }) {
  const { applies, level, pctUsed } = useCreditStatus()
  const router = useRouter()

  if (!applies || pctUsed < 0.9) return <>{children}</>

  const pct        = Math.min(1, Math.max(0, pctUsed))
  const pctDisplay = `${Math.round(pct * 100)}% used`

  const textColor = level === 'normal'
    ? 'var(--neutral-500)'
    : level === 'low'
      ? '#b45309'
      : '#b91c1c'

  return (
    <div
      style={{
        width:           '100%',
        borderRadius:    28,
        backgroundColor: 'rgba(251, 146, 60, 0.10)',
        border:          '1px solid rgba(251, 146, 60, 0.18)',
        padding:         '0 4px 4px',
        boxSizing:       'border-box',
      }}
    >
      {/* ── Banner row ── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            8,
          padding:        '4px 4% 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <TokenCircleIcon size={14} animated color="var(--color-tag-Red-text)" />
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '14px',
              color:      'var(--color-tag-Red-text)',
            }}
          >
            You've consumed {Math.round(pct * 100)}% of your credits
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            size="sm"
            variant={level === 'normal' ? 'outline' : 'default'}
            onClick={() => router.push('/settings/billing')}
          >
            <span className="text-xs">Top up</span>
          </Button>
          <Badge label={pctDisplay} color="Red" />
        </div>
      </div>

      {/* ── Chat input ── */}
      {children}
    </div>
  )
}

ExhaustionBanner.displayName = 'ExhaustionBanner'
export default ExhaustionBanner
