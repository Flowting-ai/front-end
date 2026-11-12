// @vitest-environment jsdom
//
// How a streamed turn settles, driven through a fake XHR with AG-UI frames:
// output other than text (generated images, files) counts as an answer, and an
// expired session still settles the reply instead of leaving it loading.

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStreamingChat } from '@/hooks/use-streaming-chat'
import { isStreamActive, stopStream, subscribeStreams, type StreamEvent } from '@/lib/stream-registry'
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
  method = ''
  url = ''
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader() {}
  getResponseHeader() { return null }
  abort() {}
  send() { FakeXHR.last = this }

  /** Answer with `status` and these AG-UI events, then close. */
  respond(status: number, events: object[]) {
    this.status = status
    this.readyState = FakeXHR.HEADERS_RECEIVED
    this.onreadystatechange?.()
    this.responseText = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
    this.onprogress?.()
    this.readyState = FakeXHR.DONE
    this.onreadystatechange?.()
  }

  /** Answer 200 with these events, then lose the connection before the turn ends. */
  drop(events: object[]) {
    this.status = 200
    this.readyState = FakeXHR.HEADERS_RECEIVED
    this.onreadystatechange?.()
    this.responseText = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
    this.onprogress?.()
    this.status = 0
    this.readyState = FakeXHR.DONE
    this.onreadystatechange?.()
  }
}

const RUN = { threadId: 'chat-1', runId: 'run-1' }

let container: HTMLDivElement
let root: Root
let messages: UIMessage[]
let hook: ReturnType<typeof useStreamingChat>
let lost: ReturnType<typeof vi.fn>

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useStreamingChat>) => void }) {
  const api = useStreamingChat({
    setMessages: (update) => {
      messages = typeof update === 'function' ? update(messages) : update
    },
    onStreamLost: (chatId) => lost(chatId),
  })
  useEffect(() => onReady(api))
  return null
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lost = vi.fn()
  messages = [{ id: 'loading-1', role: 'assistant', content: '', created_at: '', chat_id: 'chat-1', isLoading: true }]
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Harness onReady={(api) => { hook = api }} />))
})

afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Start a turn, let the fake server answer, and wait for the hook to settle it. */
async function runTurn(status: number, events: object[]) {
  const done = hook.fetchAiResponse('hi', 'chat-1', 'loading-1')
  await vi.waitFor(() => expect(FakeXHR.last).not.toBeNull())
  FakeXHR.last!.respond(status, events)
  await done
  FakeXHR.last = null
  return messages[0]
}

describe('useStreamingChat turn outcome', () => {
  it('treats a turn that only generated an image as answered', async () => {
    const reply = await runTurn(200, [
      { type: 'RUN_STARTED', ...RUN },
      {
        type: 'CUSTOM',
        name: 'message_saved',
        value: { file_attachments: [{ origin: 'generated', file_link: 'https://cdn.test/cat.png', mime_type: 'image/png' }] },
      },
      { type: 'RUN_FINISHED', ...RUN },
    ])
    expect(reply.images).toEqual([{ url: 'https://cdn.test/cat.png' }])
    expect(reply).toMatchObject({ content: '', isError: false, isLoading: false })
  })

  it('treats a turn whose done event carries a generated file as answered', async () => {
    const reply = await runTurn(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'CUSTOM', name: 'done', value: { finish_reason: 'stop', file_attachments: [{ origin: 'generated', file_link: 'https://cdn.test/r.pdf', file_name: 'r.pdf' }] } },
    ])
    expect(reply.generatedFiles).toEqual([{ url: 'https://cdn.test/r.pdf', filename: 'r.pdf', mimeType: undefined }])
    expect(reply).toMatchObject({ content: '', isError: false, isLoading: false })
  })

  it('keeps streamed text when the run errors', async () => {
    const reply = await runTurn(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Half an answer' },
      { type: 'RUN_ERROR', message: 'stream error' },
    ])
    expect(reply).toMatchObject({ content: 'Half an answer', isError: false, isLoading: false })
    expect(reply.errorNotice).toBeTruthy()
  })

  it('settles the reply when the session has expired', async () => {
    const expired = vi.fn()
    window.addEventListener('auth:session-expired', expired)
    const reply = await runTurn(401, [])
    window.removeEventListener('auth:session-expired', expired)
    expect(expired).toHaveBeenCalledOnce()
    expect(reply).toMatchObject({ isLoading: false, isThinkingInProgress: false, isError: true })
  })
})

// The message queue holds a queued message back after a reply that didn't
// finish, so every way a turn ends reports how — to the caller and to the
// stream registry.
describe('useStreamingChat turn result', () => {
  let ended: StreamEvent[]
  let unsubscribe: () => void
  beforeEach(() => {
    ended = []
    unsubscribe = subscribeStreams((event) => { if (event.type === 'end') ended.push(event) })
  })
  afterEach(() => unsubscribe())

  async function turnResult(status: number, events: object[]) {
    const done = hook.fetchAiResponse('hi', 'chat-1', 'loading-1')
    await vi.waitFor(() => expect(FakeXHR.last).not.toBeNull())
    FakeXHR.last!.respond(status, events)
    const outcome = await done
    FakeXHR.last = null
    return outcome
  }

  it('reports a finished reply as done', async () => {
    const outcome = await turnResult(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'All of it' },
      { type: 'RUN_FINISHED', ...RUN },
    ])
    expect(outcome).toBe('done')
    expect(ended).toEqual([{ type: 'end', chatId: 'chat-1', outcome: 'done' }])
  })

  it('reports a run error as an error, even with text already shown', async () => {
    const outcome = await turnResult(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Half an answer' },
      { type: 'RUN_ERROR', message: 'stream error' },
    ])
    expect(outcome).toBe('error')
    expect(ended).toEqual([{ type: 'end', chatId: 'chat-1', outcome: 'error' }])
  })

  it('reports a failed request as an error', async () => {
    expect(await turnResult(401, [])).toBe('error')
    expect(ended.map((e) => e.type === 'end' && e.outcome)).toEqual(['error'])
  })

  it('reports a stopped reply as aborted, and can be stopped through the registry', async () => {
    const done = hook.fetchAiResponse('hi', 'chat-1', 'loading-1')
    await vi.waitFor(() => expect(FakeXHR.last).not.toBeNull())
    const xhr = FakeXHR.last!
    xhr.abort = () => xhr.onabort?.()
    expect(isStreamActive('chat-1')).toBe(true)

    act(() => { stopStream('chat-1') })
    expect(await done).toBe('aborted')
    FakeXHR.last = null
    expect(isStreamActive('chat-1')).toBe(false)
    expect(ended).toEqual([{ type: 'end', chatId: 'chat-1', outcome: 'aborted' }])
  })
})

// The backend keeps running a turn whose reader went away, and any request can
// read it again from its first event at GET /chats/{id}/stream.
describe('useStreamingChat picks a running turn back up', () => {
  /** The next request the hook opens after `previous`. */
  async function nextRequest(previous: FakeXHR | null) {
    await vi.waitFor(() => expect(FakeXHR.last).not.toBe(previous), { timeout: 3000 })
    return FakeXHR.last!
  }

  async function dropFirstRequest() {
    const done = hook.fetchAiResponse('hi', 'chat-1', 'loading-1')
    const first = await nextRequest(null)
    first.drop([
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Half an' },
    ])
    return { done, follow: await nextRequest(first) }
  }

  afterEach(() => { FakeXHR.last = null })

  it('replays the turn from its stream when the connection drops', async () => {
    const { done, follow } = await dropFirstRequest()
    expect(follow.method).toBe('GET')
    expect(follow.url).toContain('/chats/chat-1/stream')
    follow.respond(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Half an' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: ' answer, finished' },
      { type: 'RUN_FINISHED', ...RUN },
    ])
    expect(await done).toBe('done')
    expect(messages[0]).toMatchObject({ content: 'Half an answer, finished', isError: false, isLoading: false })
    expect(messages[0].errorNotice).toBeUndefined()
    expect(lost).not.toHaveBeenCalled()
    expect(isStreamActive('chat-1')).toBe(false)
  })

  it('keeps what was shown, with a notice, when there is no stream to read', async () => {
    const { done, follow } = await dropFirstRequest()
    follow.respond(405, [])
    expect(await done).toBe('error')
    expect(messages[0]).toMatchObject({ content: 'Half an', isError: false, isLoading: false })
    expect(messages[0].errorNotice).toBeTruthy()
    expect(lost).not.toHaveBeenCalled()
  })

  it('hands over to the saved history when the turn ended meanwhile', async () => {
    const { done, follow } = await dropFirstRequest()
    follow.respond(404, [])
    expect(await done).toBe('done')
    expect(lost).toHaveBeenCalledWith('chat-1')
    expect(isStreamActive('chat-1')).toBe(false)
  })

  it('follows a turn that was already running when the chat was opened', async () => {
    const done = hook.followStream('chat-1', 'loading-1')
    const follow = await nextRequest(null)
    expect(follow.method).toBe('GET')
    follow.respond(200, [
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Still going' },
      { type: 'RUN_FINISHED', ...RUN },
    ])
    expect(await done).toBe('done')
    expect(messages[0]).toMatchObject({ content: 'Still going', isLoading: false })
  })

  it('counts the turn from when the backend says the run started', async () => {
    const done = hook.followStream('chat-1', 'loading-1')
    const follow = await nextRequest(null)
    follow.respond(200, [
      { type: 'CUSTOM', name: 'run', value: { id: 'run-1', startedAt: '2026-11-12T01:00:00.500+00:00' } },
      { type: 'RUN_STARTED', ...RUN },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Still going' },
      { type: 'RUN_FINISHED', ...RUN },
      { type: 'CUSTOM', name: 'run', value: { id: 'run-1', startedAt: '2026-11-12T01:00:00.500+00:00', endedAt: '2026-11-12T01:02:10+00:00' } },
    ])
    expect(await done).toBe('done')
    expect(messages[0].runStartedAt).toBe(Date.UTC(2026, 10, 12, 1, 0, 0, 500))
  })

  it('reloads the history when the opened chat has no running turn after all', async () => {
    const done = hook.followStream('chat-1', 'loading-1')
    ;(await nextRequest(null)).respond(404, [])
    expect(await done).toBe('done')
    expect(lost).toHaveBeenCalledWith('chat-1')
    expect(isStreamActive('chat-1')).toBe(false)
  })
})
