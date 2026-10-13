'use client'

import React, { useEffect, useRef, useState } from 'react'
import { formatTimestamp } from '@/lib/library/cite'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { safeAssetUrl } from '@/lib/library/viewers/safe-url'
import { CitedLabel } from './CitedLabel'

export interface AudioViewerProps {
  url: string
  lines: { startMs: number; text: string }[]
  /** A time citation in milliseconds: playback is positioned there and its line is marked. */
  citeMs?: number | null
}

/** Native audio controls plus a transcript. Clicking a line seeks to it; the current line is marked as it plays. */
export default function AudioViewer({ url, lines, citeMs }: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // The playing line and the cited line are two different marks: following playback never clears the citation.
  const [activeMs, setActiveMs] = useState<number | null>(null)
  const src = safeAssetUrl(url, 'audio')

  const lineAt = (ms: number) => lines.reduce((found, line, index) => (line.startMs <= ms ? index : found), -1)
  const activeIndex = activeMs === null ? -1 : lineAt(activeMs)
  const citedIndex = citeMs === null || citeMs === undefined ? -1 : lineAt(citeMs)

  // Bring the cited line into view once.
  useEffect(() => {
    if (citedIndex < 0) return
    listRef.current?.querySelector('[data-cited]')?.scrollIntoView({ block: 'center' })
  }, [citedIndex])

  // Position the player at a cited time once its metadata is known.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || citeMs === null || citeMs === undefined) return
    const seek = () => { audio.currentTime = citeMs / 1000 }
    if (audio.readyState >= 1) seek()
    else audio.addEventListener('loadedmetadata', seek, { once: true })
    return () => audio.removeEventListener('loadedmetadata', seek)
  }, [citeMs])

  if (!src) throw new Error('audio-unavailable')

  const seekTo = (ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = ms / 1000
    void audio.play().catch(() => undefined)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 720 }}>
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="metadata"
        onTimeUpdate={(event) => setActiveMs(Math.round(event.currentTarget.currentTime * 1000))}
        style={{ width: '100%' }}
      >
        Your browser cannot play this recording.
      </audio>
      {lines.length > 0 && (
        <section aria-label="Transcript" style={{ borderRadius: 12, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)', padding: 8 }}>
          <ol ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lines.map((line, index) => {
              const cited = index === citedIndex
              const playing = index === activeIndex
              return (
                <li key={`${line.startMs}-${index}`} data-cited={cited || undefined}>
                  <button
                    type="button"
                    onClick={() => seekTo(line.startMs)}
                    aria-current={playing ? 'true' : undefined}
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: 12, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      background: cited ? 'var(--color-tag-Yellow-bg)' : playing ? 'var(--neutral-100)' : 'transparent',
                      boxShadow: cited ? 'inset 0 0 0 1px var(--color-tag-Yellow-text)' : 'none',
                      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', fontWeight: playing ? 500 : 400,
                    }}
                  >
                    <span style={{ flexShrink: 0, minWidth: 40, color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(line.startMs)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{line.text}</span>
                    {cited && <CitedLabel>{FILE_MESSAGES.cited}</CitedLabel>}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
