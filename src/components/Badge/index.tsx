'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Color system ───────────────────────────────────────────────────────────────

export type BadgeColor = 'Blue' | 'Red' | 'Green' | 'Yellow' | 'Purple' | 'Brown' | 'Neutral'

interface BadgeColorTokens {
  bg:          string  // chip background
  text:        string  // label color
  shadow:      string  // outer drop shadow + ring
  innerShadow: string  // inset depth/highlight
}

// Tokens live in aliases.css under `--color-tag-{Color}-{prop}`. Badge's Green
// uses the lighter `bg-soft` tint matching Chip's Green.
const COLOR_CONFIG: Record<BadgeColor, BadgeColorTokens> = (
  ['Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Brown', 'Neutral'] as const
).reduce((acc, color) => {
  const bgVar = color === 'Green' ? `--color-tag-Green-bg-soft` : `--color-tag-${color}-bg`
  acc[color] = {
    bg:          `var(${bgVar})`,
    text:        `var(--color-tag-${color}-text)`,
    shadow:      `var(--color-tag-${color}-shadow)`,
    innerShadow: `var(--color-tag-${color}-inner-shadow)`,
  }
  return acc
}, {} as Record<BadgeColor, BadgeColorTokens>)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Text label shown inside the badge */
  label?: string
  /** Color variant - sets background, text, ring, and inner shadow */
  color?: BadgeColor
  /** Optional leading icon (e.g. a small provider/model logo) rendered before the label. */
  icon?: React.ReactNode
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Badge({ ref, label = 'Label', color = 'Blue', icon, className, style, ...props }: BadgeProps & { ref?: React.Ref<HTMLSpanElement> }) {
    const cfg = COLOR_CONFIG[color]

    return (
      <span
        ref={ref}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             icon ? 3 : 0,
          // Fixed to the text-only badge's natural height (16px line-height +
          // 2px padding top/bottom) so an icon badge sitting next to a
          // plain-label one — e.g. the persona card footer — always lines up
          // instead of the icon's own box nudging it a couple px taller.
          minHeight:       20,
          padding:         '2px',
          borderRadius:    '6px',
          backgroundColor: cfg.bg,
          boxShadow:       cfg.shadow,
          overflow:        'clip',
          ...style,
        }}
        {...props}
      >
        {/* Leading icon */}
        {icon && (
          <span
            aria-hidden
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          14,
              height:         14,
              flexShrink:     0,
              marginLeft:     2,
              position:       'relative',
              overflow:       'hidden',
              borderRadius:   3,
            }}
          >
            {icon}
          </span>
        )}

        {/* Label */}
        <span
          style={{
            padding:    '0 2px',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      cfg.text,
            whiteSpace: 'nowrap',
            position:   'relative',
          }}
        >
          {label}
        </span>

        {/* Inner depth/highlight shadow overlay */}
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
}

Badge.displayName = 'Badge'
export default Badge
