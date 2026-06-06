'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContextScope = 'personal' | 'team' | 'project'

export interface ContextIndicatorProps extends React.HTMLAttributes<HTMLButtonElement> {
  /**
   * personal — renders nothing (personal is the implicit default, never announced)
   * team     — team chip with team name
   * project  — project chip with project name, slightly different treatment
   */
  scope: ContextScope
  /** Display label — team name or project name */
  label?: string
  /** When true, chip is non-interactive (e.g. during an active automation) */
  locked?: boolean
  asChild?: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────

const SCOPE_CONFIG = {
  team: {
    dot:  'var(--color-tag-Blue-text)',
    bg:   'var(--color-tag-Blue-bg)',
    text: 'var(--color-tag-Blue-text)',
  },
  project: {
    dot:  'var(--color-tag-Purple-text)',
    bg:   'var(--color-tag-Purple-bg)',
    text: 'var(--color-tag-Purple-text)',
  },
} as const

// ── Component ─────────────────────────────────────────────────────────────────
// Only renders for team and project scopes. Personal = null.
// Lives in the chat board TopBar, right side, next to the model selector.

export const ContextIndicator = React.forwardRef<HTMLButtonElement, ContextIndicatorProps>(
  function ContextIndicator(
    {
      scope,
      label,
      locked = false,
      asChild = false,
      className,
      style,
      onClick,
      ...props
    },
    ref,
  ) {
    // Personal scope renders nothing — silence is the signal
    if (scope === 'personal') return null

    const Comp = (asChild ? Slot : 'button') as React.ElementType
    const cfg  = SCOPE_CONFIG[scope]
    const isClickable = !locked && !!onClick

    return (
      <Comp
        ref={ref}
        type="button"
        onClick={isClickable ? onClick : undefined}
        disabled={locked}
        aria-label={`Current context: ${scope} — ${label ?? scope}`}
        title={locked ? 'Context is locked while an automation is running' : undefined}
        className={cn(className)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             5,
          paddingLeft:     8,
          paddingRight:    8,
          paddingTop:      4,
          paddingBottom:   4,
          borderRadius:    8,
          border:          'none',
          backgroundColor: cfg.bg,
          cursor:          locked ? 'not-allowed' : isClickable ? 'pointer' : 'default',
          opacity:         locked ? 0.6 : 1,
          fontFamily:      'var(--font-body)',
          fontWeight:      'var(--font-weight-medium)',
          fontSize:        'var(--font-size-caption)',
          lineHeight:      'var(--line-height-caption)',
          color:           cfg.text,
          whiteSpace:      'nowrap',
          flexShrink:      0,
          outline:         'none',
          transition:      'opacity 150ms ease',
          ...style,
        }}
        {...props}
      >
        {/* Scope dot */}
        <span
          aria-hidden
          style={{
            display:         'inline-flex',
            width:           6,
            height:          6,
            borderRadius:    '50%',
            backgroundColor: cfg.dot,
            flexShrink:      0,
          }}
        />
        {label ?? scope}
      </Comp>
    )
  },
)

ContextIndicator.displayName = 'ContextIndicator'
export default ContextIndicator
