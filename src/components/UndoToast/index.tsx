'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────
// Sits inline in a Brain thread — slightly elevated above the thread surface.
// Two-layer: outer lift + inner depth.

const SHADOW_OUTER = '0px 2px 4px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px rgba(59,54,50,0.10)'
const SHADOW_INNER = 'inset 0px 1px 0px 0px rgba(247,242,237,0.6), inset 0px -1px 0px 0px rgba(82,75,71,0.05)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UndoToastStatus = 'active' | 'undone' | 'dismissed'

export interface UndoToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The action that was just taken — shown as a neutral badge on the left */
  action: string
  /** Short description of what happened */
  description: string
  /** Duration in ms before auto-dismiss. Default 5000. */
  durationMs?: number
  /** Current status — can be controlled externally or self-managed */
  status?: UndoToastStatus
  /** Fires when Undo is clicked */
  onUndo?: () => void
  /** Fires when the toast finishes (auto-dismiss or undo confirmed) */
  onDismiss?: () => void
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export const UndoToast = React.forwardRef<HTMLDivElement, UndoToastProps>(
  function UndoToast(
    {
      action,
      description,
      durationMs = 5000,
      status: statusProp,
      onUndo,
      onDismiss,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    // Self-managed state if not controlled externally
    const [internalStatus, setInternalStatus] = useState<UndoToastStatus>('active')
    const status = statusProp ?? internalStatus

    // Live countdown — ticks every second, starts at durationMs/1000
    const totalSeconds = Math.ceil(durationMs / 1000)
    const [remaining, setRemaining] = useState(totalSeconds)

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const timerIds    = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    useEffect(() => {
      if (status !== 'active') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        return
      }

      setRemaining(totalSeconds)
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            // Auto-dismiss after countdown hits 0
            const id = setTimeout(() => {
              setInternalStatus('dismissed')
              onDismiss?.()
            }, 150)
            timerIds.current.add(id)
            return 0
          }
          return r - 1
        })
      }, 1000)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        timerIds.current.forEach(clearTimeout)
        timerIds.current.clear()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, totalSeconds])

    const handleUndo = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setInternalStatus('undone')
      onUndo?.()
      // Show "Undone" briefly then dismiss
      const id = setTimeout(() => {
        setInternalStatus('dismissed')
        onDismiss?.()
      }, 1200)
      timerIds.current.add(id)
    }

    if (status === 'dismissed') return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: springs.fast }}
        exit={{    opacity: 0, y: 4, transition: { duration: 0.15, ease: 'easeIn' } }}
      >
        <Comp
          ref={ref}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cn(className)}
          style={{
            position:        'relative',
            display:         'flex',
            alignItems:      'center',
            gap:             10,
            padding:         '10px 14px',
            borderRadius:    10,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_OUTER,
            overflow:        'hidden',
            ...style,
          }}
          {...props}
        >
          {/* Inner shadow overlay */}
          <span
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              borderRadius:  'inherit',
              pointerEvents: 'none',
              boxShadow:     SHADOW_INNER,
              zIndex:        1,
            }}
          />

          {/* Action badge */}
          <span
            style={{
              position:        'relative',
              zIndex:          0,
              display:         'inline-flex',
              alignItems:      'center',
              padding:         '2px 8px',
              borderRadius:    6,
              backgroundColor: 'var(--neutral-100)',
              fontFamily:      'var(--font-body)',
              fontWeight:      'var(--font-weight-medium)',
              fontSize:        'var(--font-size-caption)',
              lineHeight:      'var(--line-height-caption)',
              color:           'var(--neutral-600, #6a625d)',
              whiteSpace:      'nowrap',
              flexShrink:      0,
            }}
          >
            {action}
          </span>

          {/* Description */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(2px)' }}
              animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)', transition: springs.fast }}
              exit={{    opacity: 0, scale: 0.92, filter: 'blur(2px)', transition: { duration: 0.1, ease: 'easeIn' } }}
              style={{
                flex:         '1 0 0',
                minWidth:     1,
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     'var(--font-size-body)',
                lineHeight:   'var(--line-height-body)',
                color:        status === 'undone' ? 'var(--neutral-500)' : 'var(--neutral-700, #524b47)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                display:      'block',
              }}
            >
              {status === 'undone' ? 'Undone' : description}
            </motion.span>
          </AnimatePresence>

          {/* Undo CTA — only in active state */}
          <AnimatePresence initial={false}>
            {status === 'active' && (
              <motion.button
                key="undo-btn"
                type="button"
                onClick={handleUndo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
                exit={{    opacity: 0, transition: { duration: 0.08 } }}
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                style={{
                  position:       'relative',
                  zIndex:         0,
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            4,
                  padding:        0,
                  border:         'none',
                  background:     'none',
                  cursor:         'pointer',
                  fontFamily:     'var(--font-body)',
                  fontWeight:     'var(--font-weight-medium)',
                  fontSize:       'var(--font-size-body)',
                  lineHeight:     'var(--line-height-body)',
                  color:          'var(--neutral-900)',
                  whiteSpace:     'nowrap',
                  flexShrink:     0,
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--neutral-300)',
                  outline:        'none',
                }}
                className="kds-undo-toast-btn"
                aria-label={`Undo — ${remaining} second${remaining !== 1 ? 's' : ''} remaining`}
              >
                Undo
                {/* Live countdown */}
                <span
                  aria-hidden
                  style={{
                    display:         'inline-flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    minWidth:        18,
                    padding:         '0 3px',
                    borderRadius:    4,
                    backgroundColor: 'var(--neutral-100)',
                    fontFamily:      'var(--font-body)',
                    fontWeight:      'var(--font-weight-medium)',
                    fontSize:        11,
                    lineHeight:      '16px',
                    color:           'var(--neutral-500)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {remaining}s
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </Comp>
      </motion.div>
    )
  },
)

UndoToast.displayName = 'UndoToast'
export default UndoToast
