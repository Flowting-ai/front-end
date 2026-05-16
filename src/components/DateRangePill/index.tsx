'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DateRangePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pre-formatted range, e.g. "Mar 27 – Apr 25". */
  label: string
  /** Status dot colour. Defaults to success. Pass a token expression. */
  dotColor?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DateRangePill = React.forwardRef<HTMLButtonElement, DateRangePillProps>(
  function DateRangePill({ label, dotColor, className, style, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn('kds-date-range-pill', className)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             8,
          padding:         '6px 12px',
          borderRadius:    8,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       'var(--shadow-surface-card)',
          color:           'var(--neutral-700)',
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--font-size-caption)',
          lineHeight:      'var(--line-height-caption)',
          fontWeight:      'var(--font-weight-medium)',
          cursor:          'pointer',
          transition:      'border-color 150ms ease, color 150ms ease',
          outline:         'none',
          ...style,
        }}
        {...props}
      >
        <span
          aria-hidden
          style={{
            width:           6,
            height:          6,
            borderRadius:    '50%',
            backgroundColor: dotColor ?? 'var(--color-status-success-dot)',
            flexShrink:      0,
          }}
        />
        {label}
      </button>
    )
  },
)

DateRangePill.displayName = 'DateRangePill'
export default DateRangePill
