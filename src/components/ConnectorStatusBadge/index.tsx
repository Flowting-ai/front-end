'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorStatusType =
  | 'active'
  | 'connected'
  | 'not-connected'
  | 'pending'
  | 'not-available'

export interface ConnectorStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ConnectorStatusType
}

// ── Config ────────────────────────────────────────────────────────────────────
// Uses existing KDS tag token system — no new colors invented.

const STATUS_CONFIG: Record<ConnectorStatusType, { bg: string; text: string; shadow: string; innerShadow: string; label: string }> = {
  'active':        { bg: 'var(--color-tag-Green-bg-soft)', text: 'var(--color-tag-Green-text)', shadow: 'var(--color-tag-Green-shadow)', innerShadow: 'var(--color-tag-Green-inner-shadow)', label: 'Active' },
  'connected':     { bg: 'var(--color-tag-Green-bg-soft)', text: 'var(--color-tag-Green-text)', shadow: 'var(--color-tag-Green-shadow)', innerShadow: 'var(--color-tag-Green-inner-shadow)', label: 'Connected' },
  'not-connected': { bg: 'var(--color-tag-Neutral-bg)',    text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow)', innerShadow: 'var(--color-tag-Neutral-inner-shadow)', label: 'Not connected' },
  'pending':       { bg: 'var(--color-tag-Yellow-bg)',     text: 'var(--color-tag-Yellow-text)', shadow: 'var(--color-tag-Yellow-shadow)', innerShadow: 'var(--color-tag-Yellow-inner-shadow)', label: 'Pending' },
  'not-available': { bg: 'var(--color-tag-Red-bg)',        text: 'var(--color-tag-Red-text)',    shadow: 'var(--color-tag-Red-shadow)',    innerShadow: 'var(--color-tag-Red-inner-shadow)',    label: 'Not available' },
}

// ── Component ─────────────────────────────────────────────────────────────────
// Identical structure to Badge — uses same shadow + inner overlay system.

export const ConnectorStatusBadge = React.forwardRef<HTMLSpanElement, ConnectorStatusBadgeProps>(
  function ConnectorStatusBadge({ status, className, style, ...props }, ref) {
    const cfg = STATUS_CONFIG[status]
    return (
      <span
        ref={ref}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '2px',
          borderRadius:    '6px',
          backgroundColor: cfg.bg,
          boxShadow:       cfg.shadow,
          overflow:        'clip',
          flexShrink:      0,
          ...style,
        }}
        {...props}
      >
        <span
          style={{
            padding:    '0 4px',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      cfg.text,
            whiteSpace: 'nowrap',
            position:   'relative',
          }}
        >
          {cfg.label}
        </span>
        <span
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            pointerEvents: 'none',
            borderRadius:  'inherit',
            boxShadow:     cfg.innerShadow,
          }}
        />
      </span>
    )
  },
)

ConnectorStatusBadge.displayName = 'ConnectorStatusBadge'
export default ConnectorStatusBadge
