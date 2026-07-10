'use client'

import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: ReactNode
  children: React.ReactElement
  side?: TooltipSide
  /**
   * Alignment of the tooltip along `side`. Defaults to `center`. Use `end`
   * to pin the tooltip's trailing edge to the trigger's trailing edge so
   * growing content expands toward the leading edge (e.g. to the left in
   * LTR) instead of overflowing past it.
   */
  align?: TooltipAlign
  sideOffset?: number
  delayDuration?: number
  /**
   * When true the tooltip never opens and any open instance closes gracefully.
   * The Provider/Root/Trigger wrapper stays in the tree so the trigger element
   * is never remounted.
   */
  disabled?: boolean
  /**
   * Controlled open state — overrides the normal hover/focus-driven behavior.
   * Pass `true` to force the tooltip permanently visible (e.g. a value badge
   * that tracks a slider thumb) or `false` to force it closed. Omit for the
   * default hover/focus tooltip behavior.
   */
  open?: boolean
  className?: string
  /**
   * When set, caps the tooltip width and allows content to wrap. Useful for
   * model descriptions or other multi-line rich content. Without this the
   * tooltip is single-line (whiteSpace: nowrap).
   */
  maxWidth?: number | string
  /**
   * When set, caps the tooltip height. Instead of scrolling, content that
   * would exceed this height causes the tooltip to widen (up to a sane cap)
   * so wrapped text needs fewer lines — no scrollbar ever appears. Pair with
   * `align="end"` so the added width grows toward the trigger's leading edge
   * instead of overflowing past its trailing edge.
   */
  maxHeight?: number
  /**
   * Render to `document.body` (default) so the tooltip escapes ancestor
   * `overflow`/clipping — the right choice for virtually all hover tooltips.
   * Pass `false` to keep the content in its natural DOM position instead —
   * use this for a persistent, non-hover badge that must stay below other
   * same-page chrome (e.g. a footer) regardless of z-index, since a portaled
   * node competes at the document root and no local z-index can out-rank it.
   */
  portal?: boolean
  /**
   * Stacking order for the floating content. Defaults to 9999 (above nearly
   * everything) — appropriate when `portal` is true. When `portal` is false,
   * pass a value that makes sense within the local stacking context instead.
   */
  zIndex?: number
}

// Absolute ceiling for the auto-widen behavior below — no tooltip should ever
// grow past this regardless of `maxWidth` or viewport size.
const ABSOLUTE_WIDTH_CAP = 600

// ── Animation helpers ─────────────────────────────────────────────────────────

function getSlideOffset(side: TooltipSide): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: 0,  y: 4 }
    case 'bottom': return { x: 0,  y: -4 }
    case 'left':   return { x: 4,  y: 0 }
    case 'right':  return { x: -4, y: 0 }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 8,
  delayDuration = 400,
  disabled = false,
  open: openProp,
  className,
  maxWidth,
  maxHeight,
  portal = true,
  zIndex = 9999,
}: TooltipProps) {
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const [mounted,       setMounted]     = useState(false)
  const [entered,       setEntered]     = useState(false)
  const rafRef = useRef<number>(0)
  const contentBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (disabled) setInternalOpen(false)
  }, [disabled])

  const open = isControlled ? openProp : internalOpen
  const effectiveOpen = disabled ? false : open

  useEffect(() => {
    if (effectiveOpen) {
      setMounted(true)
      // Double-RAF so the browser has painted the initial (hidden) state before
      // we flip entered=true, giving CSS transition something to animate from.
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setEntered(true))
      })
    } else {
      cancelAnimationFrame(rafRef.current)
      setEntered(false)
      // unmount happens in onTransitionEnd once opacity transition settles
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [effectiveOpen])

  // Widen instead of scrolling: measure the rendered box against `maxHeight`
  // and, if it overflows, grow the width in steps (re-measuring each step)
  // until the wrapped text fits or a sane cap is hit. Runs imperatively via
  // direct style writes so it settles within one paint — no render loop.
  useLayoutEffect(() => {
    if (!maxHeight || !mounted) return
    const el = contentBoxRef.current
    if (!el) return
    const rawBaseWidth = typeof maxWidth === 'number' ? maxWidth : (maxWidth ? el.getBoundingClientRect().width : 200)
    const baseWidth = Math.min(rawBaseWidth, ABSOLUTE_WIDTH_CAP)
    const viewportCap = typeof window !== 'undefined' ? window.innerWidth - 48 : baseWidth * 2.5
    const hardCap = Math.min(baseWidth * 2.5, viewportCap, ABSOLUTE_WIDTH_CAP)

    let width = baseWidth
    el.style.width = `${width}px`
    while (el.scrollHeight > maxHeight && width < hardCap) {
      width = Math.min(width + 24, hardCap)
      el.style.width = `${width}px`
    }
  }, [mounted, content, maxWidth, maxHeight])

  const slideOffset = getSlideOffset(side)

  const translateX = entered ? 0 : slideOffset.x
  const translateY = entered ? 0 : slideOffset.y

  // CSS-level ceiling — authoritative regardless of the JS auto-widen effect
  // above, so the box can never render past ABSOLUTE_WIDTH_CAP even if a
  // caller passes a larger `maxWidth` (e.g. a wide dropdown's own width).
  // When `maxHeight` drives auto-widen, this is the only width constraint —
  // the JS effect sets the actual `width` under this ceiling.
  const cssMaxWidth = maxHeight
    ? ABSOLUTE_WIDTH_CAP
    : (typeof maxWidth === 'number' ? Math.min(maxWidth, ABSOLUTE_WIDTH_CAP) : maxWidth)

  const tooltipContent = (
    <TooltipPrimitive.Content
      side={side}
      align={align}
      sideOffset={sideOffset}
      forceMount
      style={{ outline: 'none', pointerEvents: 'none', zIndex }}
    >
      <div
        ref={contentBoxRef}
        className={cn(className)}
        onTransitionEnd={() => { if (!effectiveOpen) setMounted(false) }}
        style={{
          position:        'relative',
          display:         'inline-flex',
          alignItems:      maxWidth ? 'flex-start' : 'center',
          justifyContent:  'center',
          flexDirection:   maxWidth ? 'column' : undefined,
          overflow:        'hidden',
          borderRadius:    '6px',
          padding:         maxWidth ? '6px 8px' : '4px 6px',
          maxWidth:        cssMaxWidth,
          maxHeight:       maxHeight,
          backgroundImage: 'linear-gradient(180deg, var(--tooltip-bg-from) 0%, var(--tooltip-bg-to) 100%)',
          boxShadow:       'var(--shadow-tooltip)',
          pointerEvents:   'none',
          opacity:          entered ? 1 : 0,
          transform:        `translate(${translateX}px, ${translateY}px)`,
          transition:       'opacity 150ms, transform 150ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <span
          style={{
            position:    'relative',
            fontFamily:  'var(--font-body)',
            fontWeight:  'var(--font-weight-medium)',
            fontSize:    'var(--font-size-caption)',
            lineHeight:  'var(--line-height-caption)',
            color:       'var(--tooltip-text)',
            whiteSpace:  maxWidth ? 'normal' : 'nowrap',
            wordBreak:   maxWidth ? 'break-word' : undefined,
            flexShrink:  0,
          }}
        >
          {content}
        </span>

        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            pointerEvents: 'none',
            borderRadius:  'inherit',
            boxShadow:     'var(--shadow-tooltip-inner)',
          }}
        />
      </div>
    </TooltipPrimitive.Content>
  )

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root open={effectiveOpen} onOpenChange={disabled || isControlled ? undefined : setInternalOpen}>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>

        {mounted && (portal
          ? <TooltipPrimitive.Portal forceMount>{tooltipContent}</TooltipPrimitive.Portal>
          : tooltipContent)}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

Tooltip.displayName = 'Tooltip'
export default Tooltip
