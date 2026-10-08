'use client'

import React, { useEffect } from 'react'
import { m, useAnimate, useReducedMotion } from 'framer-motion'

// ── BellRingIcon ─────────────────────────────────────────────────────────────
// Hugeicons "bell-ring", stroke-rounded (MIT). Paths copied verbatim from
// @hugeicons/core-free-icons@4.3.5 `BellRingIcon` — the 4.1.x release this app
// pins doesn't ship it, and bumping the whole icon pack for one glyph would
// move every other icon too. Drawn inline (rather than through HugeiconsIcon)
// so the bell body can swing on its own, matching the @strange-huge/icons
// `animated` / `triggered` API used everywhere else in the sidebar.

export interface BellRingIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  /** Icon size in px. */
  size?: number
  /** Stroke colour. Defaults to currentColor. */
  color?: string
  /** Swing on hover of the icon itself. */
  animated?: boolean
  /** External trigger (e.g. the parent button's hover) — drives the swing directly. */
  triggered?: boolean
  /**
   * Bump to ring the bell once — a stronger, longer peal than the hover swing,
   * for "something new just arrived". Independent of hover, so a ring is never
   * cut short or replayed by the pointer moving over the icon.
   */
  ringKey?: number
}

// A real bell peal: big first strike, decaying swings, settles at rest.
const PEAL_ROTATE = [0, -22, 18, -14, 10, -6, 3, 0]
const PEAL_OPTIONS = { duration: 1.1, ease: 'easeOut' as const }
// Plain-<g> pivots for the imperative peal (fill-box so % is the group's own box).
const PEAL_PIVOT_BODY: React.CSSProperties  = { transformBox: 'fill-box', transformOrigin: '50% 8%' }
const PEAL_PIVOT_WAVES: React.CSSProperties = { transformBox: 'fill-box', transformOrigin: '50% 50%' }

const SWING = {
  rest:  { rotate: 0 },
  swing: { rotate: [0, 14, -12, 8, -5, 2, 0], transition: { duration: 0.7, ease: 'easeInOut' as const } },
}

const WAVES = {
  rest:  { opacity: 1, scale: 1 },
  swing: { opacity: [1, 0.35, 1], scale: [1, 1.12, 1], transition: { duration: 0.7, ease: 'easeInOut' as const } },
}

export function BellRingIcon({ size = 20, color = 'currentColor', animated = false, triggered, ringKey = 0, ...props }: BellRingIconProps) {
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = React.useState(false)
  const active = !reduceMotion && (triggered ?? (animated && hovered))
  const state = active ? 'swing' : 'rest'

  // The peal runs on wrapper groups around the hover-driven ones, so the two
  // animations compose instead of fighting over the same transform.
  const [scope, animate] = useAnimate<SVGGElement>()
  useEffect(() => {
    if (!ringKey || reduceMotion || !scope.current) return
    void animate('[data-bell-body]', { rotate: PEAL_ROTATE }, PEAL_OPTIONS)
    void animate('[data-bell-waves]', { opacity: [1, 0.2, 1, 0.4, 1], scale: [1, 1.25, 1, 1.12, 1] }, PEAL_OPTIONS)
  }, [ringKey, reduceMotion, animate, scope])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      onMouseEnter={animated && triggered === undefined ? () => setHovered(true) : undefined}
      onMouseLeave={animated && triggered === undefined ? () => setHovered(false) : undefined}
      style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
      {...props}
    >
      <g ref={scope}>
      <g data-bell-waves style={PEAL_PIVOT_WAVES}>
      <m.g variants={WAVES} initial={false} animate={state} style={{ originX: '50%', originY: '20%' }}>
        <path d="M22 8C22 5.7 21.2 3.7 20 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 2C2.8 3.7 2 5.7 2 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </m.g>
      </g>
      {/* Pivot near the top of the dome so the bell swings from its hanger. */}
      <g data-bell-body style={PEAL_PIVOT_BODY}>
      <m.g variants={SWING} initial={false} animate={state} style={{ originX: '50%', originY: '8%' }}>
        <path d="M16 18C16 20.2091 14.2091 22 12 22C9.79086 22 8 20.2091 8 18" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M4.43654 18H19.5625C20.2903 18 20.6542 18 20.8648 17.8951C21.274 17.6913 21.4929 17.2359 21.3964 16.789C21.3468 16.559 21.1194 16.2749 20.6648 15.7066L20.4951 15.4944C20.0392 14.9246 19.8113 14.6397 19.6184 14.3409C19.0187 13.4119 18.6477 12.354 18.5356 11.254C18.4995 10.9002 18.4995 10.5353 18.4995 9.8056V8.5C18.4995 8.03572 18.4995 7.80358 18.4867 7.60758C18.2898 4.60304 15.8965 2.20977 12.892 2.01285C12.696 2 12.4638 2 11.9995 2C11.5353 2 11.3031 2 11.1071 2.01285C8.10258 2.20977 5.70931 4.60304 5.51239 7.60758C5.49954 7.80358 5.49954 8.03572 5.49954 8.5V9.8056C5.49954 10.5353 5.49954 10.9002 5.46349 11.254C5.35143 12.354 4.98035 13.4119 4.38067 14.3409C4.18779 14.6397 3.95985 14.9246 3.50401 15.4944L3.33427 15.7066C2.87964 16.2749 2.65233 16.559 2.60268 16.789C2.50621 17.2359 2.72509 17.6913 3.13431 17.8951C3.3449 18 3.70878 18 4.43654 18Z"
          stroke={color}
          strokeWidth={1.5}
        />
      </m.g>
      </g>
      </g>
    </svg>
  )
}

BellRingIcon.displayName = 'BellRingIcon'
export default BellRingIcon
