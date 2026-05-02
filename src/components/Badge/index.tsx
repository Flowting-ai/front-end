'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeColor = 'Blue' | 'Red' | 'Green' | 'Yellow' | 'Purple' | 'Brown' | 'Neutral'

interface BadgeColorTokens {
  bg:          string
  text:        string
  shadow:      string
  innerShadow: string
}

const COLOR_CONFIG: Record<BadgeColor, BadgeColorTokens> = {
  Blue: {
    bg:          '#cadcf1',
    text:        '#135487',
    shadow:      '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
  },
  Red: {
    bg:          '#ffbfb6',
    text:        '#7a201c',
    shadow:      '0px 1px 1.5px 0px rgba(24,2,2,0.2), 0px 0px 0px 1px rgba(159,38,35,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(253,231,231,0.7), inset 0px -1px 0px 0px rgba(159,38,35,0.1)',
  },
  Green: {
    bg:          '#f7fee6',
    text:        '#456211',
    shadow:      '0px 1px 1.5px 0px rgba(17,25,1,0.2), 0px 0px 0px 1px rgba(128,183,7,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(247,254,230,0.7), inset 0px -1px 0px 0px rgba(128,183,7,0.1)',
  },
  Yellow: {
    bg:          '#e9dfc9',
    text:        '#6d5921',
    shadow:      '0px 1px 1.5px 0px rgba(20,16,5,0.2), 0px 0px 0px 1px rgba(143,116,39,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(250,246,235,0.7), inset 0px -1px 0px 0px rgba(143,116,39,0.1)',
  },
  Purple: {
    bg:          '#ded0df',
    text:        '#513853',
    shadow:      '0px 1px 1.5px 0px rgba(18,6,19,0.2), 0px 0px 0px 1px rgba(103,79,104,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(248,236,249,0.7), inset 0px -1px 0px 0px rgba(103,79,104,0.1)',
  },
  Brown: {
    bg:          '#e6d5ca',
    text:        '#683d1b',
    shadow:      '0px 1px 1.5px 0px rgba(20,12,5,0.2), 0px 0px 0px 1px rgba(126,84,53,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(250,241,235,0.7), inset 0px -1px 0px 0px rgba(126,84,53,0.1)',
  },
  Neutral: {
    bg:          '#ede1d7',
    text:        '#524b47',
    shadow:      '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
    innerShadow: 'inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)',
  },
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string
  color?: BadgeColor
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ label = 'Label', color = 'Blue', className, style, ...props }, ref) {
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
          padding:         '2px',
          borderRadius:    '6px',
          backgroundColor: cfg.bg,
          boxShadow:       cfg.shadow,
          overflow:        'clip',
          ...style,
        }}
        {...props}
      >
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

Badge.displayName = 'Badge'
export default Badge
