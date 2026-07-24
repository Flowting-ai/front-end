'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Gradient palette (matches TeamSwitcher — same team, same colour) ──────────

// Same palette as TeamSwitcher — must stay in sync
const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  return TEAM_GRADIENTS[Math.abs(h) % TEAM_GRADIENTS.length]!
}

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
