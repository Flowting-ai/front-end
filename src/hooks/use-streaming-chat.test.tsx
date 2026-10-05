// @vitest-environment jsdom
//
// How a streamed turn settles, driven through a fake XHR with AG-UI frames:
// output other than text (generated images, files) counts as an answer, and an
// expired session still settles the reply instead of leaving it loading.

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStreamingChat } from '@/hooks/use-streaming-chat'
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
}

const RUN = { threadId: 'chat-1', runId: 'run-1' }

let container: HTMLDivElement
let root: Root
let messages: UIMessage[]
let hook: ReturnType<typeof useStreamingChat>

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useStreamingChat>) => void }) {
  const api = useStreamingChat({
    setMessages: (update) => {
      messages = typeof update === 'function' ? update(messages) : update
    },
  })
  useEffect(() => onReady(api))
  return null
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  vi.spyOn(console, 'error').mockImplementation(() => {})
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
