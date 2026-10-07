import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishChatContext, turnTiming } from '@/lib/chat-context-store'
import type { UIMessage } from '@/types/chat'

// Turn timings live in a module-level map, so every test uses its own reactKey.

const T0 = Date.parse('2026-10-04T12:00:00.000Z')

function assistant(reactKey: string | undefined, isLoading: boolean, id = reactKey ?? 'x'): UIMessage {
  return { id, reactKey, role: 'assistant', content: '', created_at: new Date(T0).toISOString(), chat_id: 'c', isLoading }
}

describe('turn timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => vi.useRealTimers())

  it('starts a turn at its loading message’s created_at and leaves it open while it runs', () => {
    const message = assistant('t-start', true)
    vi.setSystemTime(T0 + 5_000)
    publishChatContext({ chatId: 'c', messages: [message] })
    expect(turnTiming(message)).toEqual({ startedAt: T0 })
  })

  it('records the finish at the first publish that shows the turn no longer loading', () => {
    publishChatContext({ chatId: 'c', messages: [assistant('t-finish', true)] })
    vi.setSystemTime(T0 + 79_000)
    const done = assistant('t-finish', false)
    publishChatContext({ chatId: 'c', messages: [done] })
    expect(turnTiming(done)).toEqual({ startedAt: T0, finishedAt: T0 + 79_000 })
  })

  it('keeps the finish time on later publishes — the time is retained', () => {
    publishChatContext({ chatId: 'c', messages: [assistant('t-keep', true)] })
    vi.setSystemTime(T0 + 10_000)
    publishChatContext({ chatId: 'c', messages: [assistant('t-keep', false)] })
    vi.setSystemTime(T0 + 60_000)
    publishChatContext({ chatId: 'c', messages: [assistant('t-keep', false)] })
    expect(turnTiming(assistant('t-keep', false))?.finishedAt).toBe(T0 + 10_000)
  })

  it('follows the turn across the temp → real id swap, by reactKey', () => {
    publishChatContext({ chatId: 'c', messages: [assistant('t-swap', true, 'loading-assistant-1')] })
    vi.setSystemTime(T0 + 3_000)
    const saved = assistant('t-swap', false, '7f0c-real-uuid')
    publishChatContext({ chatId: 'c', messages: [saved] })
    expect(turnTiming(saved)).toEqual({ startedAt: T0, finishedAt: T0 + 3_000 })
  })

  it('has no timing for a turn this tab never saw run (loaded from history)', () => {
    const fromHistory = assistant('t-history', false)
    publishChatContext({ chatId: 'c', messages: [fromHistory] })
    expect(turnTiming(fromHistory)).toBeUndefined()
    expect(turnTiming(assistant(undefined, false))).toBeUndefined()
    expect(turnTiming(undefined)).toBeUndefined()
  })

  it('ignores user messages', () => {
    const userMessage: UIMessage = { ...assistant('t-user', true), role: 'user' }
    publishChatContext({ chatId: 'c', messages: [userMessage] })
    expect(turnTiming(userMessage)).toBeUndefined()
  })
})
