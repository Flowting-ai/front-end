'use client'

import React, { useState, useRef, useEffect, type JSX } from 'react'
import { m } from 'framer-motion'
import { CopyOneIcon } from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import { BrainContentRenderer } from './BrainContentRenderer'

// ── Streaming typewriter hook ─────────────────────────────────────────────────
// Ported from front-end/src/components/chat/chat-message.tsx.
// RAF ease-out lerp: reveals ~6% of remaining chars per 16ms frame.
// Fast when far behind the latest token; decelerates gracefully as it catches up.
// Pass enabled=false (or when isComplete=true) to snap to full text immediately.

export function useStreamingTypewriter(fullText: string, enabled: boolean) {
  const [revealedLen, setRevealedLen] = useState(enabled ? 0 : fullText.length)
  const rafRef     = useRef<number | null>(null)
  const lastTickRef = useRef(0)
  const enabledRef  = useRef(enabled)

  useEffect(() => {
    enabledRef.current = enabled
    if (!enabled) {
      setRevealedLen(fullText.length)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [enabled, fullText.length])

  useEffect(() => {
    if (!enabled) return
    const TICK_MS = 16

    const animate = (ts: number) => {
      if (!enabledRef.current) return
      if (ts - lastTickRef.current >= TICK_MS) {
        lastTickRef.current = ts
        setRevealedLen(prev => {
          if (prev >= fullText.length) return prev
          const remaining = fullText.length - prev
          const step = Math.max(1, Math.ceil(remaining * 0.06))
          return Math.min(prev + step, fullText.length)
        })
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null } }
  }, [fullText, enabled])

  if (!enabled) return fullText
  return fullText.slice(0, revealedLen)
}

// ── Blinking cursor ────────────────────────────────────────────────────────────
// Ported from souvenir-demo/src/components/StreamingIndicator/index.tsx.

export function StreamCursor() {
  return (
    <m.span
      aria-hidden
      style={{
        display:         'inline-block',
        width:           2,
        height:          '1em',
        background:      'var(--neutral-400)',
        borderRadius:    1,
        marginLeft:      1,
        verticalAlign:   'text-bottom',
      }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// ── Inline content ─────────────────────────────────────────────────────────────
// Renders bold (**text**) and plain text segments within a line.

const renderBoldInline = (text: string, keyPrefix: string): Array<string | JSX.Element> => {
  const boldRegex = /(\*\*|__)(.+?)\1/g
  const nodes: Array<string | JSX.Element> = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(
      <strong key={`${keyPrefix}-b-${i++}`} style={{ fontWeight: 'var(--font-weight-medium)' as string }}>
        {match[2]}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  if (nodes.length === 0) nodes.push(text)
  return nodes
}

function BoldInline({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  // eslint-disable-next-line react-doctor/no-render-in-render -- renderBoldInline is a stable module-level helper, not an inline component
  return <>{renderBoldInline(text, keyPrefix)}</>
}

// ── Markdown renderer ──────────────────────────────────────────────────────────
// Adapted from front-end/src/components/chat/chat-message.tsx > renderTextContent.
// Converted from Tailwind → KDS semantic tokens (var(--token)).
// Handles: headings (h1–h3), bullet lists, code blocks (with copy), paragraphs, bold.

const HEADING_SIZES: Record<number, string> = {
  1: 'var(--font-size-body-lg)',
  2: 'var(--font-size-body-lg)',
  3: 'var(--font-size-body)',
  4: 'var(--font-size-body)',
  5: 'var(--font-size-body)',
  6: 'var(--font-size-body)',
}

export function renderBrainContent(value: string, keyPrefix: string): JSX.Element[] {
  const nodes: JSX.Element[] = []
  const lines     = value.replace(/\r/g, '').split('\n')
  const listBuffer: string[] = []
  let lineIndex = 0

  const flushList = () => {
    if (listBuffer.length === 0) return
    const k = `${keyPrefix}-list-${nodes.length}`
    nodes.push(
      <ul key={k} style={{ paddingLeft: 20, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {listBuffer.map((item, idx) => (
          // eslint-disable-next-line react-doctor/no-array-index-as-key -- streamed list items have no IDs; composite key with position is stable
          <li key={`${k}-${idx}`} style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-body)',
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-800)',
            listStyleType:'disc',
          }}>
            <BoldInline text={item} keyPrefix={`${k}-${idx}`} />
          </li>
        ))}
      </ul>
    )
    listBuffer.length = 0
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line    = lines[idx]
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      nodes.push(<span key={`${keyPrefix}-gap-${lineIndex++}`} style={{ display: 'block', height: 8 }} aria-hidden />)
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushList()
      const level = Math.min(headingMatch[1].length, 6)
      nodes.push(
        <p key={`${keyPrefix}-h-${lineIndex++}`} style={{
          fontFamily:  'var(--font-body)',
          fontWeight:  'var(--font-weight-medium)',
          fontSize:    HEADING_SIZES[level],
          lineHeight:  'var(--line-height-body)',
          color:       'var(--neutral-900)',
          margin:      '8px 0 2px',
          wordBreak:   'break-word',
        }}>
          <BoldInline text={headingMatch[2]} keyPrefix={`${keyPrefix}-h-${lineIndex}`} />
        </p>
      )
      continue
    }

    // Code block start
    if (trimmed.startsWith('```')) {
      flushList()
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      idx++
      while (idx < lines.length && !lines[idx].trim().startsWith('```')) {
        codeLines.push(lines[idx])
        idx++
      }
      const codeText = codeLines.join('\n')
      const k = `${keyPrefix}-code-${lineIndex++}`
      nodes.push(
        <CodeBlock key={k} code={codeText} lang={lang} />
      )
      continue
    }

    // Bullet lists
    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (listMatch) { listBuffer.push(listMatch[1]); continue }

    flushList()
    nodes.push(
      <p key={`${keyPrefix}-p-${lineIndex++}`} style={{
        fontFamily:   'var(--font-body)',
        fontSize:     'var(--font-size-body)',
        lineHeight:   'var(--line-height-body)',
        color:        'var(--neutral-800)',
        margin:       0,
        wordBreak:    'break-word',
        overflowWrap: 'break-word',
        whiteSpace:   'pre-wrap',
      }}>
        <BoldInline text={line} keyPrefix={`${keyPrefix}-p-${lineIndex}`} />
      </p>
    )
  }

  flushList()
  return nodes
}

// ── Code block (with copy button) ─────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      const t = setTimeout(() => { setCopied(false); timers.current.delete(t) }, 1500)
      timers.current.add(t)
    })
  }

  return (
    <div style={{
      position:        'relative',
      borderRadius:    14,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: 'var(--neutral-50)',
      overflow:        'hidden',
      margin:          '4px 0',
    }}>
      {/* Header row */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '6px 12px',
        borderBottom:    '1px solid var(--neutral-100)',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          color:      'var(--neutral-400)',
          fontWeight: 'var(--font-weight-medium)',
        }}>
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display:     'inline-flex',
            alignItems:  'center',
            gap:         4,
            padding:     '3px 8px',
            borderRadius: 8,
            border:      '1px solid var(--neutral-200)',
            background:  'var(--neutral-white)',
            cursor:      'pointer',
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-caption)',
            color:       'var(--neutral-600)',
            lineHeight:  'var(--line-height-caption)',
          }}
        >
          <CopyOneIcon size={11} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre
        className="kaya-scrollbar"
        style={{
          margin:               0,
          padding:              '10px 14px',
          fontFamily:           'var(--font-mono, monospace)',
          fontSize:             13,
          lineHeight:           '20px',
          color:                'var(--neutral-700)',
          overflowX:            'auto',
          overscrollBehaviorX:  'contain',
          whiteSpace:           'pre',
        }}
      >
        <code>{code.trimEnd()}</code>
      </pre>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreamingMessageBubbleProps {
  /** Accumulated text so far — append tokens as they arrive from the API. */
  content:     string
  /** True when the stream is done — cursor disappears, typewriter snaps to full content. */
  isComplete?: boolean
}

// ── StreamingMessageBubble ────────────────────────────────────────────────────

export function StreamingMessageBubble({
  content,
  isComplete = false,
}: StreamingMessageBubbleProps) {
  // Render through the full markdown pipeline on every render — tables,
  // links, ordered lists, blockquotes, inline code, math, and HTML all
  // need to appear as soon as their syntax is complete, not after the
  // stream ends. `closeOpenFences` inside MarkdownRenderer's preprocessing
  // handles mid-stream unclosed code blocks; remark-gfm renders a table the
  // moment a header + separator + first body row exist. The typewriter is
  // deliberately bypassed for streaming Brain output — tokens should hit
  // the screen the instant they arrive, matching how staging behaves and
  // how the user expects "on the get go" rendering to look.

  return (
    <m.div
      initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
      transition={springs.moderate}
    >
      <BrainContentRenderer content={content} />
      {!isComplete && <StreamCursor />}
    </m.div>
  )
}

StreamingMessageBubble.displayName = 'StreamingMessageBubble'
