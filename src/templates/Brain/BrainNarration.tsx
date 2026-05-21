'use client'

import React, { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'

// ── StreamCursor ────────────────────────────────────────────────────────────────
// Inline blinking cursor — same as StreamingMessageBubble's cursor.

function StreamCursor() {
  return (
    <m.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity }}
      style={{
        display:         'inline-block',
        width:           2,
        height:          '1em',
        borderRadius:    1,
        backgroundColor: 'var(--neutral-500)',
        marginLeft:      2,
        verticalAlign:   'middle',
      }}
      aria-hidden
    />
  )
}

// ── useStreamingTypewriter ──────────────────────────────────────────────────────
// RAF ease-out lerp: reveals ~6% of remaining chars per 16ms frame.
// Same hook as StreamingMessageBubble — duplicated here to keep narration standalone.

function useStreamingTypewriter(fullText: string, enabled: boolean) {
  const [displayLen, setDisplayLen] = useState(() => enabled ? 0 : fullText.length)
  const rafRef = useRef<number | null>(null)

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!enabled) { setDisplayLen(fullText.length); return }
    setDisplayLen(0)
    const tick = () => {
      setDisplayLen(prev => {
        const remaining = fullText.length - prev
        if (remaining <= 0) return prev
        const advance = Math.max(1, Math.ceil(remaining * 0.06))
        return Math.min(prev + advance, fullText.length)
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [fullText, enabled])

  return fullText.slice(0, displayLen)
}

// ── Inline code renderer ────────────────────────────────────────────────────────
// Splits on backticks and renders inline code spans.

function renderNarrationText(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g)
  // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no IDs; positions are stable
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no IDs; positions are stable
        <code key={i} style={{
          fontFamily:      'var(--font-mono, monospace)',
          fontSize:        '0.9em',
          backgroundColor: 'var(--neutral-100)',
          color:           'var(--neutral-700)',
          padding:         '1px 5px',
          borderRadius:    4,
          border:          '1px solid var(--neutral-200)',
        }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function NarrationText({ text }: { text: string }) {
  // eslint-disable-next-line react-doctor/no-render-in-render -- renderNarrationText is a stable module-level helper, not an inline component
  return <>{renderNarrationText(text)}</>
}

// ── Types ───────────────────────────────────────────────────────────────────────

export interface BrainNarrationProps {
  /** The prose text Brain says between phases. Supports `inline code`. */
  text:          string
  /** When true, animates text in with a typewriter effect + cursor. @default false */
  isStreaming?:  boolean
}

// ── BrainNarration ─────────────────────────────────────────────────────────────
/**
 * AI real-time narration between phases.
 * "Now let me load the `search_events` tool…" style prose.
 * Streams in live during execution; sits static in history.
 */
export function BrainNarration({ text, isStreaming = false }: BrainNarrationProps) {
  const displayed = useStreamingTypewriter(text, isStreaming)
  const isComplete = displayed.length >= text.length

  return (
    <p style={{
      margin:      0,
      fontFamily:  'var(--font-body)',
      fontSize:    'var(--font-size-body)',
      fontWeight:  'var(--font-weight-regular)',
      lineHeight:  'var(--line-height-body)',
      color:       'var(--neutral-800)',
    }}>
      <NarrationText text={displayed} />
      {isStreaming && !isComplete && <StreamCursor />}
    </p>
  )
}

BrainNarration.displayName = 'BrainNarration'
