'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { getGradient } from '@/lib/team-gradients'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Team name — also used to derive the avatar gradient */
  teamName: string
  /** Optional one-liner description shown below the team name */
  description?: string
  /** sm = caption (11px) · md = body (14px, default) */
  size?: 'sm' | 'md'
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────
// Non-interactive team attribution label.
// Rendered under project titles and on PersonaCards when visibility = team.

export const TeamChip = React.forwardRef<HTMLSpanElement, TeamChipProps>(
  function TeamChip(
    { teamName, description, size = 'md', asChild = false, className, style, ...props },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'span') as React.ElementType
    const gradient = getGradient(teamName)
    const initial  = teamName.charAt(0).toUpperCase()

    const isSmall = size === 'sm'

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        isSmall ? 4 : 5,
          flexShrink: 0,
          ...style,
        }}
        {...props}
      >
        {/* Gradient avatar dot */}
        <span
          aria-hidden
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            justifyContent: 'center',
            width:        isSmall ? 12 : 16,
            height:       isSmall ? 12 : 16,
            borderRadius: 3,
            background:   gradient,
            flexShrink:   0,
            fontFamily:   'var(--font-title)',
            fontWeight:   500,
            fontSize:     isSmall ? 7 : 9,
            color:        'var(--neutral-white)',
            lineHeight:   1,
            userSelect:   'none',
          }}
        >
          {initial}
        </span>

        {/* Team name + optional description */}
        <span style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span
            style={{
              fontFamily:  'var(--font-body)',
              fontWeight:  isSmall ? 400 : 500,
              fontSize:    isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
              lineHeight:  isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
              color:       'var(--neutral-500)',
              whiteSpace:  'nowrap',
            }}
          >
            {teamName}
          </span>
          {description && (
            <span
              style={{
                fontFamily:  'var(--font-body)',
                fontWeight:  400,
                fontSize:    'var(--font-size-caption)',
                lineHeight:  'var(--line-height-caption)',
                color:       'var(--neutral-400)',
                whiteSpace:  'nowrap',
              }}
            >
              {description}
            </span>
          )}
        </span>
      </Comp>
    )
  },
)

TeamChip.displayName = 'TeamChip'
export default TeamChip
