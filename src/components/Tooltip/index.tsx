'use client'

import React, { useEffect, useState } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: TooltipSide
  sideOffset?: number
  delayDuration?: number
  /**
   * When true the tooltip never opens. The Provider/Root/Trigger wrapper stays
   * in the tree so the trigger element is never remounted — preserving hover
   * and focus state, and keeping AnimatePresence exit animations intact.
   */
  disabled?: boolean
}

// Slide 4px toward the trigger on entry, back to 0 on exit.
function getSlideOffset(side: TooltipSide) {
  switch (side) {
    case 'top':    return { y: 4 }
    case 'bottom': return { y: -4 }
    case 'left':   return { x: 4 }
    case 'right':  return { x: -4 }
  }
}

export function Tooltip({
  content,
  children,
  side = 'top',
  sideOffset = 8,
  delayDuration = 400,
  disabled = false,
}: TooltipProps) {
  const [open,    setOpen]    = useState(false)
  const [mounted, setMounted] = useState(false)

  // Close gracefully when disabled — exit animation plays naturally.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  // Mount on open, unmount only after exit animation completes.
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  const handleExitComplete = () => {
    if (!open) setMounted(false)
  }

  // Suppress opening while disabled; always keep the wrapper in the tree.
  const effectiveOpen = disabled ? false : open
  const slideOffset   = getSlideOffset(side)

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
              style={{ outline: 'none', zIndex: 9999 }}
            >
              <motion.div
                style={{
                  position:        'relative',
                  display:         'inline-flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  overflow:        'hidden',
                  borderRadius:    '6px',
                  padding:         '4px 6px',
                  backgroundImage: 'linear-gradient(180deg, var(--tooltip-bg-from) 0%, var(--tooltip-bg-to) 100%)',
                  boxShadow:       'var(--shadow-tooltip)',
                  pointerEvents:   'none',
                }}
                initial={{ opacity: 0, ...slideOffset }}
                animate={{ opacity: effectiveOpen ? 1 : 0, x: 0, y: 0 }}
                transition={open
                  ? { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }
                  : { duration: 0.1 }
                }
                onAnimationComplete={handleExitComplete}
              >
                <span
                  style={{
                    position:   'relative',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--tooltip-text, var(--neutral-50))',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
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
              </motion.div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export default Tooltip
