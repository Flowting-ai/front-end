// Default-value constants for the Pinboard/PinboardExpanded "first paint"
// stagger animation, split out of enterAnimation.tsx. Keeping non-component
// value exports out of a file that also exports a React component (EnterChunk)
// is what Fast Refresh needs to safely hot-reload that component on edit —
// see src/components/Pinboard/constants.ts for the identical reasoning
// applied to Pinboard/index.tsx's own default-value exports.
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
