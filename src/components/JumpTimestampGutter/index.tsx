'use client'

import React, { useRef, useState, useCallback } from 'react'
import { m } from 'framer-motion'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Color variants ─────────────────────────────────────────────────────────────

const GUTTER_COLORS = [
  { rest: 'var(--yellow-200)', hover: 'var(--yellow-300)' },
  { rest: 'var(--purple-300)', hover: 'var(--purple-400)' },
  { rest: 'var(--blue-200)',   hover: 'var(--blue-300)'   },
  { rest: 'var(--green-200)',  hover: 'var(--green-300)'  },
] as const

// ── Size steps ─────────────────────────────────────────────────────────────────

const STEPS = {
  default: { markH: 6, restW: 16, hoverW: 28, gap: 6 },
  compact: { markH: 4, restW: 12, hoverW: 22, gap: 4 },
} as const

type Step = typeof STEPS[keyof typeof STEPS]

function getStep(count: number): Step {
  return count <= 6 ? STEPS.default : STEPS.compact
}

// Maximum pills visible before scrolling kicks in.
const MAX_VISIBLE = 15
const FADE_SIZE   = 12  // px faded at each edge via CSS mask

// Exact height that shows MAX_VISIBLE pills for a given step.
function maxScrollH(step: Step): number {
  return MAX_VISIBLE * step.markH + (MAX_VISIBLE - 1) * step.gap + 10 // +10 for top/bottom padding
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GutterMark {
  id:         string
  colorIndex: 0 | 1 | 2 | 3
}

export interface JumpTimestampGutterProps {
  marks:      GutterMark[]
  onJump:     (id: string) => void
  className?: string
}

// ── Mark ───────────────────────────────────────────────────────────────────────

function Mark({
  mark, index, step, onJump,
}: {
  mark:   GutterMark
  index:  number
  step:   Step
  onJump: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = GUTTER_COLORS[mark.colorIndex]

  return (
    <m.button
      type="button"
      className="kds-gutter-mark"
      aria-label={`Jump to highlight ${index + 1}`}
      onClick={() => onJump(mark.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={false}
      animate={{ width: hovered ? step.hoverW : step.restW, height: step.markH }}
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

// ── Scroll indicator ──────────────────────────────────────────────────────────
// Thin vertical track + animated thumb shown to the left of the pill list.
// Thumb height is proportional to the visible fraction; position tracks scrollTop.

const TRACK_W     = 2   // px — track/thumb width
const TRACK_COLOR = 'var(--neutral-150, var(--neutral-200))'
const THUMB_COLOR = 'var(--neutral-400)'

function ScrollIndicator({
  scrollRatio,   // scrollTop / (scrollHeight - clientHeight), 0–1
  thumbRatio,    // clientHeight / scrollHeight, 0–1
  trackH,        // total track height in px
}: {
  scrollRatio: number
  thumbRatio:  number
  trackH:      number
}) {
  const thumbH   = Math.max(16, thumbRatio * trackH)
  const maxTravel = trackH - thumbH
  const thumbTop  = scrollRatio * maxTravel

  return (
    <div
      aria-hidden
      style={{
        position:        'relative',
        width:           TRACK_W,
        height:          trackH,
        borderRadius:    TRACK_W / 2,
        backgroundColor: TRACK_COLOR,
        flexShrink:      0,
        overflow:        'hidden',
      }}
    >
      <m.div
        initial={false}
        animate={{ y: thumbTop }}
        transition={springs.fast}
        style={{
          position:        'absolute',
          top:             0,
          left:            0,
          width:           TRACK_W,
          height:          thumbH,
          borderRadius:    TRACK_W / 2,
          backgroundColor: THUMB_COLOR,
        }}
      />
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function JumpTimestampGutter({
  marks,
  onJump,
  className,
}: JumpTimestampGutterProps) {
  const step       = getStep(marks.length)
  const scrollable = marks.length > MAX_VISIBLE
  const scrollH    = maxScrollH(step)

  // Scroll position tracking for the indicator
  const listRef       = useRef<HTMLDivElement>(null)
  const [scrollRatio, setScrollRatio] = useState(0)
  const [thumbRatio,  setThumbRatio]  = useState(1)

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const scrollable = el.scrollHeight - el.clientHeight
    setScrollRatio(scrollable > 0 ? el.scrollTop / scrollable : 0)
    setThumbRatio(el.clientHeight / el.scrollHeight)
  }, [])

  // Initialise thumbRatio after mount / when marks change
  React.useEffect(() => {
    handleScroll()
  }, [marks.length, handleScroll])

  return (
    <div
      className={cn(className)}
      style={{
        display:    'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap:        6,
        flexShrink: 0,
      }}
    >
      {/* ── Left: scroll position indicator (only when list overflows) ── */}
      {scrollable && (
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         scrollH,
            paddingTop:     5,
            paddingBottom:  5,
            boxSizing:      'border-box',
          }}
        >
          <ScrollIndicator
            scrollRatio={scrollRatio}
            thumbRatio={thumbRatio}
            trackH={scrollH - 10}
          />
        </div>
      )}

      {/* ── Right: pill list ── */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="kaya-scrollbar"
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'flex-start',
          gap:            step.gap,
          width:          step.hoverW,
          flexShrink:     0,
          padding:        '5px 0',
          overflowY:      scrollable ? 'auto'    : 'visible',
          maxHeight:      scrollable ? scrollH   : undefined,
          scrollbarWidth: 'none',
          // CSS mask fades pills at edges when scrollable
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
    </div>
  )
}

export default JumpTimestampGutter
