// @vitest-environment jsdom
//
// The chat's Library sources: rows and count from the messages, "Loading…" (not "File deleted") while
// a sent file's name is still on its way, and the off switch kept in the per-chat list every send reads.

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from '@/types/chat'
import type { FileRef } from '@/lib/library/sources'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fileRefs = vi.hoisted(() => ({ refs: {} as Record<string, FileRef>, asked: [] as string[][] }))
vi.mock('./useFileRefs', () => ({
  useFileRefs: (ids: string[]) => {
    fileRefs.asked.push(ids)
    return { refs: fileRefs.refs, loading: ids.some(id => !fileRefs.refs[id]) }
  },
}))

const { useChatLibrarySources } = await import('./useChatLibrarySources')
const { getSourcesOff } = await import('@/lib/library/library-sources-off')

const AT = '2026-11-03T12:00:00.000Z'
const messages: UIMessage[] = [
  { id: 'u1', role: 'user', content: 'q', created_at: AT, chat_id: 'c1', libraryFileIds: ['sent', 'both'] },
  {
    id: 'a1', role: 'assistant', content: '', created_at: AT, chat_id: 'c1',
    libraryCitations: [{ fileId: 'both', state: 'open', title: 'Cited title', format: 'pdf' } as never],
  },
]

let host: HTMLDivElement
let root: Root
let result: ReturnType<typeof useChatLibrarySources>
const report = (value: typeof result) => { result = value }

function Probe({ chatId }: { chatId: string | undefined }) {
  const value = useChatLibrarySources(chatId, messages)
  useEffect(() => report(value))
  return null
}

beforeEach(() => {
  fileRefs.refs = {}
  fileRefs.asked = []
  window.sessionStorage.clear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('useChatLibrarySources', () => {
  it('lists sent and cited files once, loading until the name arrives, then named', () => {
    act(() => root.render(<Probe chatId="c1" />))
    expect(result.count).toBe(2)
    // Only the sent file needs a lookup; the citation carries its title.
    expect(fileRefs.asked.at(-1)).toEqual(['sent'])
    expect(result.rows.map(row => [row.id, row.status, row.name])).toEqual([
      ['sent', 'loading', 'Loading…'],
      ['both', 'cited', 'Cited title'],
    ])

    fileRefs.refs = { sent: { id: 'sent', state: 'open', title: 'Sent file', format: 'document' } }
    act(() => root.render(<Probe chatId="c1" />))
    expect(result.rows[0]).toMatchObject({ status: 'attached', name: 'Sent file', canToggle: true })

    fileRefs.refs = { sent: { id: 'sent', state: 'deleted' } }
    act(() => root.render(<Probe chatId="c1" />))
    expect(result.rows[0]).toMatchObject({ status: 'deleted', name: 'File deleted' })
  })

  it('switches a file off for the chat and back on, in the list sends read', () => {
    act(() => root.render(<Probe chatId="c1" />))
    act(() => result.toggle('both'))
    expect(getSourcesOff('c1')).toEqual(['both'])
    expect(result.rows[1]).toMatchObject({ off: true, detail: 'Off for this chat' })
    expect(JSON.parse(window.sessionStorage.getItem('library:v1:sources-off') ?? '{}')).toEqual({ c1: ['both'] })
    act(() => result.toggle('both'))
    expect(getSourcesOff('c1')).toEqual([])
    expect(result.rows[1].off).toBe(false)
  })

  it('lists nothing for a chat without a real id yet', () => {
    act(() => root.render(<Probe chatId="temp-1" />))
    expect(result).toMatchObject({ rows: [], count: 0 })
    act(() => root.render(<Probe chatId={undefined} />))
    expect(result.count).toBe(0)
  })
})
