'use client'

import React from 'react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnhanceDotProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Total number of steps in the session */
  total:    number
  /** Zero-indexed current step */
  current:  number
  /** AUDIT mode swaps the active colour to the darker peer-review variant */
  audit?:   boolean
}

// ── Component ─────────────────────────────────────────────────────────────────
// Per PRD §13: past = filled primary @ 35% opacity, current = wide pill @ 100%,
// upcoming = inactive grey. Dot 6×6, active pill 18×6, both border-radius 3.

export function EnhanceDotProgress({ ref, total, current, audit = false, className, style, ...props }: EnhanceDotProgressProps & { ref?: React.Ref<HTMLDivElement> }) {
    const activeColor = audit ? 'var(--color-enhance-audit)' : 'var(--color-enhance-primary)'

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-label={`Step ${current + 1} of ${total}`}
        className={cn(className)}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        6,
          ...style,
        }}
        {...props}
      >
        {Array.from({ length: total }, (_, i) => {
          const isCurrent  = i === current
          const isPast     = i < current
          const isUpcoming = i > current
          return (
            // eslint-disable-next-line react/no-array-index-as-key -- fixed-count dot indicator; index is stable
            <m.span key={i}
              aria-hidden
              layout
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{
                display:         'inline-block',
                width:           isCurrent ? 18 : 6,
                height:          6,
                borderRadius:    3,
                backgroundColor: isUpcoming
                  ? 'var(--color-enhance-progress-inactive)'
                  : activeColor,
                opacity:         isPast ? 0.35 : 1,
                transition:      'background-color 200ms ease, opacity 200ms ease',
              }}
            />
          )
        })}
      </div>
    )
}

EnhanceDotProgress.displayName = 'EnhanceDotProgress'

export default EnhanceDotProgress
