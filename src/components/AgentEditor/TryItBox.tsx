'use client'

import React, { useEffect, useRef, useState } from 'react'
import { TestTubeIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { testVersionStream } from '@/lib/api/personas'
import { BOX_STYLE, HINT_STYLE, INPUT_STYLE, LABEL_STYLE } from './styles'

export interface TryItBoxProps {
  repoId:    string
  versionId: string
  /** When set, trying is paused and this explains why (e.g. unsaved changes). */
  pausedReason?: string
}

/**
 * A quick one-message test of the saved agent, right next to its card. Stateless:
 * nothing is kept as a chat, and it never needs a "save first" lock — the agent
 * already exists, so it runs exactly as saved.
 */
export function TryItBox({ repoId, versionId, pausedReason }: TryItBoxProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)
  // Bumped on every send and stop so a stream the user already left behind can't write into the box.
  const runRef = useRef(0)

  // A stream still running when this unmounts, or when the agent changes, is cancelled.
  useEffect(() => () => { runRef.current += 1; abortRef.current?.() }, [repoId, versionId])

  async function send() {
    const message = input.trim()
    if (!message || streaming || pausedReason) return
    setOutput('')
    setError(null)
    setStreaming(true)
    const run = ++runRef.current
    try {
      const abort = await testVersionStream(repoId, versionId, message, {
        onChunk: delta => { if (run === runRef.current) setOutput(previous => previous + delta) },
        onDone:  () => { if (run === runRef.current) setStreaming(false) },
        onError: reason => { if (run === runRef.current) { setError(reason); setStreaming(false) } },
      })
      if (run === runRef.current) abortRef.current = abort
      else abort()
    } catch {
      if (run !== runRef.current) return
      setError('Couldn’t reach the agent. Please try again.')
      setStreaming(false)
    }
  }

  function stop() {
    runRef.current += 1
    abortRef.current?.()
    abortRef.current = null
    setStreaming(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={LABEL_STYLE}>Try it</p>
      <div className="kaya-field" style={{ ...BOX_STYLE, padding: '8px 10px' }}>
        <textarea
          value={input}
          rows={3}
          aria-label="Message to try"
          placeholder="Say something to this agent…"
          disabled={streaming}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() }
          }}
          style={{ ...INPUT_STYLE, resize: 'none' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {streaming ? (
          <Button type="button" variant="outline" size="sm" onClick={stop}>Stop</Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<TestTubeIcon size={16} />}
            disabled={!input.trim() || !!pausedReason}
            onClick={() => void send()}
          >
            Try it
          </Button>
        )}
      </div>
      {pausedReason && <p style={HINT_STYLE}>{pausedReason}</p>}
      {error && <p role="alert" style={{ ...HINT_STYLE, color: 'var(--color-tag-Red-text, #9a3b34)' }}>{error}</p>}
      {(output || streaming) && (
        <div
          className="kaya-scrollbar"
          aria-live="polite"
          style={{
            ...BOX_STYLE, padding: '10px 12px', maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)',
          }}
        >
          {output || '…'}
        </div>
      )}
    </div>
  )
}
