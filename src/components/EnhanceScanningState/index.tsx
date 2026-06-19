'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnhanceScanningStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Override the message rotation cadence in ms. Default 900 - matches the PRD
   * scanning sequence (≈1.8s total = 2 messages × 900ms).
   */
  rotateMs?:     number
  /**
   * Override the message list. Default per PRD: ['Analysing your prompt…',
   * 'Looking for gaps…']. The component cycles forward and stays on the last
   * message when it reaches the end.
   */
  messages?:     string[]
}

// ── Component ─────────────────────────────────────────────────────────────────
// Per PRD §11 - [scanning] state. Indeterminate progress bar + message swap
// driven by the KDS in-place text-swap pattern (scale + opacity + blur, spring).

const DEFAULT_MESSAGES = ['Analysing your prompt…', 'Looking for gaps…'] as const

export function EnhanceScanningState({ ref, rotateMs = 900, messages, className, style, ...props }: EnhanceScanningStateProps & { ref?: React.Ref<HTMLDivElement> }) {
    const list = (messages && messages.length > 0) ? messages : (DEFAULT_MESSAGES as readonly string[])
    const [idx, setIdx] = useState(0)

    useEffect(() => {
      if (idx >= list.length - 1) return
      const id = window.setTimeout(() => setIdx(i => Math.min(i + 1, list.length - 1)), rotateMs)
      return () => window.clearTimeout(id)
    }, [idx, list.length, rotateMs])

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label="Analysing your prompt"
        className={cn(className)}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            16,
          padding:        '40px 24px',
          ...style,
        }}
        {...props}
      >
        {/* Message label - in-place swap via KDS pattern */}
        <div
          style={{
            position:       'relative',
            minHeight:      24,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     'var(--font-body)',
            fontWeight:     'var(--font-weight-medium)',
            fontSize:       'var(--font-size-body)',
            lineHeight:     'var(--line-height-body)',
            color:          'var(--color-enhance-card-text)',
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {/* eslint-disable-next-line react/no-array-index-as-key -- cycling text segments; positionally stable */}
            <m.span key={idx}
              initial={{ scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.85, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block' }}
            >
              {list[idx]}
            </m.span>
          </AnimatePresence>
        </div>

        {/* Indeterminate progress bar - sweeping pill on a track */}
        <div
          aria-hidden
          style={{
            position:        'relative',
            width:           '100%',
            maxWidth:        320,
            height:          4,
            borderRadius:    999,
            backgroundColor: 'var(--color-enhance-progress-inactive)',
            overflow:        'hidden',
          }}
        >
          <m.span
            initial={{ x: '-30%', width: '30%' }}
            animate={{ x: '130%' }}
            transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
            style={{
              position:        'absolute',
              top:             0,
              bottom:           0,
              borderRadius:    999,
              backgroundColor: 'var(--color-enhance-primary)',
            }}
          />
        </div>
      </div>
    )
}

EnhanceScanningState.displayName = 'EnhanceScanningState'

export default EnhanceScanningState
