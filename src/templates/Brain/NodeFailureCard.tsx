'use client'

import React from 'react'
import { AlertTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import type { PlanStep } from './lib/phase'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NodeFailureCardProps {
  step:       Pick<PlanStep, 'label' | 'isCritical'>
  errorMessage?: string
  onRerun?:   () => void
  /** Only available when step.isCritical === false */
  onSkip?:    () => void
  onCancel?:  () => void
}

// ── NodeFailureCard ───────────────────────────────────────────────────────────

export function NodeFailureCard({
  step,
  errorMessage,
  onRerun,
  onSkip,
  onCancel,
}: NodeFailureCardProps) {
  return (
    <div style={{
      backgroundColor: 'var(--color-tag-Red-bg)',
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
        <AlertTwoIcon size={14} color="var(--color-tag-Red-text)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--color-tag-Red-text)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          Step failed
        </span>
        {step.isCritical && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--neutral-400)',
            lineHeight: 'var(--line-height-caption)',
            marginLeft: 2,
          }}>
            · Critical
          </span>
        )}
      </div>

      {/* Step label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-800)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {step.label}
        </span>
        {errorMessage && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--neutral-500)',
            lineHeight: 'var(--line-height-caption)',
          }}>
            {errorMessage}
          </span>
        )}
      </div>

      {/* Actions — Re-run always, Skip only if non-critical */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div style={{ flex: '1 0 0' }} />
        {!step.isCritical && (
          <Button variant="outline" size="sm" onClick={onSkip}>
            Skip step
          </Button>
        )}
        <Button variant="default" size="sm" onClick={onRerun}>
          Re-run
        </Button>
      </div>
    </div>
  )
}

NodeFailureCard.displayName = 'NodeFailureCard'
