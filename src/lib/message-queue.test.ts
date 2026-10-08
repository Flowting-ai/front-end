// The tab-level message queue: each queued message stays its own message and
// goes out in order; a chat's queue is held when the reply before it fails or
// is stopped, and handed to the background only for chats that aren't on
// screen and are idle.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingAttachment } from '@/hooks/use-file-upload'

type Queue = typeof import('./message-queue')
type Registry = typeof import('./stream-registry')

let q: Queue
let streams: Registry

// Both modules keep tab-level state; each test starts from fresh copies.
beforeEach(async () => {
  vi.resetModules()
  streams = await import('./stream-registry')
  q = await import('./message-queue')
})

const context = { settings: { pinsEnabled: true } }

function file(name: string, size = 10): PendingAttachment {
  return { id: `att-${name}`, file: new File(['x'.repeat(size)], name), uploading: false }
}

function part(content: string, extra: Partial<Parameters<Queue['queueMessage']>[1]> = {}) {
  return { content, attachments: [], mentionedPins: [], ...extra }
}

const contents = (key: string) => q.getChatQueue(key)?.messages.map((m) => m.content) ?? []

describe('queueing', () => {
  it('keeps each queued message separate, in the order queued', () => {
    const first = q.queueMessage('chat-1', part('how can it help get better', { attachments: [file('a.pdf')] }), context)
    const second = q.queueMessage('chat-1', part('  how exactly  '), context)
    expect(second.id).not.toBe(first.id)
    expect(contents('chat-1')).toEqual(['how can it help get better', 'how exactly'])
    expect(q.getChatQueue('chat-1')!.messages[0].attachments).toHaveLength(1)
    expect(q.getChatQueue('chat-1')!.messages[1].attachments).toHaveLength(0)
  })

  it('hands them out one at a time, oldest first', () => {
    q.queueMessage('chat-1', part('first'), context)
    q.queueMessage('chat-1', part('second'), context)
    expect(q.takeNextQueuedMessage('chat-1')?.content).toBe('first')
    expect(contents('chat-1')).toEqual(['second'])
    expect(q.takeNextQueuedMessage('chat-1')?.content).toBe('second')
    expect(q.takeNextQueuedMessage('chat-1')).toBeUndefined()
    expect(q.getChatQueue('chat-1')).toBeUndefined()
  })

  it('notifies subscribers of every change', () => {
    const listener = vi.fn()
    q.subscribeQueue(listener)
    q.queueMessage('chat-1', part('hi'), context)
    q.takeNextQueuedMessage('chat-1')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('takes one message out to edit, and puts it back in its place', () => {
    q.queueMessage('chat-1', part('a'), context)
    const b = q.queueMessage('chat-1', part('b'), context)
    q.queueMessage('chat-1', part('c'), context)

    expect(q.takeQueuedMessage('chat-1', b.id)).toMatchObject({ index: 1, message: { content: 'b' } })
    expect(contents('chat-1')).toEqual(['a', 'c'])
    q.queueMessage('chat-1', part('b, edited'), context, 1)
    expect(contents('chat-1')).toEqual(['a', 'b, edited', 'c'])
  })

  it('puts a removed message back where it was on undo', () => {
    q.queueMessage('chat-1', part('a'), context)
    const b = q.queueMessage('chat-1', part('b'), context)
    const { message, index } = q.takeQueuedMessage('chat-1', b.id)!
    q.queueMessage('chat-1', part('c'), context)
    q.restoreQueuedMessage('chat-1', message, index)
    expect(contents('chat-1')).toEqual(['a', 'b', 'c'])
  })

  it('combines a whole queue into one draft for the composer, in order', () => {
    const combined = q.combineQueuedMessages([
      part('first', { attachments: [file('a.pdf')], mentionedPins: [{ id: 'p1', label: 'One' }] }),
      part('second', { attachments: [file('a.pdf'), file('b.pdf')], mentionedPins: [{ id: 'p1', label: 'One' }] }),
    ])
    expect(combined.content).toBe('first\n\nsecond')
    expect(combined.attachments.map((a) => a.file.name)).toEqual(['a.pdf', 'b.pdf'])
    expect(combined.mentionedPins.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('the reply before it', () => {
  it.each(['error', 'aborted'] as const)('holds the queue when the reply ends with %s', (outcome) => {
    streams.registerStream('chat-1')
    q.queueMessage('chat-1', part('next'), context)
    q.queueMessage('chat-1', part('after that'), context)
    streams.completeStream('chat-1', outcome)
    expect(q.getChatQueue('chat-1')?.heldBy).toBe(outcome)
    expect(q.queuedChatsReadyForBackground()).toEqual([])
    expect(q.takeAllQueuedMessages('chat-1')?.messages.map((m) => m.content)).toEqual(['next', 'after that'])
  })

  it('leaves it ready to send when the reply finishes', () => {
    streams.registerStream('chat-1')
    q.queueMessage('chat-1', part('next'), context)
    expect(q.queuedChatsReadyForBackground()).toEqual([])
    streams.completeStream('chat-1', 'done')
    expect(q.getChatQueue('chat-1')?.heldBy).toBeUndefined()
    expect(q.queuedChatsReadyForBackground()).toEqual(['chat-1'])
  })

  it('has the hold in place by the time anyone hears the reply ended', () => {
    streams.registerStream('chat-1')
    q.queueMessage('chat-1', part('next'), context)
    const seen: Array<string | undefined> = []
    q.subscribeQueue(() => seen.push(q.getChatQueue('chat-1')?.heldBy))
    streams.completeStream('chat-1', 'error')
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((heldBy) => heldBy === 'error')).toBe(true)
  })

  it('lifts a hold when another message is queued', () => {
    streams.registerStream('chat-1')
    q.queueMessage('chat-1', part('next'), context)
    streams.completeStream('chat-1', 'aborted')
    q.queueMessage('chat-1', part('more'), context)
    expect(q.getChatQueue('chat-1')?.heldBy).toBeUndefined()
  })
})

describe('background sending', () => {
  it('leaves a chat that is on screen to its own view', () => {
    const view = Symbol('view')
    q.setQueueForeground(view, 'chat-1')
    q.queueMessage('chat-1', part('next'), context)
    expect(q.queuedChatsReadyForBackground()).toEqual([])

    q.setQueueForeground(view, 'chat-2')
    expect(q.queuedChatsReadyForBackground()).toEqual(['chat-1'])
  })

  it('never sends for a new chat that has no id yet', () => {
    const key = q.newChatQueueKey()
    expect(q.isNewChatQueueKey(key)).toBe(true)
    q.queueMessage(key, part('next'), context)
    expect(q.queuedChatsReadyForBackground()).toEqual([])
  })

  it('moves a new chat’s queued message and views to its id', () => {
    const key = q.newChatQueueKey()
    const view = Symbol('view')
    q.setQueueForeground(view, key)
    q.queueMessage(key, part('next'), context)

    q.rekeyQueue(key, 'chat-9')
    expect(q.getChatQueue(key)).toBeUndefined()
    expect(contents('chat-9')).toEqual(['next'])
    expect(q.isQueueForeground('chat-9')).toBe(true)
  })
})

describe('merging helpers', () => {
  it('joins text with a blank line, skipping empty sides', () => {
    expect(q.joinMessageText('a', 'b')).toBe('a\n\nb')
    expect(q.joinMessageText('', ' b ')).toBe('b')
    expect(q.joinMessageText('a ', '')).toBe('a')
  })

  it('flags attachments over the limit and skips duplicates', () => {
    const merged = q.mergeAttachments([file('a.pdf'), file('b.pdf')], [file('b.pdf'), file('c.pdf')], 2)
    expect(merged.attachments.map((a) => a.file.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
    expect(merged.overflow).toBe(true)
  })
})

describe('stream registry', () => {
  it('attaches a stop handler to a stream reserved ahead of its request', () => {
    const stop = vi.fn()
    streams.registerStream('chat-1')
    expect(streams.stopStream('chat-1')).toBe(false)
    streams.registerStream('chat-1', stop)
    expect(streams.stopStream('chat-1')).toBe(true)
    expect(stop).toHaveBeenCalledOnce()
  })

  it('waits through a queued message sent the moment the reply before it ends', async () => {
    streams.registerStream('chat-1')
    // What MessageQueueRunner does: reserve the next stream as the first ends.
    const unsubscribe = streams.subscribeStreams((event) => {
      if (event.type === 'end') {
        unsubscribe()
        streams.registerStream('chat-1')
      }
    })
    let settled = false
    const waiting = streams.waitForChatStreams('chat-1', 60_000).then(() => { settled = true })

    streams.completeStream('chat-1', 'done')
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)

    streams.completeStream('chat-1', 'done')
    await waiting
    expect(settled).toBe(true)
  })

  it('stops waiting on a stream that hangs past the cap', async () => {
    vi.useFakeTimers()
    try {
      streams.registerStream('chat-1')
      const waiting = streams.waitForChatStreams('chat-1', 1_000)
      await vi.advanceTimersByTimeAsync(1_000)
      await expect(waiting).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
