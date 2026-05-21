'use client'

import React from 'react'
import { StopCircleIcon, ArrowRightOneIcon, PenOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PauseCardProps {
  /** Label of the step Brain just finished before pausing. */
  pausedAfterStep?: string
  onContinue?:      () => void
  /** Sends the user back to ChatInput to retype a counter-direction. */
  onChangeDirection?: () => void
  onCancel?:        () => void
}

// ── PauseCard ─────────────────────────────────────────────────────────────────

export function PauseCard({
  pausedAfterStep,
  onContinue,
  onChangeDirection,
  onCancel,
}: PauseCardProps) {
  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    24,
      padding:         20,
      boxShadow:       CARD_SHADOW,
      maxWidth:        '100%',
      display:         'flex',
      flexDirection:   'column',
      gap:             14,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StopCircleIcon size={14} color="var(--neutral-400)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          Paused
        </span>
      </div>

      {/* Body */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        color:      'var(--neutral-700)',
        lineHeight: 'var(--line-height-body)',
      }}>
        {pausedAfterStep
          ? <>Brain finished <strong style={{ fontWeight: 'var(--font-weight-medium)' }}>{pausedAfterStep}</strong> and is waiting for your go-ahead.</>
          : 'Brain has paused and is waiting for your go-ahead.'
        }
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button
          variant="outline"
          size="sm"
          rightIcon={<PenOneIcon />}
          onClick={onChangeDirection}
        >
          Change direction
        </Button>
        {/* eslint-disable-next-line react-doctor/design-no-vague-button-label -- "Continue" resumes paused workflow; PauseCard context makes action clear */}
        <Button
          variant="default"
          size="sm"
          rightIcon={<ArrowRightOneIcon />}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

PauseCard.displayName = 'PauseCard'
