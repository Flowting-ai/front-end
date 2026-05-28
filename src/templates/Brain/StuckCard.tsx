'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { AlertCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { springs } from '@/lib/springs'

const CARD_SHADOW = 'var(--shadow-card-default)'

export interface StuckCardProps {
  /** Why Brain is stuck — displayed as the main message. */
  reason:       string
  /** Optional suggested action the user could take. */
  suggestion?:  string
  /** Called when user clicks "Send context" and submits clarification. */
  onProvideContext?: (text: string) => void
  /** Called when user clicks "Cancel loop". */
  onCancel?: () => void
}

export function StuckCard({ reason, suggestion, onProvideContext, onCancel }: StuckCardProps) {
  const [inputValue, setInputValue] = React.useState('')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={springs.moderate}
      style={{
        backgroundColor: 'var(--neutral-white)',
        borderRadius:    12,
        padding:         '14px 16px',
        boxShadow:       CARD_SHADOW,
        display:         'flex',
        flexDirection:   'column',
        gap:             12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircleIcon size={14} color="var(--color-tag-Yellow-text)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-600)',
        }}>
          I need your help to continue
        </span>
      </div>

      {/* Reason */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-800)',
      }}>
        {reason}
      </p>

      {/* Suggestion */}
      {suggestion && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-500)',
        }}>
          {suggestion}
        </p>
      )}

      {/* Input for context */}
      {onProvideContext && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Provide more context or clarification…"
            rows={2}
            style={{
              fontFamily:      'var(--font-body)',
              fontSize:        'var(--font-size-body)',
              lineHeight:      'var(--line-height-body)',
              color:           'var(--neutral-800)',
              border:          '1px solid var(--neutral-200)',
              borderRadius:    8,
              padding:         '8px 12px',
              resize:          'none',
              outline:         'none',
              backgroundColor: 'var(--neutral-50)',
              width:           '100%',
              boxSizing:       'border-box' as React.CSSProperties['boxSizing'],
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel loop
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={!inputValue.trim()}
              onClick={() => { onProvideContext(inputValue); setInputValue('') }}
            >
              Send context
            </Button>
          </div>
        </div>
      )}

      {/* No-input variant — just cancel */}
      {!onProvideContext && onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel loop
          </Button>
        </div>
      )}
    </motion.div>
  )
}

StuckCard.displayName = 'StuckCard'
