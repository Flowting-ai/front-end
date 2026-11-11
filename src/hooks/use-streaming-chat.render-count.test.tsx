// @vitest-environment jsdom
//
// Render-count regression: with the live stream overlay, streamed tokens re-render
// only the streaming message row — not the composer or the other messages. The
// harness mirrors ChatInterface: messages state owned by the parent, a composer
// rendered beside the list, and memoized message rows.

import React, { act, memo, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStreamingChat } from '@/hooks/use-streaming-chat'
import { useLiveMessage } from '@/hooks/use-live-message'
import { flushStreamStore, resetStreamStore } from '@/lib/chat/stream-store'
import type { UIMessage } from '@/types/chat'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class FakeXHR {
  static HEADERS_RECEIVED = 2
  static DONE = 4
  static last: FakeXHR | null = null
  readyState = 0
  status = 0
  responseText = ''
  withCredentials = false
  upload = { addEventListener: () => {} }
  onprogress: (() => void) | null = null
  onreadystatechange: (() => void) | null = null
  onabort: (() => void) | null = null
  onerror: (() => void) | null = null
  open() {}
  setRequestHeader() {}
  getResponseHeader() { return null }
  abort() {}
  send() { FakeXHR.last = this }
  start() {
    this.status = 200
    this.readyState = FakeXHR.HEADERS_RECEIVED
    this.onreadystatechange?.()
  }
  push(event: object) {
    this.responseText += `data: ${JSON.stringify(event)}\n\n`
    this.onprogress?.()
  }
  end() {
    this.readyState = FakeXHR.DONE
    this.onreadystatechange?.()
  }
}

const RUN = { threadId: 'chat-1', runId: 'run-1' }
const N = 50

const counts = { input: 0, rows: new Map<string, number>() }
// Render counting is a deliberate render-time side effect; kept behind a call.
function bump(id: string) {
  if (id === "input") counts.input++
  else counts.rows.set(id, (counts.rows.get(id) ?? 0) + 1)
}
let lastAssistant: { content?: string; busy?: string | null } = {}

function Composer() {
  bump("input")
  return <textarea readOnly value="" />
}

const Row = memo(function Row({ message }: { message: UIMessage }) {
  bump(message.id)
  return <article aria-busy={message.isLoading ? 'true' : undefined} data-id={message.id}>{message.content}</article>
})

function LiveRow({ message }: { message: UIMessage }) {
  const live = useLiveMessage(message)
  return <Row message={live} />
}

let hook: ReturnType<typeof useStreamingChat>

function Harness({ liveOverlay }: { liveOverlay: boolean }) {
  const [messages, setMessages] = useState<UIMessage[]>(() => [
    { id: 'u-0', role: 'user', content: 'earlier', created_at: '', chat_id: 'chat-1' },
    { id: 'a-0', role: 'assistant', content: 'earlier reply', created_at: '', chat_id: 'chat-1' },
    { id: 'u-1', role: 'user', content: 'hi', created_at: '', chat_id: 'chat-1' },
    { id: 'loading-1', role: 'assistant', content: '', created_at: '', chat_id: 'chat-1', isLoading: true },
  ])
  const api = useStreamingChat({ setMessages, liveOverlay })
  useEffect(() => { hook = api })
  return (
    <div>
      {messages.map((m) => (liveOverlay ? <LiveRow key={m.id} message={m} /> : <Row key={m.id} message={m} />))}
      <Composer />
    </div>
  )
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetStreamStore()
  counts.input = 0
  counts.rows.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function readAssistant() {
  const el = container.querySelector('article[data-id="loading-1"]') ?? container.querySelectorAll('article')[3]
  lastAssistant = { content: el?.textContent ?? undefined, busy: el?.getAttribute('aria-busy') }
  return lastAssistant
}

async function streamDeltas(liveOverlay: boolean) {
  act(() => root.render(<Harness liveOverlay={liveOverlay} />))
  let done!: Promise<unknown>
  act(() => { done = hook.fetchAiResponse('hi', 'chat-1', 'loading-1') })
  await vi.waitFor(() => expect(FakeXHR.last).not.toBeNull())
  const xhr = FakeXHR.last!
  await act(async () => {
    xhr.start()
    xhr.push({ type: 'RUN_STARTED', ...RUN })
  })
  const before = { input: counts.input, rows: new Map(counts.rows) }
  const midway: Array<ReturnType<typeof readAssistant>> = []
  for (let i = 0; i < N; i++) {
    // Worst case: one animation frame per delta.
    await act(async () => {
      xhr.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `t${i} ` })
      flushStreamStore()
    })
    if (i === N - 1) midway.push(readAssistant())
  }
  const during = {
    input: counts.input - before.input,
    streamingRow: (counts.rows.get('loading-1') ?? 0) - (before.rows.get('loading-1') ?? 0),
    otherRows: ['u-0', 'a-0', 'u-1'].reduce((sum, id) => sum + (counts.rows.get(id) ?? 0) - (before.rows.get(id) ?? 0), 0),
  }
  await act(async () => {
    xhr.push({ type: 'RUN_FINISHED', ...RUN })
    xhr.end()
    await done
  })
  FakeXHR.last = null
  return { during, midway: midway[0], final: readAssistant() }
}

describe('streaming render counts', () => {
  it('re-renders only the streaming row per delta with the live overlay', async () => {
    const legacy = await streamDeltas(false)
    act(() => root.unmount())
    root = createRoot(container)
    counts.input = 0
    counts.rows.clear()
    const live = await streamDeltas(true)


    const expected = Array.from({ length: N }, (_, i) => `t${i}`).join(' ')
    // Both paths show every token while streaming and settle on the full text.
    expect(legacy.midway.content?.trim()).toBe(expected)
    expect(live.midway.content?.trim()).toBe(expected)
    expect(live.midway.busy).toBe('true')
    expect(live.final.content?.trim()).toBe(expected)
    expect(live.final.busy).toBeNull()

    // The composer renders once (the first token commits so the reply leaves its
    // waiting state); settled rows stay still; the streaming row renders once per frame at most.
    expect(live.during.input).toBeLessThanOrEqual(1)
    expect(live.during.otherRows).toBe(0)
    expect(live.during.streamingRow).toBeLessThanOrEqual(N)
    expect(legacy.during.input).toBeGreaterThan(live.during.input)
  })
})
