// @vitest-environment jsdom
//
// MessageQueueRunner: a chat's queued messages go out in the background, one
// per reply, once the reply each was waiting on finishes — but only for a chat
// that isn't on screen, never after a reply that failed, and not while out of
// credits.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fetchAiResponse = vi.fn()
let creditsBlocked = false

vi.mock('@/hooks/use-streaming-chat', () => ({
  useStreamingChat: () => ({ fetchAiResponse, handleStopGeneration: vi.fn() }),
}))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }))
vi.mock('@/context/chat-history-context', () => ({ useChatHistoryContext: () => ({ moveToTop: vi.fn() }) }))
vi.mock('@/context/org-context', () => ({ useOrg: () => ({ plan: null }) }))
vi.mock('@/hooks/use-credit-status', () => ({ useCreditStatus: () => ({ blocked: creditsBlocked }) }))
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn() }))

import { MessageQueueRunner } from './MessageQueueRunner'
import { getChatQueue, queueMessage, setQueueForeground, takeAllQueuedMessages } from '@/lib/message-queue'
import { completeStream, isStreamActive, registerStream } from '@/lib/stream-registry'

let container: HTMLDivElement
let root: Root
// Ends the background send that is running, as its stream would.
let finishSend: (outcome: string) => void

const context = { settings: { pinsEnabled: true, webSearch: true }, modelId: 7 }
const view = Symbol('view')

beforeEach(async () => {
  creditsBlocked = false
  fetchAiResponse.mockReset()
  fetchAiResponse.mockImplementation((_input: string, chatId: string) => new Promise((resolve) => {
    finishSend = (outcome) => { completeStream(chatId, outcome as 'done'); resolve(outcome) }
  }))
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<MessageQueueRunner />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  setQueueForeground(view, null)
  takeAllQueuedMessages('chat-1')
  completeStream('chat-1')
})

async function queueBehindReply(...contents: string[]) {
  await act(async () => {
    registerStream('chat-1')
    for (const content of contents) queueMessage('chat-1', { content, attachments: [], mentionedPins: [] }, context)
  })
}

const sentInputs = () => fetchAiResponse.mock.calls.map((call) => call[0])

describe('MessageQueueRunner', () => {
  it('sends a queued message once the reply before it finishes', async () => {
    await queueBehindReply('and then this')
    expect(fetchAiResponse).not.toHaveBeenCalled()

    await act(async () => completeStream('chat-1', 'done'))
    expect(fetchAiResponse).toHaveBeenCalledOnce()
    const [input, chatId, , modelId, options] = fetchAiResponse.mock.calls[0]
    expect([input, chatId, modelId]).toEqual(['and then this', 'chat-1', 7])
    expect(options).toMatchObject({ webSearch: true })
    expect(getChatQueue('chat-1')).toBeUndefined()
    // Reserved, so opening the chat now waits for this reply too.
    expect(isStreamActive('chat-1')).toBe(true)

    await act(async () => finishSend('done'))
    expect(isStreamActive('chat-1')).toBe(false)
  })

  it('sends several queued messages one at a time, each after the reply before it', async () => {
    await queueBehindReply('first', 'second')
    await act(async () => completeStream('chat-1', 'done'))
    expect(sentInputs()).toEqual(['first'])

    await act(async () => finishSend('done'))
    expect(sentInputs()).toEqual(['first', 'second'])

    await act(async () => finishSend('done'))
    expect(getChatQueue('chat-1')).toBeUndefined()
  })

  it('stops sending when one of them fails', async () => {
    await queueBehindReply('first', 'second')
    await act(async () => completeStream('chat-1', 'done'))
    await act(async () => finishSend('error'))
    expect(sentInputs()).toEqual(['first'])
    expect(getChatQueue('chat-1')).toMatchObject({ heldBy: 'error' })
  })

  it('leaves a chat on screen to its own view', async () => {
    await act(async () => setQueueForeground(view, 'chat-1'))
    await queueBehindReply('and then this')
    await act(async () => completeStream('chat-1', 'done'))
    expect(fetchAiResponse).not.toHaveBeenCalled()

    // …until the user leaves it.
    await act(async () => setQueueForeground(view, 'chat-2'))
    expect(fetchAiResponse).toHaveBeenCalledOnce()
  })

  it('holds the queue when the reply before it fails', async () => {
    await queueBehindReply('and then this')
    await act(async () => completeStream('chat-1', 'error'))
    expect(fetchAiResponse).not.toHaveBeenCalled()
    expect(getChatQueue('chat-1')?.heldBy).toBe('error')
  })

  it('waits while out of credits', async () => {
    creditsBlocked = true
    await act(async () => root.render(<MessageQueueRunner key="blocked" />))
    await queueBehindReply('and then this')
    await act(async () => completeStream('chat-1', 'done'))
    expect(fetchAiResponse).not.toHaveBeenCalled()
    expect(getChatQueue('chat-1')?.messages).toHaveLength(1)
  })
})
