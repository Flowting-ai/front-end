'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {}

// Small muted label used above section headings, stat cards, and chart cards.
// Uses the KDS `caption` text style with the muted text colour. No custom
// letter-spacing or uppercase — those aren't part of the system's text styles.

export function Eyebrow({ ref, className, style, children, ...props }: EyebrowProps & { ref?: React.Ref<HTMLSpanElement> }) {
    return (
      <span
        ref={ref}
        className={cn(className)}
        style={{
          display:    'inline-block',
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    )
}

Eyebrow.displayName = 'Eyebrow'
export default Eyebrow
