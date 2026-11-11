'use client'

import React from 'react'
import { AlertTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { CARD_RADIUS } from './card-metrics'

export interface ModelUnavailableOverlayProps {
  isDraft: boolean
  reason: 'blocked' | 'retired'
  modelName?: string | null
  onChangeModel?: () => void
}

export function ModelUnavailableOverlay({ isDraft, reason, modelName, onChangeModel }: ModelUnavailableOverlayProps) {
  return (
    <>
      <div
        aria-hidden
        style={{
          position:        'absolute',
          inset:           0,
          borderRadius:    CARD_RADIUS,
          backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--agent-card-bg)',
          // Carries the whole dim now that the content div no longer
          // fades itself (see the pointerEvents note above).
          opacity:         0.72,
          zIndex:          1,
        }}
      />
      <div
        style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            10,
          padding:        16,
          textAlign:      'center',
          zIndex:         2,
        }}
      >
        <AlertTwoIcon animated size={20} color="var(--color-tag-Yellow-text)" />
        <p
          style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}
        >
          {modelName
            ? reason === 'blocked'
              ? `${modelName} is turned off.`
              : `${modelName} is no longer available.`
            : reason === 'blocked'
              ? 'This agent’s model is turned off.'
              : 'This agent’s model is no longer available.'}
        </p>
        {onChangeModel && (
          <Button variant="ghost" size="sm" onClick={onChangeModel}>
            Change model
          </Button>
        )}
      </div>
    </>
  )
}
