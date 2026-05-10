'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Size map ──────────────────────────────────────────────────────────────────
const SIZE_PX = { sm: 5, md: 7 } as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type BreathingDotSize = keyof typeof SIZE_PX

export interface BreathingDotProps {
  /** sm = 5px  md = 7px (default) */
  size?:      BreathingDotSize
  className?: string
  style?:     React.CSSProperties
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BreathingDot = React.forwardRef<HTMLSpanElement, BreathingDotProps>(
  function BreathingDot({ size = 'md', className, style }, ref) {
    const shouldReduceMotion = useReducedMotion() ?? false
    const px = SIZE_PX[size]

    return (
      <motion.span
        ref={ref}
        aria-hidden
        className={cn(className)}
        animate={
          shouldReduceMotion
            ? { opacity: 0.5 }
            : { opacity: [0.15, 1, 0.15] }
        }
        transition={
          shouldReduceMotion
            ? {}
            : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
        }
        style={{
          display:         'inline-block',
          width:           px,
          height:          px,
          borderRadius:    '50%',
          backgroundColor: 'var(--breathing-dot-color)',
          verticalAlign:   'middle',
          flexShrink:      0,
          ...style,
        }}
      />
    )
  },
)

BreathingDot.displayName = 'BreathingDot'
export default BreathingDot
