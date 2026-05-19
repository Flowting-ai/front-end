'use client'

import React from 'react'
import { CancelCircleIcon, ArrowRightOneIcon, RedoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopFailedCardProps {
  /** Name or short description of the step that caused the failure. */
  failedStep?:  string
  /** Technical error detail. */
  errorDetail?: string
  onTryAgain?:  () => void
  onRephrase?:  () => void
}

// ── LoopFailedCard ────────────────────────────────────────────────────────────

export function LoopFailedCard({
  failedStep,
  errorDetail = 'An unrecoverable error occurred. No output was produced.',
  onTryAgain,
  onRephrase,
}: LoopFailedCardProps) {
  return (
    <div style={{
      borderRadius:    12,
      padding:         20,
      border:          '1.5px solid var(--color-tag-Red-bg, #ffd1d1)',
      backgroundColor: 'var(--neutral-white)',
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          <CancelCircleIcon size={16} color="var(--color-tag-Red-text)" />
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-800)',
        }}>
          Brain couldn't complete this task
        </span>
      </div>

      {/* Error context */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-600)',
      }}>
        {failedStep ? (
          <><strong style={{ color: 'var(--neutral-700)' }}>{failedStep}</strong>{' — '}{errorDetail}</>
        ) : (
          errorDetail
        )}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onRephrase}>
          Rephrase task
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button
          variant="default"
          size="sm"
          leftIcon={<RedoIcon />}
          onClick={onTryAgain}
        >
          Try again
        </Button>
      </div>

    </div>
  )
}

LoopFailedCard.displayName = 'LoopFailedCard'
