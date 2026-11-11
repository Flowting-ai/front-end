'use client'

import React, { useEffect, useEffectEvent, useRef } from 'react'
import { FAILURE_NOTICE_MS, MESSAGES, uploadFailureMessage } from '@/lib/library/messages'
import type { UploadItem } from '@/lib/library/upload/machine'

const noticeStyle: React.CSSProperties = {
  margin: 0, padding: '8px 12px', borderRadius: 10, background: 'var(--neutral-100)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)',
}

/**
 * Messages above the composer about its attachments. A failure is one short line that never names the
 * file (what was refused is clear from the card that just left) and clears itself after six seconds.
 * Paused and slow uploads are explained while they last.
 */
export function UploadNotices({ items, onDismiss }: { items: readonly UploadItem[]; onDismiss: (id: string) => void }) {
  const failed = items.filter((item) => item.status === 'failed')
  const failedKey = failed.map((item) => item.id).join('|')

  // Each failure message clears itself six seconds after it appeared; the attachment leaves the draft
  // with it. One timer per failure, started once: a new failure or a re-render must not restart the
  // clock of an older one (renders are frequent while other uploads progress), so timers are tracked
  // by id and the latest onDismiss is read through an effect event.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const dismiss = useEffectEvent((id: string) => onDismiss(id))
  useEffect(() => {
    const ids = failedKey.split('|').filter(Boolean)
    for (const id of ids) {
      if (timers.current.has(id)) continue
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id)
        dismiss(id)
      }, FAILURE_NOTICE_MS))
    }
    for (const [id, timer] of timers.current) {
      if (!ids.includes(id)) {
        clearTimeout(timer)
        timers.current.delete(id)
      }
    }
  }, [failedKey])
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const paused = items.some((item) => item.status === 'paused')
  const slow = items.some((item) => item.status === 'processing' && item.slow)
  if (failed.length === 0 && !paused && !slow) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {failed.map((item) => (
        <p key={item.id} role="alert" style={noticeStyle}>{item.failure ? uploadFailureMessage(item.failure) : MESSAGES.genericFailure}</p>
      ))}
      {paused && <p role="status" style={noticeStyle}>{uploadFailureMessage('network')}</p>}
      {slow && <p role="status" style={noticeStyle}>This is taking longer than usual. You can remove the file and send without it.</p>}
    </div>
  )
}
