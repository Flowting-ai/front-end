'use client'

import React, { useEffect, useState, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { springs } from '@/lib/springs'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  /** Tooltip label — plain text or any ReactNode */
  content: ReactNode
  /** The element that triggers the tooltip on hover/focus */
  children: React.ReactElement
  /** Which side of the trigger the tooltip appears on */
  side?: TooltipSide
  /** Gap between trigger and tooltip bubble in px */
  sideOffset?: number
  /** Hover delay in ms before opening */
  delayDuration?: number
  /**
   * When true the tooltip never opens and any open instance closes gracefully.
   * The Provider/Root/Trigger wrapper stays in the tree so the trigger element
   * is never remounted (preserves hover/focus state on the child).
   */
  disabled?: boolean
  className?: string
}

// ── Animation helpers ─────────────────────────────────────────────────────────
// Slide 4px toward the trigger on entry, back to 0 on exit.

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
}: TooltipProps) {
  const [open,    setOpen]    = useState(false)
  const [mounted, setMounted] = useState(false)

  // Close gracefully when disabled — exit animation will play naturally.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  // Mount on open; unmount only after the exit animation finishes via
  // `onAnimationComplete`. Keeping the portal unmounted while idle prevents
  // it from sitting in the viewport (positioned by Radix) and intercepting
  // pointer events on the trigger.
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  const handleExitComplete = () => {
    if (!open) setMounted(false)
  }

  const slideOffset = getSlideOffset(side)

  // Suppress opening while disabled; keep the wrapper always in the tree.
  const effectiveOpen = disabled ? false : open

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
              <motion.div
                className={cn(className)}
                style={{
                  // ── Visual — matches Figma node 960:1464 exactly ────────────
                  position:        'relative',
                  display:         'inline-flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  overflow:        'hidden',
                  borderRadius:    '6px',
                  padding:         '4px 6px',
                  // Gradient bg: neutral-700 → neutral-900 (same as Default button)
                  backgroundImage: 'linear-gradient(180deg, var(--tooltip-bg-from) 0%, var(--tooltip-bg-to) 100%)',
                  // Outer shadow + 0.5px black border ring
                  boxShadow:       'var(--shadow-tooltip)',
                  pointerEvents:   'none',
                }}
                initial={{ opacity: 0, x: slideOffset.x, y: slideOffset.y }}
                animate={{
                  opacity: effectiveOpen ? 1 : 0,
                  x:       effectiveOpen ? 0 : slideOffset.x,
                  y:       effectiveOpen ? 0 : slideOffset.y,
                }}
                transition={effectiveOpen ? springs.fast : { duration: 0.1 }}
                onAnimationComplete={handleExitComplete}
              >
                {/* Label */}
                <span
                  style={{
                    position:    'relative',
                    fontFamily:  'var(--font-body)',
                    fontWeight:  'var(--font-weight-medium)',
                    fontSize:    'var(--font-size-caption)',
                    lineHeight:  'var(--line-height-caption)',
                    color:       'var(--tooltip-text)',
                    whiteSpace:  'nowrap',
                    flexShrink:  0,
                  }}
                >
                  {content}
                </span>

                {/* Inner depth shadow — same language as Default button, scaled down */}
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
              </motion.div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

Tooltip.displayName = 'Tooltip'
export default Tooltip
