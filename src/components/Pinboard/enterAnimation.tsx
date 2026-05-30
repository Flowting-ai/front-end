'use client'

import React from 'react'
import { m } from 'framer-motion'
import type { Transition } from 'framer-motion'

/**
 * Shared "first paint" stagger animation for Pinboard and PinboardExpanded.
 *
 * Each top-level chunk in either component is wrapped in <EnterChunk>; the
 * chunk's index controls its position in the staggered cascade.
 *
 * Each component owns its own default (compact vs expanded - the expanded
 * panel uses a slower / more dramatic cascade that reads against the larger
 * surface). Consumers can override per-instance via the `enterAnimation` prop.
 *
 * The animation runs on mount only - once the chunks settle, the wrapping
 * m.div is at identity transform / no filter and is invisible to its
 * children's behaviour. Reduced motion is honoured via the app-root
 * <MotionConfig reducedMotion="user">.
 */
export interface PinboardEnterAnimation {
  /** When false, the animation is bypassed and chunks render statically. */
  enabled?:         boolean
  /** Delay before the first chunk begins (ms). */
  firstItemDelayMs: number
  /** Delay between consecutive chunks (ms). */
  staggerMs:        number
  /** Where each chunk starts before animating to its resting state. */
  from: {
    opacity: number
    y:       number
    blur:    number
  }
  /** Framer transition shared by every chunk (delay is added per-chunk). */
  transition: Transition
}

/** Compact Pinboard - quicker cascade for the smaller surface. */
export const PINBOARD_COMPACT_ENTER_DEFAULT: PinboardEnterAnimation = {
  enabled:          true,
  firstItemDelayMs: 70,
  staggerMs:        70,
  from:             { opacity: 0, y: 12, blur: 4 },
  transition:       { duration: 0.4, ease: [0.2, 0, 0, 1] },
}

/** Expanded Pinboard - slower, longer-tail cascade for the larger surface. */
export const PINBOARD_EXPANDED_ENTER_DEFAULT: PinboardEnterAnimation = {
  enabled:          true,
  firstItemDelayMs: 210,
  staggerMs:        70,
  from:             { opacity: 0, y: 13, blur: 4 },
  transition:       { duration: 0.54, ease: [0.2, 0, 0, 1] },
}

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
