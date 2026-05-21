'use client'

import * as React from 'react'
import { m } from 'framer-motion'

export interface SpinnerProps {
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

export function Spinner({ size = 20, color = 'currentColor', className, style }: SpinnerProps) {
  return (
    <m.svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      style={{ color, flexShrink: 0, ...style }}
      animate={{ rotate: 360 }}
      transition={{
        duration:   1,
        ease:       [0.25, 0.1, 0.25, 1],
        repeat:     Infinity,
        repeatType: 'loop',
      }}
    >
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M 10 3 A 7 7 0 0 1 17 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </m.svg>
  )
}

Spinner.displayName = 'Spinner'
export default Spinner
