'use client'

import React, { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { BrainTwoIcon, GlobalSearchIcon } from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import type { Phase } from './lib/phase'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StreamingPhase = Extract<Phase, 'thinking' | 'souvenir' | 'streaming'>

export interface StreamingIndicatorProps {
  phase: StreamingPhase
}

// ── Phase icon ────────────────────────────────────────────────────────────────

const PHASE_ICON: Record<StreamingPhase, React.ReactNode> = {
  thinking:  <BrainTwoIcon     size={14} color="var(--neutral-400)" />,
  souvenir:  <GlobalSearchIcon size={14} color="var(--neutral-400)" />,
  streaming: <BrainTwoIcon     size={14} color="var(--neutral-400)" />,
}

// ── Rotating messages per phase ───────────────────────────────────────────────

const PHASE_MESSAGES: Record<StreamingPhase, string[]> = {
  thinking:  [
    'Thinking…',
    'Reading your request…',
    'Analysing context…',
    'Deciding how to proceed…',
  ],
  souvenir:  [
    'Scanning your Pinboard…',
    'Searching for relevant context…',
    "Reviewing what you've saved…",
    'Matching pins to your request…',
  ],
  streaming: [
    'Writing…',
    'Drafting your output…',
    'Composing response…',
  ],
}

// ── Pulsing dots ──────────────────────────────────────────────────────────────

function PulsingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[0, 1, 2].map(dotIdx => (
        <m.div
          key={`dot-${dotIdx}`}
          style={{
            width:           5,
            height:          5,
            borderRadius:    '50%',
            backgroundColor: 'var(--neutral-400)',
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration:   1.2,
            repeat:     Infinity,
            delay:      dotIdx * 0.18,
            ease:       'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ── StreamingIndicator ────────────────────────────────────────────────────────

export function StreamingIndicator({ phase }: StreamingIndicatorProps) {
  const messages                    = PHASE_MESSAGES[phase]
  const [msgIndex, setMsgIndex]     = useState(0)

  // Cycle through messages every 2.5 s; reset to 0 when phase changes.
  useEffect(() => {
    setMsgIndex(0)
    const id = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length)
    }, 2500)
    return () => clearInterval(id)
  }, [phase, messages.length])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', position: 'relative' }}>
      {/* Icon */}
      <div style={{ flexShrink: 0, lineHeight: 0 }}>
        {PHASE_ICON[phase]}
      </div>

      {/* Rotating message — animates on both phase change and message cycle */}
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={`${phase}-${msgIndex}`}
          initial={{ opacity: 0, filter: 'blur(4px)', y: 4 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          exit={{    opacity: 0, filter: 'blur(4px)', y: -4 }}
          transition={springs.fast}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            fontWeight: 'var(--font-weight-medium)',
            color:      'var(--neutral-500)',
            lineHeight: 'var(--line-height-caption)',
          }}
        >
          {messages[msgIndex]}
        </m.span>
      </AnimatePresence>

      <PulsingDots />
    </div>
  )
}

StreamingIndicator.displayName = 'StreamingIndicator'
