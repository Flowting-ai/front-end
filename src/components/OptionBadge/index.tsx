'use client'

import React from 'react'
import { PenOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OptionBadgeVariant = 'number' | 'edit'

export interface OptionBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'number' - numbered single-select / rank badge. 'edit' - pencil for open-ended footer row. */
  variant?: OptionBadgeVariant
  num?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OUTER_SHADOW  = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)'
const INNER_SHADOW  = 'inset 0px 1px 0px 0px rgba(247,242,237,0.61), inset 0px -1px 0px 0px rgba(106,98,93,0.05)'

// ── Component ──────────────────────────────────────────────────────────────────

export function OptionBadge({ ref, variant = 'number', num = 1, className, ...props }: OptionBadgeProps & { ref?: React.Ref<HTMLDivElement> }) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           28,
          height:          28,
          flexShrink:      0,
          borderRadius:    8,
          overflow:        'clip',
          boxShadow:       OUTER_SHADOW,
          padding:         '5px 8px',
        }}
        {...props}
      >
        {/* Warm beige fill */}
        <div
          aria-hidden
          style={{
            position:        'absolute',
            inset:           0,
            borderRadius:    8,
            backgroundColor: 'rgba(237,225,215,0.6)',
            pointerEvents:   'none',
          }}
        />

        {variant === 'number' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', position: 'relative', flexShrink: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body, 14px)', lineHeight: 'var(--line-height-body, 22px)', color: 'var(--neutral-700, #524b47)', margin: 0, whiteSpace: 'nowrap' }}>
              {num}
            </p>
          </div>
        )}

        {variant === 'edit' && (
          <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0, overflow: 'clip' }}>
            <PenOneIcon size={16} color="var(--neutral-600, #6a625d)" />
          </div>
        )}

        {/* Inner depth shadow */}
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: INNER_SHADOW, pointerEvents: 'none' }}
        />
      </div>
    )
}

OptionBadge.displayName = 'OptionBadge'
export default OptionBadge
