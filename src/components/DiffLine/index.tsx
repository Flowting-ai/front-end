'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiffLineVariant = 'added' | 'removed' | 'unchanged'

export interface DiffLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Line content */
  children: React.ReactNode
  /** added (new in rewrite) / removed (cut from original) / unchanged */
  variant:  DiffLineVariant
}

// ── Component ─────────────────────────────────────────────────────────────────
// Per PRD §10. role="listitem" + aria-label so screen readers announce the change.

export const DiffLine = React.forwardRef<HTMLDivElement, DiffLineProps>(
  function DiffLine({ children, variant, className, style, ...props }, ref) {
    const ariaLabel =
      variant === 'added'    ? 'Added line'
    : variant === 'removed'  ? 'Removed line'
    :                          undefined  // unchanged: no announcement

    const baseStyle: React.CSSProperties = {
      display:       'block',
      padding:       '4px 0 4px 10px',
      fontFamily:    'var(--font-body)',
      fontSize:      'var(--font-size-body)',
      lineHeight:    1.5,
      borderLeft:    '2px solid transparent',
      transition:    'background-color 120ms ease, border-color 120ms ease',
    }

    const variantStyle: React.CSSProperties =
      variant === 'added' ? {
        color:           'var(--color-diff-added-text)',
        backgroundColor: 'var(--color-enhance-primary-bg)',
        borderLeftColor: 'var(--color-enhance-primary-accent)',
      }
    : variant === 'removed' ? {
        color:              'var(--color-diff-removed-text)',
        textDecoration:     'line-through',
        backgroundColor:    'transparent',
        borderLeftColor:    'var(--color-diff-removed-border)',
      }
    : {
        color:              'var(--color-diff-unchanged-text)',
        backgroundColor:    'transparent',
        borderLeftColor:    'transparent',
      }

    return (
      <div
        ref={ref}
        role="listitem"
        aria-label={ariaLabel}
        className={cn(className)}
        style={{ ...baseStyle, ...variantStyle, ...style }}
        {...props}
      >
        {children}
      </div>
    )
  },
)

DiffLine.displayName = 'DiffLine'

export default DiffLine
