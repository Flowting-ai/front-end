'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name. Initials are derived as the first letter of the first two words. */
  name:   string
  /** Background colour, or a `linear-gradient(...)`/`radial-gradient(...)` CSS
   *  value for a gradient fill. Falls back to `var(--neutral-700)`. */
  color?: string
  /** Render size. xs=24, sm=28, md=32, lg=40. */
  size?:  AvatarSize
  /** Override the auto-derived initials. */
  initials?: string
  asChild?: boolean
}

const SIZE_PX: Record<AvatarSize, number> = { xs: 24, sm: 28, md: 32, lg: 40 }
const FONT_TOKEN: Record<AvatarSize, string> = {
  xs: 'var(--font-size-caption)',
  sm: 'var(--font-size-caption)',
  md: 'var(--font-size-body)',
  lg: 'var(--font-size-body)',
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Avatar({ ref, name, color, size = 'md', initials, asChild, className, style, ...props }: AvatarProps & { ref?: React.Ref<HTMLSpanElement> }) {
    const Comp = asChild ? Slot : 'span'
    const px = SIZE_PX[size]
    const fontSize = FONT_TOKEN[size]
    const text = (initials ?? deriveInitials(name)).slice(0, 2)
    const isGradient = color?.includes('gradient(')

    return (
      <Comp
        ref={ref}
        aria-label={name}
        className={cn(className)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
          width:           px,
          height:          px,
          borderRadius:    '50%',
          backgroundColor: isGradient ? undefined : (color ?? 'var(--neutral-700)'),
          backgroundImage:  isGradient ? color : undefined,
          color:           'var(--neutral-white)',
          fontFamily:      'var(--font-body)',
          fontWeight:      'var(--font-weight-medium)',
          fontSize:        fontSize,
          lineHeight:      1,
          userSelect:      'none',
          ...style,
        }}
        {...props}
      >
        {text}
      </Comp>
    )
}

Avatar.displayName = 'Avatar'
export default Avatar
