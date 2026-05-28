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

// ── Inline code + citation renderer ────────────────────────────────────────────
// Splits on backtick code spans AND [N] citation refs.

function renderNarrationText(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\[\d+\])/g)
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
    if (/^\[\d+\]$/.test(part)) {
      const num = part.slice(1, -1)
      return (
        // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- regex-split text segments have no IDs; positions are stable
        <sup key={i} aria-label={`citation ${num}`} style={{
          fontFamily:      'var(--font-body)',
          fontSize:        '10px',
          lineHeight:      1,
          color:           'var(--neutral-700)',
          backgroundColor: 'var(--neutral-100)',
          borderRadius:    3,
          padding:         '1px 4px',
          marginLeft:      1,
        }}>
          {num}
        </sup>
      )
    }
    return part
  })
}

function NarrationText({ text }: { text: string }) {
  // eslint-disable-next-line react-doctor/no-render-in-render -- renderNarrationText is a stable module-level helper, not an inline component
  return <>{renderNarrationText(text)}</>
}

// ── ConfidenceDot ──────────────────────────────────────────────────────────────

function ConfidenceDot({ level }: { level: 'high' | 'low' }) {
  const color = level === 'high'
    ? 'var(--color-tag-Green-text)'
    : 'var(--color-tag-Yellow-text)'
  return (
    <span style={{
      display:         'inline-block',
      width:           6,
      height:          6,
      borderRadius:    '50%',
      backgroundColor: color,
      marginRight:     6,
      flexShrink:      0,
      verticalAlign:   'middle',
      position:        'relative',
      top:             -1,
    }} />
  )
}

// ── Types ───────────────────────────────────────────────────────────────────────

export interface BrainNarrationProps {
  /** The prose text Brain says between phases. Supports `inline code` and [N] citations. */
  text:           string
  /** When true, animates text in with a typewriter effect + cursor. @default false */
  isStreaming?:   boolean
  /**
   * Attaches a confidence dot to the narration.
   * 'high' → green dot (Brain is proceeding confidently).
   * 'low'  → amber dot + "Want me to double-check?" inline CTA.
   */
  confidence?:    'high' | 'low'
  /** Called when user clicks "Yes, check again" on a low-confidence narration. */
  onDoubleCheck?: () => void
  /** Citation sources — when provided, [1][2] etc. in text are linked to these. */
  citations?: Array<{ index: number; title: string; url?: string }>
}

// ── BrainNarration ─────────────────────────────────────────────────────────────
/**
 * AI real-time narration between phases.
 * "Now let me load the `search_events` tool…" style prose.
 * Streams in live during execution; sits static in history.
 */
export function BrainNarration({
  text,
  isStreaming = false,
  confidence,
  onDoubleCheck,
  citations,
}: BrainNarrationProps) {
  const displayed  = useStreamingTypewriter(text, isStreaming)
  const isComplete = displayed.length >= text.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{
        margin:      0,
        fontFamily:  'var(--font-body)',
        fontSize:    'var(--font-size-body)',
        fontWeight:  'var(--font-weight-regular)',
        lineHeight:  'var(--line-height-body)',
        color:       'var(--neutral-800)',
      }}>
        {confidence && <ConfidenceDot level={confidence} />}
        <NarrationText text={displayed} />
        {isStreaming && !isComplete && <StreamCursor />}
      </p>

      {/* Citations list — shown when citations prop is provided */}
      {citations && citations.length > 0 && (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           2,
          marginTop:     4,
          paddingTop:    8,
          borderTop:     '1px solid var(--neutral-100)',
        }}>
          {citations.map(c => (
            <div key={c.index} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span aria-hidden style={{
                fontFamily:      'var(--font-body)',
                fontSize:        '10px',
                color:           'var(--neutral-700)',
                backgroundColor: 'var(--neutral-100)',
                borderRadius:    3,
                padding:         '1px 4px',
                flexShrink:      0,
              }}>
                {c.index}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-600)',
              }}>
                {c.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Low-confidence double-check CTA — shown once streaming is complete */}
      {confidence === 'low' && isComplete && (
        <p style={{ margin: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
          }}>
            Want me to double-check this step?{' '}
          </span>
          <button
            type="button"
            onClick={onDoubleCheck}
            style={{
              background:          'none',
              border:              'none',
              padding:             0,
              cursor:              'pointer',
              fontFamily:          'var(--font-body)',
              fontSize:            'var(--font-size-caption)',
              fontWeight:          'var(--font-weight-medium)',
              lineHeight:          'var(--line-height-caption)',
              color:               'var(--neutral-500)',
              textDecoration:      'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Yes, check again
          </button>
        </p>
      )}
    </div>
  )
}

BrainNarration.displayName = 'BrainNarration'
