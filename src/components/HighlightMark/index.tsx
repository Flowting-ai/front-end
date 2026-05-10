'use client'

import React from 'react'
import { HIGHLIGHT_COLORS } from '@/components/HighlightCard'
import type { HighlightColorIndex } from '@/components/HighlightCard'
import { cn } from '@/lib/utils'

export interface HighlightMarkProps {
  /** Which highlight color to use — matches the colorIndex on HighlightCard / JumpTimestampGutter. */
  colorIndex: HighlightColorIndex
  children:   React.ReactNode
  className?: string
}

/**
 * Inline text mark applied to source text when a passage is highlighted.
 * Renders as a semantic <mark> element so screen readers announce it correctly.
 * box-decoration-break: clone ensures each wrapped line gets its own background capsule.
 */
export function HighlightMark({ colorIndex, children, className }: HighlightMarkProps) {
  const { bg } = HIGHLIGHT_COLORS[colorIndex]

  return (
    <mark
      className={cn(className)}
      style={{
        backgroundColor:           bg,
        color:                     'inherit',
        borderRadius:              3,
        padding:                   '1px 2px',
        boxDecorationBreak:        'clone',
        WebkitBoxDecorationBreak:  'clone',
      }}
    >
      {children}
    </mark>
  )
}
