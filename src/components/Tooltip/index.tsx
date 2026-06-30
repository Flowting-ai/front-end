'use client'

import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: ReactNode
  children: React.ReactElement
  side?: TooltipSide
  sideOffset?: number
  delayDuration?: number
  /**
   * When true the tooltip never opens and any open instance closes gracefully.
   * The Provider/Root/Trigger wrapper stays in the tree so the trigger element
   * is never remounted.
   */
  disabled?: boolean
  className?: string
  /**
   * When set, caps the tooltip width and allows content to wrap. Useful for
   * model descriptions or other multi-line rich content. Without this the
   * tooltip is single-line (whiteSpace: nowrap).
   */
  maxWidth?: number | string
}

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
  sideOffset = 8,
  delayDuration = 400,
  disabled = false,
  className,
  maxWidth,
}: TooltipProps) {
  const [open,    setOpen]    = useState(false)
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

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

  const slideOffset = getSlideOffset(side)

  const translateX = entered ? 0 : slideOffset.x
  const translateY = entered ? 0 : slideOffset.y

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root open={effectiveOpen} onOpenChange={disabled ? undefined : setOpen}>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>

        {mounted && (
          <TooltipPrimitive.Portal forceMount>
            <TooltipPrimitive.Content
              side={side}
              sideOffset={sideOffset}
              forceMount
              className="z-[9999]"
              style={{ outline: 'none', pointerEvents: 'none' }}
            >
              <div
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
                  maxWidth:        maxWidth,
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
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

Tooltip.displayName = 'Tooltip'
export default Tooltip
