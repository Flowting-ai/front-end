// @vitest-environment jsdom
//
// Chat history caching: switching between chats must not refetch one that was
// already loaded, and the cache must never be allowed to capture a turn that is
// still in flight or to file one chat's messages under another's id.

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatState, type UseChatStateResult } from '@/hooks/use-chat-state'
import { clearChatHistories, readChatHistory } from '@/lib/chat/chat-message-cache'
import { registerStream, completeStream } from '@/lib/stream-registry'
import type { Message } from '@/types/chat'

const getChatMessages = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/chat', () => ({ getChatMessages }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** A backend message as the history endpoint returns it. */
const serverMsg = (id: string, chatId: string): Message => ({
  id,
  role: 'user',
  content: id,
  created_at: '2026-01-01T00:00:00Z',
  chat_id: chatId,
} as Message)

/** Make the endpoint answer with these message ids for any chat. */
function serve(ids: string[], opts: { hasMore?: boolean; cursor?: string | null } = {}) {
  getChatMessages.mockImplementation((chatId: string) => Promise.resolve({
    messages: ids.map((id) => serverMsg(id, chatId)),
    has_more: opts.hasMore ?? false,
    next_cursor: opts.cursor ?? null,
  }))
}

let container: HTMLDivElement
let root: Root
let hook: UseChatStateResult

function Harness({ chatId }: { chatId: string | undefined }) {
  const api = useChatState(chatId)
  useEffect(() => { hook = api })
  return null
}

/** Render (or re-render) the hook for `chatId` and let its load settle. */
async function show(chatId: string | undefined) {
  await act(async () => {
    root.render(<Harness chatId={chatId} />)
    await Promise.resolve()
  })
  // Give a pending fetch a turn of the microtask queue to install.
  await act(async () => { await Promise.resolve() })
}

const ids = () => hook.messages.map((m) => m.id)

beforeEach(() => {
  clearChatHistories()
  getChatMessages.mockReset()
  serve(['m1', 'm2'])
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  clearChatHistories()
  vi.useRealTimers()
})

describe('first load', () => {
  it('fetches a chat it has never seen and shows its messages', async () => {
    await show('a')
    expect(getChatMessages).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual(['m1', 'm2'])
    expect(hook.isLoadingMessages).toBe(false)
  })

  it('fetches nothing when there is no chat yet', async () => {
    await show(undefined)
    expect(getChatMessages).not.toHaveBeenCalled()
    expect(ids()).toEqual([])
  })
})

describe('returning to a chat', () => {
  it('serves a fresh history from the cache without a round trip', async () => {
    await show('a')
    await show('b')
    getChatMessages.mockClear()

    await show('a')
    expect(getChatMessages).not.toHaveBeenCalled()
    expect(ids()).toEqual(['m1', 'm2'])
  })

  it('never shows the skeleton on a cache hit', async () => {
    await show('a')
    await show('b')

    const loadingStates: boolean[] = []
    function Spy({ chatId }: { chatId: string }) {
      const api = useChatState(chatId)
      loadingStates.push(api.isLoadingMessages)
      useEffect(() => { hook = api })
      return null
    }
    await act(async () => {
      root.render(<Spy chatId="a" />)
      await Promise.resolve()
    })
    expect(loadingStates).not.toContain(true)
    expect(ids()).toEqual(['m1', 'm2'])
  })

  it('bumps historyLoadId on a cache hit so the thread still scrolls to the bottom', async () => {
    await show('a')
    const afterFirst = hook.historyLoadId
    await show('b')
    await show('a')
    expect(hook.historyLoadId).toBeGreaterThan(afterFirst)
  })

  it('refreshes an aged history underneath the rendered thread', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await show('a')
    await show('b')
    getChatMessages.mockClear()
    serve(['m1', 'm2', 'm3'])

    vi.advanceTimersByTime(31_000)
    await show('a')
    // The cached copy renders first — no skeleton, no empty thread...
    expect(hook.isLoadingMessages).toBe(false)
    // ...and the refresh replaces it once it lands.
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(getChatMessages).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual(['m1', 'm2', 'm3'])
  })

  it('keeps the cached thread when a background refresh fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await show('a')
    await show('b')
    getChatMessages.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.advanceTimersByTime(31_000)
    await show('a')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(ids()).toEqual(['m1', 'm2'])
    expect(hook.messagesLoadError).toBeNull()
  })

  it('serves a paginated history as-is rather than collapsing it to one page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    serve(['m2', 'm3'], { hasMore: true, cursor: 'cur-1' })
    await show('a')

    getChatMessages.mockImplementation(() => Promise.resolve({
      messages: [serverMsg('m0', 'a'), serverMsg('m1', 'a')],
      has_more: false,
      next_cursor: null,
    }))
    await act(async () => { await hook.loadMoreMessages() })
    expect(ids()).toEqual(['m0', 'm1', 'm2', 'm3'])

    await show('b')
    getChatMessages.mockClear()
    vi.advanceTimersByTime(31_000)
    await show('a')
    await act(async () => { await Promise.resolve() })

    // Refetching would have returned only the newest page and thrown away the
    // older one the user scrolled up for.
    expect(getChatMessages).not.toHaveBeenCalled()
    expect(ids()).toEqual(['m0', 'm1', 'm2', 'm3'])
  })
})

describe('what the cache refuses to keep', () => {
  it('does not cache a thread while a reply is in flight', async () => {
    await show('a')
    registerStream('a')
    await act(async () => {
      hook.addLoadingAssistantMessage()
      await Promise.resolve()
    })
    expect(readChatHistory('a')?.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
    completeStream('a')
  })

  it('does not cache a turn whose stream has not registered yet', async () => {
    // The window where attachments are still uploading: both optimistic rows
    // exist (every send path adds the pair) but no stream is registered.
    await show('a')
    await act(async () => {
      hook.addOptimisticUserMessage('hello')
      hook.addLoadingAssistantMessage()
      await Promise.resolve()
    })
    expect(readChatHistory('a')?.messages.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('caches the finished thread once the reply ends', async () => {
    await show('a')
    registerStream('a')
    let loadingId = ''
    await act(async () => {
      loadingId = hook.addLoadingAssistantMessage()
      await Promise.resolve()
    })
    // The reply lands, then the stream deregisters — the order the streaming
    // hook actually uses, with the final commit before completeStream().
    await act(async () => {
      hook.setMessages((prev) => prev.map((m) => m.id === loadingId ? { ...m, isLoading: false, content: 'hi' } : m))
      completeStream('a')
      await Promise.resolve()
    })
    expect(readChatHistory('a')?.messages.map((m) => m.id)).toEqual(['m1', 'm2', loadingId])
  })

  it('shows the skeleton, not a stale thread, when returning mid-reply', async () => {
    await show('a')
    await show('b')
    registerStream('a')
    serve(['m1', 'm2', 'm3'])

    await act(async () => {
      root.render(<Harness chatId="a" />)
      await Promise.resolve()
    })
    // The cached copy predates the message being replied to, so it is not shown.
    expect(hook.isLoadingMessages).toBe(true)
    expect(ids()).toEqual([])

    await act(async () => {
      completeStream('a')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(ids()).toEqual(['m1', 'm2', 'm3'])
  })

  it('abandons a background refresh if a turn starts while it is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await show('a')
    await show('b')

    let release: (v: unknown) => void = () => {}
    getChatMessages.mockImplementation(() => new Promise((r) => { release = r }))
    vi.advanceTimersByTime(31_000)
    await show('a')

    // The user sends while the silent refresh is still open.
    await act(async () => {
      hook.addOptimisticUserMessage('hello')
      hook.addLoadingAssistantMessage()
      await Promise.resolve()
    })
    await act(async () => {
      release({ messages: [serverMsg('m1', 'a')], has_more: false, next_cursor: null })
      await Promise.resolve()
      await Promise.resolve()
    })

    // The server's copy would have deleted the message being sent and orphaned
    // the stream writing into the reply placeholder.
    expect(ids().slice(0, 2)).toEqual(['m1', 'm2'])
    expect(ids()).toHaveLength(4)
  })
})

describe('ownership during navigation', () => {
  it('never files one chat\'s messages under another chat\'s id', async () => {
    await show('a')
    clearChatHistories()

    // Mid-navigation React commits `chatId: 'b'` while `messages` is still a's.
    getChatMessages.mockImplementation(() => new Promise(() => {}))
    await act(async () => {
      root.render(<Harness chatId="b" />)
      await Promise.resolve()
    })
    expect(readChatHistory('b')).toBeUndefined()
    expect(readChatHistory('a')).toBeUndefined()
  })

  it('clearMessages forgets the cached copy too', async () => {
    await show('a')
    expect(readChatHistory('a')).toBeDefined()
    await act(async () => {
      hook.clearMessages()
      await Promise.resolve()
    })
    expect(readChatHistory('a')).toBeUndefined()
  })
})

describe('explicit refresh', () => {
  it('reloads from the server and updates the cache', async () => {
    await show('a')
    serve(['m1', 'm2', 'm3'])
    await act(async () => { await hook.refreshMessages() })
    expect(ids()).toEqual(['m1', 'm2', 'm3'])
    expect(readChatHistory('a')?.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })
})
