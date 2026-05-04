'use client'

import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { motion, AnimatePresence, useIsPresent, useMotionValue, animate } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  MoreVerticalIcon,
  MessagePreviewOneIcon,
  InputShortTextIcon,
} from '@strange-huge/icons'
import { LlmIcon } from '@strange-huge/icons/llm'
import { PinCategory, type PinCategoryType } from '@/components/PinCategory'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { PinCommentField } from '@/components/PinCommentField'
import { Tooltip } from '@/components/Tooltip'

// ── Constants ─────────────────────────────────────────────────────────────────

const SHADOW_CARD    = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
const DRAG_THRESHOLD = 8   // px to commit collapse when already expanded — small upward drag is enough
const LINE_HEIGHT_PX = 16  // --line-height-caption, one description line
const MAX_SNAP_LINES = 12  // auto-expand triggers if user drags beyond this many extra lines

// ── useMeasure ────────────────────────────────────────────────────────────────
// Wraps ResizeObserver to track an element's border-box dimensions.
// Returns [ref, bounds] — attach ref to the INNER element, animate the OUTER.
// Uses borderBoxSize (includes padding) not contentRect (excludes padding).

function useMeasure() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [bounds,  setBounds]  = useState({ width: 0, height: 0 })

  const ref = useCallback((node: HTMLElement | null) => setElement(node), [])

  useLayoutEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const bb = entry.borderBoxSize?.[0]
      setBounds({
        width:  bb ? bb.inlineSize : entry.contentRect.width,
        height: bb ? bb.blockSize  : entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, bounds] as const
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PinLabel {
  color: BadgeColor
  text:  string
}

export interface PinProps extends Omit<React.HTMLAttributes<HTMLDivElement>,
  'children' | 'onDrag' | 'onDragEnd' | 'onDragStart' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDrop'
> {
  category?:        PinCategoryType
  pinTitle?:        string
  description?:     string
  labels?:          PinLabel[]
  chatName?:        string
  defaultExpanded?: boolean
  /** When this number changes, the pin collapses if it's currently expanded.
   *  Used by Pinboard's "collapse all" action. Initial value is ignored. */
  collapseSignal?:  number
  /** Fires when the pin's "open" state changes — true whenever it's showing
   *  more than the default 2 lines (either fully expanded OR dragged to an
   *  intermediate snap point with `extraLines > 0`). Pinboard uses this to
   *  show/hide the "collapse all" button. */
  onExpandedChange?: (open: boolean) => void
  onInsert?:        () => void
  fluid?:           boolean
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_DESCRIPTION =
  'The key distinction is that replicants possess implanted memories, making their emotional responses genuine even if their origins are artificial. This creates a philosophical paradox where authenticity of experience doesn\'t require authenticity of origin.\n\nEmpathy remains the defining boundary — the Voigt-Kampff test measures involuntary empathic response, suggesting that genuine emotional capacity, not memory or intelligence, separates human from artificial.\n\nRoy Batty\'s final monologue crystallises this tension — a being designed for servitude articulating loss, beauty, and mortality with a depth that confounds any clean distinction between programmed behaviour and genuine consciousness.'

const DEFAULT_LABELS: PinLabel[] = [
  { color: 'Blue',   text: 'Label' },
  { color: 'Red',    text: 'Label' },
  { color: 'Green',  text: 'Label' },
  { color: 'Yellow', text: 'Label' },
  { color: 'Purple', text: 'Label' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export const Pin = React.forwardRef<HTMLDivElement, PinProps>(
  function Pin(
    {
      category        = 'Code',
      pinTitle        = 'Pin title is too long that it can go to the next line',
      description     = DEFAULT_DESCRIPTION,
      labels          = DEFAULT_LABELS,
      chatName        = 'This will the chat name to which this pin belongs to.',
      defaultExpanded = false,
      collapseSignal,
      onExpandedChange,
      onInsert,
      fluid           = false,
      className,
      style,
      onMouseEnter: externalEnter,
      onMouseLeave: externalLeave,
      ...props
    },
    forwardedRef,
  ) {
    const [isHovered,  setIsHovered]  = useState(false)
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const [isDragging, setIsDragging] = useState(false)
    // Extra description lines beyond the base 2 (0–12). Card settles at any snap point.
    const [extraLines, setExtraLines] = useState(0)

    const [contentRef, contentBounds] = useMeasure()

    const commentFieldRef    = useRef<HTMLTextAreaElement>(null)
    const focusCommentRef    = useRef(false)
    const cardRef            = useRef<HTMLDivElement>(null)
    const dragInfo           = useRef({ startY: 0, startHeight: 0 })
    const rafRef             = useRef<number>(0)
    const isDraggingRef      = useRef(false)
    const isExpandedRef      = useRef(isExpanded)
    isExpandedRef.current    = isExpanded
    const skipActionBarEntry = useRef(false)
    // Set true just before calling setIsExpanded(false) so contentBounds effect
    // knows to use the collapse easing instead of the default spring.
    const collapsingRef = useRef(false)
    // Tracks the last pointer move sample for velocity calculation on release.
    const lastMoveRef = useRef({ y: 0, time: 0 })

    // cardHeightMV — single source of truth for card height.
    // set() during drag (instant, cursor-locked), animate() at rest (spring).
    const cardHeightMV = useMotionValue(0)

    const springCfg   = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 }
    const collapseCfg = { type: 'tween'  as const, ease: [0, 0.64, 0.12, 0.99] as const, duration: 0.35 }

    const mergedRef = useCallback((el: HTMLDivElement | null) => {
      cardRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    }, [forwardedRef])

    // contentBounds → cardHeightMV
    // Uses collapse easing when triggered by a drag-collapse, spring otherwise.
    useEffect(() => {
      if (isDraggingRef.current) return
      if (contentBounds.height > 0) {
        const cfg = collapsingRef.current ? collapseCfg : springCfg
        collapsingRef.current = false
        animate(cardHeightMV, contentBounds.height, cfg)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentBounds.height])

    // "Open" = pin is showing more than the default 2 lines, either because
    // it's fully expanded OR because the user dragged the handle to reveal
    // extra lines (intermediate snap state). Both cases should show the
    // Pinboard "collapse all" button and respond to its click.
    const isOpen = isExpanded || extraLines > 0

    // External collapse trigger — Pinboard increments `collapseSignal` to fold
    // every open pin. Initial value is captured and skipped so a freshly
    // mounted Pin doesn't collapse on first render.
    const isOpenRef = useRef(isOpen)
    isOpenRef.current = isOpen
    const initialCollapseSignalRef = useRef(collapseSignal)
    useEffect(() => {
      if (collapseSignal === initialCollapseSignalRef.current) return
      if (!isOpenRef.current) return
      collapsingRef.current = true
      setIsExpanded(false)
      setExtraLines(0)
    }, [collapseSignal])

    // Notify parent on open-state change (skipping the initial mount so
    // Pinboard doesn't get a flood of false signals from collapsed pins).
    // Callback held in a ref so re-renders that produce a new function identity
    // don't trip the effect on every render.
    const onExpandedChangeRef = useRef(onExpandedChange)
    useEffect(() => { onExpandedChangeRef.current = onExpandedChange })
    const didMountRef = useRef(false)
    useEffect(() => {
      if (!didMountRef.current) {
        didMountRef.current = true
        return
      }
      onExpandedChangeRef.current?.(isOpen)
    }, [isOpen])

    // Max px the card can grow past its natural height on downward drag.
    const MAX_OVERSHOOT = 32
    // Elastic factor for downward drag — card grows at this fraction of cursor speed.
    // Gives progressively-feeling resistance; spring on release snaps it back.
    const ELASTIC_FACTOR = 0.2

    // ── Handle drag — unified pointer events for all states ───────────────────
    // The handle sits at position:absolute bottom:4px and follows the card
    // naturally as cardHeightMV changes. No separate y transform needed.

    const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      // Cancel any in-flight height animation (e.g. the spring still settling
      // after a comment-click expand) so the drag has full control of the
      // motion value from frame 0.
      cardHeightMV.stop()
      const h = cardHeightMV.get()
      dragInfo.current           = { startY: e.clientY, startHeight: h }
      skipActionBarEntry.current = isExpanded || isHovered
      isDraggingRef.current      = true
      e.currentTarget.setPointerCapture(e.pointerId)
      e.stopPropagation()
      setIsDragging(true)
    }

    const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return
      const clientY = e.clientY
      lastMoveRef.current = { y: clientY, time: performance.now() }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const rawDelta = clientY - dragInfo.current.startY

        if (!isExpanded) {
          // ── Collapsed / intermediate: drag up to reveal lines ────────────
          const minDelta     = -extraLines * LINE_HEIGHT_PX
          const clampedDelta = Math.max(minDelta, rawDelta)
          if (extraLines * LINE_HEIGHT_PX + clampedDelta > MAX_SNAP_LINES * LINE_HEIGHT_PX) {
            isDraggingRef.current      = false
            skipActionBarEntry.current = false
            setIsDragging(false)
            setIsExpanded(true)
            setExtraLines(0)
            return
          }
          cardHeightMV.set(dragInfo.current.startHeight + clampedDelta)
        } else {
          if (rawDelta > 0) {
            // ── Expanded, dragging down — elastic resistance ──────────────
            // Card grows at ELASTIC_FACTOR of cursor speed, capped at MAX_OVERSHOOT.
            // Handle moves 1:1 with card (bottom:4px) — no transform mismatch.
            const stretch = Math.min(rawDelta * ELASTIC_FACTOR, MAX_OVERSHOOT)
            cardHeightMV.set(dragInfo.current.startHeight + stretch)
          } else {
            // ── Expanded, dragging up — linear toward collapse ────────────
            cardHeightMV.set(Math.max(dragInfo.current.startHeight + rawDelta, 60))
          }
        }
      })
    }

    const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return
      cancelAnimationFrame(rafRef.current)
      const rawDelta             = e.clientY - dragInfo.current.startY
      isDraggingRef.current      = false
      skipActionBarEntry.current = false
      setIsDragging(false)

      if (!isExpanded) {
        // ── Snap to nearest line ─────────────────────────────────────────
        const minDelta     = -extraLines * LINE_HEIGHT_PX
        const clampedDelta = Math.max(minDelta, rawDelta)
        const snappedDelta = Math.round(clampedDelta / LINE_HEIGHT_PX) * LINE_HEIGHT_PX
        const newExtra     = Math.max(0, extraLines + snappedDelta / LINE_HEIGHT_PX)

        if (newExtra >= MAX_SNAP_LINES) {
          setIsExpanded(true)
          setExtraLines(0)
        } else {
          setExtraLines(newExtra)
          // contentBounds update → animate(cardHeightMV, newH, spring)
        }
      } else {
        // Velocity in px/ms — negative means moving up.
        // A quick flick (< -0.3 px/ms) collapses even with a short drag distance.
        const dt = performance.now() - lastMoveRef.current.time
        const velocity = dt > 0 ? (e.clientY - lastMoveRef.current.y) / dt : 0
        const shouldCollapse = -rawDelta > DRAG_THRESHOLD || velocity < -0.3

        if (shouldCollapse) {
          // Dragged or flicked up → collapse with easing
          collapsingRef.current = true
          setIsExpanded(false)
          setExtraLines(0)
          // contentBounds update → animate with collapseCfg
        } else if (rawDelta > 0) {
          // Released after elastic downward stretch → spring back to natural height
          animate(cardHeightMV, dragInfo.current.startHeight, {
            type:     'tween',
            ease:     [0, 0.64, 0.12, 0.99],
            duration: 0.35,
          })
        }
        // rawDelta < 0 but not past threshold → contentBounds handles spring back
      }
    }

    const showFull = isExpanded || isDragging

    const focusAndScrollCommentField = () => {
      const ta = commentFieldRef.current
      if (!ta) return
      ta.focus()
      // Bring the comment field into view in whatever ancestor is scrolling
      // (Pinboard's scroll container, or the page). `block: 'nearest'` only
      // scrolls if the element is actually clipped.
      ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    const handleCommentClick = () => {
      if (!isExpanded) {
        focusCommentRef.current = true
        setIsExpanded(true)
      } else {
        focusAndScrollCommentField()
      }
    }

    // Focus + scroll the comment textarea after the expand animation completes.
    useEffect(() => {
      if (isExpanded && focusCommentRef.current) {
        focusCommentRef.current = false
        const id = requestAnimationFrame(focusAndScrollCommentField)
        return () => cancelAnimationFrame(id)
      }
    }, [isExpanded])

    return (
      <motion.div
        ref={mergedRef as React.Ref<HTMLDivElement>}
        className={cn(className)}
        style={{
          height:          cardHeightMV,
          position:        'relative',
          width:           fluid ? '100%' : '314px',
          borderRadius:    '16px',
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       SHADOW_CARD,
          overflow:        'clip',
          isolation:       'isolate',
          ...style,
        }}
        onMouseEnter={(e) => { setIsHovered(true); externalEnter?.(e as unknown as React.MouseEvent<HTMLDivElement>) }}
        onMouseLeave={(e) => {
          if (!isDraggingRef.current) setIsHovered(false)
          externalLeave?.(e as unknown as React.MouseEvent<HTMLDivElement>)
        }}
        {...(props as object)}
      >

        {/* ── Inner content div — measured by useMeasure ──────────────────────
            Contains only in-flow content. Drag handle and action bars are
            SIBLINGS of this div (children of the outer motion.div) so their
            bottom:0 is relative to the outer clip boundary, not this div.
            As drag grows the outer div, the action bar stays pinned to the
            outer bottom while this div's content scrolls up behind it.       ── */}
        <div
          ref={contentRef as React.Ref<HTMLDivElement>}
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '16px',
            alignItems:    'flex-start',
            paddingTop:    '12px',
            paddingBottom: isDragging ? '64px' : '16px',
            paddingLeft:   '12px',
            paddingRight:  '12px',
          }}
        >

          {/* ── Header row ── */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'flex', flex: '1 0 0', gap: '12px', alignItems: 'center', minWidth: 0 }}>
              <PinCategory type={category} style={{ flexShrink: 0 }} />
              <p
                style={{
                  flex:         '1 0 0',
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-medium)',
                  fontSize:     'var(--font-size-body)',
                  lineHeight:   'var(--line-height-body)',
                  color:        'var(--neutral-900)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  margin:       0,
                  minWidth:     0,
                }}
              >
                {pinTitle}
              </p>
            </div>
            <IconButton
              variant="ghost"
              size="sm"
              icon={<MoreVerticalIcon size={20} />}
              aria-label="More options"
              style={{ flexShrink: 0 }}
            />
          </div>

          {/* ── Labels row ── */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', flexShrink: 0, flexWrap: 'wrap' }}>
            {labels.map((l, i) => <Badge key={i} label={l.text} color={l.color} />)}
          </div>

          {/* ── Description ──
              showFull (isDragging | isExpanded): unclamped — card clips at dragHeight
              at rest with extraLines > 0: cage grows by extraLines × 16px
              at rest collapsed: 2-line cage (32px)                              ── */}
          {(() => {
            const visibleLines  = 2 + extraLines           // base 2 + settled extra
            // +12px when showing extra lines so the last snapped line is never
            // half-clipped — the line-height token alone lands 12px short visually
            const cageH         = visibleLines * LINE_HEIGHT_PX + (extraLines > 0 ? 12 : 0)
            return (
              <div
                style={{
                  height:    showFull ? 'auto' : `${cageH}px`,
                  minHeight: showFull ? undefined : `${cageH}px`,
                  maxHeight: showFull ? undefined : `${cageH}px`,
                  overflow:  showFull ? 'visible' : 'hidden',
                  width:     '100%',
                  flexShrink: 0,
                  flexGrow:   0,
                }}
              >
                <p
                  style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-weight-regular)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-500)',
                    // showFull (drag/expanded): unclamped pre-wrap
                    // intermediate (extraLines > 0): pre-wrap + overflow:hidden — preserves \n paragraph breaks
                    // collapsed (extraLines = 0): -webkit-line-clamp for ellipsis on 2 lines
                    ...(showFull || extraLines > 0
                      ? { whiteSpace: 'pre-wrap' }
                      : {
                          display:         '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow:        'hidden',
                          textOverflow:    'ellipsis',
                        }
                    ),
                  }}
                >
                  {description}
                </p>
              </div>
            )
          })()}

          {/* ── Expanded content: metadata + comment field ── */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="expanded-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{   opacity: 0, transition: { duration: 0 } }}
                style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <ExpandedMeta chatName={chatName} />
                <PinCommentField ref={commentFieldRef} fluid aria-label="Add a comment" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Inline action bar — expanded state (stays during drag) ── */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="action-bar-expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
                exit={{   opacity: 0, transition: { duration: 0 } }}
                style={{ width: '100%', flexShrink: 0 }}
              >
                <ActionBar onInsert={onInsert} onComment={handleCommentClick} hideComment />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        {/* ── end inner content div ── */}

        {/* ── Drag handle — child of OUTER motion.div ──────────────────────────
            Uses Framer's drag="y" for dragElastic + dragMomentum feel.
            handleY motion value drives dragHeight via onChange subscription.   ── */}
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={isExpanded ? 'Collapse pin' : 'Expand pin'}
          aria-expanded={isExpanded}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isExpanded) { e.preventDefault(); setIsExpanded(true) } }}
          onDoubleClick={(e) => { e.stopPropagation(); if (!isExpanded) setIsExpanded(true) }}
          style={{
            position:       'absolute',
            bottom:         '4px',
            left:           'calc(50% - 16px)',
            width:          '32px',
            height:         '12px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         isDragging ? 'grabbing' : 'grab',
            userSelect:     'none',
            touchAction:    'none',
            zIndex:         2,
          }}
        >
          <div
            style={{
              width:           '32px',
              height:          '2px',
              borderRadius:    '1px',
              backgroundColor: 'var(--neutral-200)',
              pointerEvents:   'none',
            }}
          />
        </motion.div>

        {/* ── Absolute action bar — child of OUTER motion.div ──────────────────
            AbsoluteActionBar is a dedicated component so useIsPresent can be
            called inside AnimatePresence (the hook must live in a child, not
            the parent where the conditional render happens).                 ── */}
        <AnimatePresence initial={false}>
          {!isExpanded && (isHovered || isDragging || extraLines > 0) ? (
            <AbsoluteActionBar
              key="action-bar-absolute"
              onInsert={onInsert}
              onComment={handleCommentClick}
              instant={skipActionBarEntry.current}
            />
          ) : null}
        </AnimatePresence>

      </motion.div>
    )
  },
)

// ── Shared sub-components ─────────────────────────────────────────────────────

function ExpandedMeta({ chatName }: { chatName: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
      <Badge label="1h" color="Green" />
      <p
        style={{
          flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-semibold)',
          fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, minWidth: 0,
        }}
      >
        {chatName}
      </p>
      <div style={{ width: 24, height: 24, borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
        <LlmIcon id="Claude" variant="avatar" size={24} />
      </div>
    </div>
  )
}

// ── AbsoluteActionBar ─────────────────────────────────────────────────────────
// Dedicated component so useIsPresent can be called inside AnimatePresence.
// Article rule: useIsPresent must live in a child of AnimatePresence, not the
// parent where the conditional render happens.
//
// Animation design:
//   Enter — slides up (y: 8→0) + fades in + unblurs: panel materialises from below
//   Exit  — shorter slide (y: 0→4), same blur: eye needs less signal for departures
//   useIsPresent → pointerEvents:none during exit so fast mouse-outs can't
//                  accidentally trigger Insert during the 180ms fade

function AbsoluteActionBar({ onInsert, onComment, instant }: { onInsert?: () => void; onComment?: () => void; instant?: boolean }) {
  const isPresent = useIsPresent()

  return (
    <motion.div
      initial={instant
        ? { opacity: 1, y: 0, filter: 'blur(0px)' }
        : { opacity: 0, y: 8, filter: 'blur(4px)' }
      }
      animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
      exit={{   opacity: 0, y: 4,  filter: 'blur(4px)' }}
      transition={{
        duration: 0.2,
        ease:     [0.25, 0.46, 0.45, 0.94],
      }}
      style={{
        position:        'absolute',
        bottom:          0,
        left:            0,
        right:           0,
        backgroundColor: 'var(--neutral-white)',
        paddingBottom:   '16px',
        paddingLeft:     '12px',
        paddingRight:    '12px',
        paddingTop:      '8px',
        zIndex:          1,
        // Disable clicks while the bar is animating out — prevents accidental
        // "Insert" triggers during the exit fade (useIsPresent returns false
        // as soon as the exit animation begins).
        pointerEvents:   isPresent ? 'auto' : 'none',
      }}
    >
      <ActionBar onInsert={onInsert} onComment={onComment} />
    </motion.div>
  )
}

function ActionBar({ onInsert, onComment, hideComment = false }: { onInsert?: () => void; onComment?: () => void; hideComment?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Tooltip content="Show in chat">
          <IconButton variant="ghost" size="sm" icon={<MessagePreviewOneIcon size={20} />} aria-label="Show in chat" />
        </Tooltip>
        {!hideComment && (
          <Tooltip content="Comment">
            <IconButton variant="ghost" size="sm" icon={<InputShortTextIcon size={20} />} aria-label="Comment" onClick={onComment} />
          </Tooltip>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onInsert}>Insert</Button>
    </div>
  )
}

Pin.displayName = 'Pin'
export default Pin
