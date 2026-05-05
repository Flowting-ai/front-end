'use client'

import React from 'react'
import { motion } from 'framer-motion'
import type { Transition } from 'framer-motion'

export interface PinboardEnterAnimation {
  enabled?:         boolean
  firstItemDelayMs: number
  staggerMs:        number
  from: {
    opacity: number
    y:       number
    blur:    number
  }
  transition: Transition
}

export const PINBOARD_COMPACT_ENTER_DEFAULT: PinboardEnterAnimation = {
  enabled:          true,
  firstItemDelayMs: 70,
  staggerMs:        70,
  from:             { opacity: 0, y: 12, blur: 4 },
  transition:       { duration: 0.4, ease: [0.2, 0, 0, 1] },
}

export const PINBOARD_EXPANDED_ENTER_DEFAULT: PinboardEnterAnimation = {
  enabled:          true,
  firstItemDelayMs: 210,
  staggerMs:        70,
  from:             { opacity: 0, y: 13, blur: 4 },
  transition:       { duration: 0.54, ease: [0.2, 0, 0, 1] },
}

export interface EnterChunkProps {
  cfg:        PinboardEnterAnimation
  index:      number
  children:   React.ReactNode
  style?:     React.CSSProperties
  className?: string
}

export const EnterChunk = React.forwardRef<HTMLDivElement, EnterChunkProps>(
  function EnterChunk({ cfg, index, children, style, className }, ref) {
    if (cfg.enabled === false) {
      return <div ref={ref} className={className} style={style}>{children}</div>
    }
    const delay = (cfg.firstItemDelayMs + index * cfg.staggerMs) / 1000
    return (
      <motion.div
        ref={ref}
        className={className}
        style={style}
        initial={{
          opacity: cfg.from.opacity,
          y:       cfg.from.y,
          filter:  `blur(${cfg.from.blur}px)`,
        }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...cfg.transition, delay }}
      >
        {children}
      </motion.div>
    )
  },
)

EnterChunk.displayName = 'EnterChunk'
