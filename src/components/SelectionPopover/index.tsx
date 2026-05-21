'use client'

import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { useMounted } from '@/hooks/use-mounted'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { CopyOneIcon, TickTwoIcon, RedoIcon, PenOneIcon } from '@strange-huge/icons'
import { useCorrosion } from '@/lib/useCorrosion'
import { springs } from '@/lib/springs'

// ── Visual constants ───────────────────────────────────────────────────────────
// Dark warm surface - neutral-800 (#3B3632) gives strong contrast against
// the browser's text-selection highlight (usually blue/purple).

const BG = 'var(--neutral-800)'

// Container shadow: stronger lift than light FloatingMenu
const SHADOW_OUTER =
  '0px 4px 20px 0px rgba(0,0,0,0.32), ' +
  '0px 1px 3px 0px rgba(0,0,0,0.20), ' +
  '0px 0px 0px 1px rgba(0,0,0,0.18)'
const SHADOW_INNER = 'inset 0px 1px 0px 0px rgba(255,255,255,0.06)'

// Caret triangle pointing toward the selection
const CARET_H = 6   // height (tip length) in px
const CARET_W = 6   // half of base width; full base = 12px

// Icon swap constants - same as MessageBubble copy pattern
const SWAP_INITIAL = { scale: 0.5, opacity: 0, filter: 'blur(4px)' }
const SWAP_ANIMATE = { scale: 1,   opacity: 1, filter: 'blur(0px)' }
const SWAP_EXIT    = { scale: 0.5, opacity: 0, filter: 'blur(4px)' }
const SWAP_SPRING  = { type: 'spring', stiffness: 500, damping: 30 } as const

// Corrosion hover gradient - identical to Button Primary hover
const HOVER_GLOW_GRADIENT =
  'linear-gradient(180deg, rgb(221,221,221) 0%, rgb(143,116,39) 21.635%, rgb(104,61,27) 36.058%, rgb(39,13,42) 63.462%, rgb(11,53,127) 82.212%, rgb(13,110,178) 97.115%)'

// ── Internal action button ─────────────────────────────────────────────────────
// Implements Button ghost sm padding (5px 8px) with the exact same corrosion
// hover gradient used by Button Primary - HOVER_GLOW_GRADIENT + turbulence
// SVG filter + mouse-tracking mask reveal via useCorrosion.

function PopoverAction({
  icon,
  label,
  onClick,
}: {
  icon:    React.ReactNode
  label:   string
  onClick: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  const circleRef = useRef<SVGCircleElement>(null)
  const uid       = useId()
  const filterId  = `sp-corrosion-${uid}`
  const blurId    = `sp-mask-blur-${uid}`
  const maskId    = `sp-reveal-mask-${uid}`

  const { onMouseEnter: corrosionEnter, onMouseLeave: corrosionLeave } = useCorrosion(circleRef)

  return (
    <button
      type="button"
      className="kds-selection-popover-action"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={e => { setIsHovered(true);  corrosionEnter(e) }}
      onMouseLeave={e => { setIsHovered(false); corrosionLeave(e) }}
      style={{
        position:   'relative',
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        // Button ghost sm: 5px top/bottom, 8px left/right
        padding:    '5px 8px',
        border:     'none',
        borderRadius: 8,
        cursor:     'pointer',
        background: 'none',
        overflow:   'hidden',
        userSelect: 'none',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        color:      'var(--neutral-50)',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        boxShadow:  isHovered ? 'var(--shadow-button-subtle-inner-hover)' : undefined,
        transition: 'box-shadow 150ms',
      }}
    >
      {/* ── SVG defs: turbulence filter + blur filter + mask ── */}
      <svg
        aria-hidden
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <defs>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves={3} result="noise">
              <animate
                attributeName="baseFrequency"
                values="0.03 0.055;0.05 0.04;0.035 0.07;0.025 0.05;0.03 0.055"
                dur="3.5s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={12} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-200" y="-200" width="600" height="600">
            <circle
              ref={circleRef}
              cx="0" cy="0" r="0"
              fill="white"
              filter={`url(#${blurId})`}
              visibility="hidden"
            />
          </mask>
        </defs>
      </svg>

      {/* ── Corrosion glow - turbulence displacement + circle mask reveal ── */}
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, zIndex: 0, filter: `url(#${filterId})` }}
      >
        <div style={{ position: 'absolute', inset: 0, WebkitMask: `url(#${maskId})`, mask: `url(#${maskId})` }}>
          <div
            style={{
              position:        'absolute',
              inset:           '-0.73px',
              borderRadius:    '8.73px',
              filter:          'blur(7.273px)',
              backgroundImage: HOVER_GLOW_GRADIENT,
            }}
          />
        </div>
      </div>

      {/* ── Border ring on hover - 1px matching button-subtle-border-hover ── */}
      {isHovered && (
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            borderRadius:  8,
            boxShadow:     '0 0 0 1px var(--button-subtle-border-hover)',
            pointerEvents: 'none',
            zIndex:        2,
          }}
        />
      )}

      {/* ── Content - above the glow layer ── */}
      <span style={{ display: 'flex', lineHeight: 0, flexShrink: 0, position: 'relative', zIndex: 1 }}>
        {icon}
      </span>
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
    </button>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SelectionPopoverProps {
  /** Whether the popover is visible. Set true when a text selection is active. */
  open:          boolean
  /** DOMRect from `getSelection().getRangeAt(0).getBoundingClientRect()`. Drives positioning and caret placement. */
  anchorRect:    DOMRect | null
  /** Called when Reply is clicked. Omit to hide the Reply button. */
  onReply?:      () => void
  /** Called when Highlight is clicked. Omit to hide the Highlight button. */
  onHighlight?:  () => void
  /** Called when Copy is clicked. Omit to hide the Copy button. Triggers the icon swap to ✓ for 1500ms. */
  onCopy?:       () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SelectionPopover({
  open,
  anchorRect,
  onReply,
  onHighlight,
  onCopy,
}: SelectionPopoverProps) {
  const mounted = useMounted()
  const [copied,    setCopied]    = useState(false)
  const [pos,       setPos]       = useState({ x: 0, y: 0 })
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')
  const [caretLeft, setCaretLeft] = useState<number | null>(null)

  const floatingRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useLayoutEffect(() => {
    if (!mounted || !open || !anchorRect || !floatingRef.current) return

    const virtualEl = { getBoundingClientRect: () => anchorRect }

    computePosition(virtualEl as Element, floatingRef.current, {
      placement: 'top',
      middleware: [
        offset(CARET_H + 2),
        flip({ fallbackPlacements: ['bottom'] }),
        shift({ padding: 8 }),
      ],
    }).then(({ x, y, placement: p }) => {
      setPos({ x, y })
      setPlacement(p.startsWith('bottom') ? 'bottom' : 'top')
      const anchorCenter = anchorRect.left + anchorRect.width / 2
      const floatWidth   = floatingRef.current?.offsetWidth ?? 0
      const raw          = anchorCenter - x
      const clamped      = Math.max(CARET_W + 4, Math.min(raw, floatWidth - CARET_W - 4))
      setCaretLeft(clamped - CARET_W)
    })
  }, [mounted, open, anchorRect])

  const handleCopy = () => {
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!mounted) return null

  const enterY = placement === 'top' ? 4 : -4

  const copyIcon = (
    <AnimatePresence mode="popLayout" initial={false}>
      {copied ? (
        <m.span
          key="tick"
          initial={SWAP_INITIAL}
          animate={SWAP_ANIMATE}
          exit={SWAP_EXIT}
          transition={SWAP_SPRING}
          style={{ display: 'flex', lineHeight: 0 }}
        >
          <TickTwoIcon size={16} />
        </m.span>
      ) : (
        <m.span
          key="copy"
          initial={SWAP_INITIAL}
          animate={SWAP_ANIMATE}
          exit={SWAP_EXIT}
          transition={SWAP_SPRING}
          style={{ display: 'flex', lineHeight: 0 }}
        >
          <CopyOneIcon size={16} />
        </m.span>
      )}
    </AnimatePresence>
  )

  const popover = (
    <AnimatePresence initial={false}>
      {open && anchorRect && (
        <m.div
          ref={floatingRef}
          key="selection-popover"
          role="toolbar"
          aria-label="Text actions"
          initial={{ opacity: 0, scale: 0.92, y: enterY }}
          animate={{ opacity: 1, scale: 1,    y: 0       }}
          exit={{    opacity: 0, scale: 0.92, y: enterY  }}
          transition={springs.fast}
          style={{
            position:        'fixed',
            top:             pos.y,
            left:            pos.x,
            zIndex:          40,
            display:         'flex',
            flexDirection:   'row',
            alignItems:      'center',
            gap:             2,
            padding:         '4px',
            borderRadius:    12,
            backgroundColor: BG,
            boxShadow:       SHADOW_OUTER,
          }}
        >
          {onReply && (
            <PopoverAction
              icon={<RedoIcon size={16} />}
              label="Reply"
              onClick={onReply}
            />
          )}

          {onHighlight && (
            <PopoverAction
              icon={<PenOneIcon size={16} />}
              label="Highlight"
              onClick={onHighlight}
            />
          )}

          {onCopy && (
            <PopoverAction
              icon={copyIcon}
              label={copied ? 'Copied!' : 'Copy'}
              onClick={handleCopy}
            />
          )}

          {/* Inner shadow overlay - top highlight on dark container */}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  12,
              boxShadow:     SHADOW_INNER,
              pointerEvents: 'none',
            }}
          />

          {/* Caret pointing toward the selection */}
          {caretLeft !== null && (
            <div
              aria-hidden
              style={{
                position:      'absolute',
                ...(placement === 'top'
                  ? { bottom: -CARET_H }
                  : { top:    -CARET_H }),
                left:          caretLeft,
                width:         0,
                height:        0,
                borderLeft:    `${CARET_W}px solid transparent`,
                borderRight:   `${CARET_W}px solid transparent`,
                ...(placement === 'top'
                  ? { borderTop:    `${CARET_H}px solid var(--neutral-800)` }
                  : { borderBottom: `${CARET_H}px solid var(--neutral-800)` }),
                pointerEvents: 'none',
              }}
            />
          )}
        </m.div>
      )}
    </AnimatePresence>
  )

  return createPortal(popover, document.body)
}

export default SelectionPopover
