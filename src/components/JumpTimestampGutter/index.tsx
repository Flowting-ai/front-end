'use client'

import React, { useState } from 'react'
import { m } from 'framer-motion'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Color variants ─────────────────────────────────────────────────────────────
// Matches HighlightCard fold colors at rest; one step darker on hover.
// colorIndex must match the corresponding HighlightCard's colorIndex.

const GUTTER_COLORS = [
  { rest: 'var(--yellow-200)', hover: 'var(--yellow-300)' },
  { rest: 'var(--purple-300)', hover: 'var(--purple-400)' },
  { rest: 'var(--blue-200)',   hover: 'var(--blue-300)'   },
  { rest: 'var(--green-200)',  hover: 'var(--green-300)'  },
] as const

// ── Size steps ─────────────────────────────────────────────────────────────────
// Two steps based on mark count. Both feel like a tight cluster - the gap is
// the only visible space between pills (no invisible hit-area padding inflating it).
//
// default (1–6):  6px tall, 6px gap between pills
// compact (7+):   4px tall, 4px gap between pills

const STEPS = {
  default: { markH: 6, restW: 16, hoverW: 28, gap: 6 },
  compact: { markH: 4, restW: 12, hoverW: 22, gap: 4 },
} as const

type Step = typeof STEPS[keyof typeof STEPS]

function getStep(count: number): Step {
  return count <= 6 ? STEPS.default : STEPS.compact
}

// Scroll + edge fade kicks in at this many marks.
const SCROLL_AT = 12
const SCROLL_H  = 200  // px - caps visible gutter height
const FADE_SIZE = 14   // px faded at each edge via CSS mask

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GutterMark {
  /** Unique id matching the HighlightEntry id */
  id:         string
  /** 0–3, must match the colorIndex assigned by HighlightPanel */
  colorIndex: 0 | 1 | 2 | 3
}

export interface JumpTimestampGutterProps {
  /** One mark per highlight. Derive from the same array as HighlightPanel using `i % 4` for colorIndex. */
  marks:      GutterMark[]
  /** Called when a mark is clicked. `id` matches the corresponding HighlightEntry.id. */
  onJump:     (id: string) => void
  /** Extra classes applied to the gutter container. */
  className?: string
}

// ── Mark ───────────────────────────────────────────────────────────────────────

function Mark({
  mark,
  index,
  step,
  onJump,
}: {
  mark:   GutterMark
  index:  number
  step:   Step
  onJump: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = GUTTER_COLORS[mark.colorIndex]

  return (
    // m.button IS the visual pill - background fills the button bounds.
    // FM animates width + height (both numeric, WAAPI-safe).
    // backgroundColor uses CSS transition - FM cannot interpolate var(--x)→var(--y).
    <m.button
      type="button"
      className="kds-gutter-mark"
      aria-label={`Jump to highlight ${index + 1}`}
      onClick={() => onJump(mark.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={false}
      animate={{
        width:  hovered ? step.hoverW : step.restW,
        height: step.markH,
      }}
      transition={springs.fast}
      style={{
        padding:         0,
        border:          'none',
        borderRadius:    2,
        cursor:          'pointer',
        flexShrink:      0,
        backgroundColor: hovered ? color.hover : color.rest,
        transition:      'background-color 150ms ease',
      }}
    />
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function JumpTimestampGutter({
  marks,
  onJump,
  className,
}: JumpTimestampGutterProps) {
  const step       = getStep(marks.length)
  const scrollable = marks.length >= SCROLL_AT

  return (
    <div
      className={cn(className)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-end',
        gap:            step.gap,
        width:          36,
        flexShrink:     0,
        padding:        '5px 0',
        overflowY:      scrollable ? 'auto'   : 'visible',
        maxHeight:      scrollable ? SCROLL_H : undefined,
        scrollbarWidth: scrollable ? 'none'   : undefined,
        // CSS mask fades edges - no background color dependency
        ...(scrollable ? {
          maskImage:       `linear-gradient(to bottom, transparent 0px, black ${FADE_SIZE}px, black calc(100% - ${FADE_SIZE}px), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${FADE_SIZE}px, black calc(100% - ${FADE_SIZE}px), transparent 100%)`,
        } : {}),
      }}
    >
      {marks.map((mark, i) => (
        <Mark key={mark.id} mark={mark} index={i} step={step} onJump={onJump} />
      ))}
    </div>
  )
}

export default JumpTimestampGutter
