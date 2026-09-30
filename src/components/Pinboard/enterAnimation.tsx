'use client'

import React from 'react'
import { m } from 'framer-motion'
import type { PinboardEnterAnimation } from './enter-animation-defaults'

// Re-exported for backward compatibility — these used to be declared directly
// in this file; they now live in ./enter-animation-defaults.ts (non-component
// value exports out of a file that also exports EnterChunk, so Fast Refresh
// can hot-reload EnterChunk without a full remount — see that file's comment).
export {
  type PinboardEnterAnimation,
  PINBOARD_COMPACT_ENTER_DEFAULT,
  PINBOARD_EXPANDED_ENTER_DEFAULT,
} from './enter-animation-defaults'

export interface EnterChunkProps {
  /** Resolved animation config - either a default or a consumer override. */
  cfg:        PinboardEnterAnimation
  /** Stagger position - chunk 0 fires first, then 1, 2, … */
  index:      number
  children:   React.ReactNode
  /** Spread onto the underlying m.div. */
  style?:     React.CSSProperties
  className?: string
}

export function EnterChunk({ cfg, index, children, style, className, ref }: EnterChunkProps & { ref?: React.Ref<HTMLDivElement> }) {
  if (cfg.enabled === false) {
    return <div ref={ref} className={className} style={style}>{children}</div>
  }
  const delay = (cfg.firstItemDelayMs + index * cfg.staggerMs) / 1000
  return (
    <m.div
      ref={ref}
      className={className}
      style={style}
      suppressHydrationWarning
      initial={{
        opacity: cfg.from.opacity,
        y:       cfg.from.y,
        filter:  `blur(${cfg.from.blur}px)`,
      }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ ...cfg.transition, delay }}
    >
      {children}
    </m.div>
  )
}
