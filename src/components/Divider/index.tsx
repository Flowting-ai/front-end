'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  /**
   * Visual orientation of the rule.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * When `true` the element is hidden from assistive technology (`aria-hidden`).
   * Use for purely visual separators between items in the same section.
   * @default false
   */
  decorative?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Divider({
  ref,
  orientation = 'horizontal', decorative = false, className, style, ...props
}: DividerProps & { ref?: React.Ref<HTMLHRElement> }) {
    const isHorizontal = orientation === 'horizontal'

    return (
      <hr
        ref={ref}
        aria-orientation={orientation}
        aria-hidden={decorative || undefined}
        className={cn(className)}
        style={{
          border:           'none',
          margin:           0,
          flexShrink:       0,
          // A 1px border, not a 1px-tall background: browsers snap borders to whole device pixels, so
          // every divider renders equally crisp at fractional display scales (125%, 150%). A background
          // line at a half-pixel position blurs across two rows and looks thicker and lighter.
          ...(isHorizontal
            ? { height: 0, borderTop: '1px solid var(--divider-color)', width: '100%', alignSelf: 'stretch' }
            : { width: 0,  borderLeft: '1px solid var(--divider-color)', height: '100%', alignSelf: 'stretch' }),
          ...style,
        }}
        {...props}
      />
    )
}

Divider.displayName = 'Divider'

export default Divider
