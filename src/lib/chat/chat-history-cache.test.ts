import { describe, expect, it } from 'vitest'
import type { Chat } from '@/types/chat'
import {
  flattenChats,
  isPlaceholderTitle,
  nextChatCursor,
  patchChat,
  prependChat,
  removeChats,
  restoreChat,
  type ChatPages,
} from './chat-history-cache'

const chat = (id: string, extra: Partial<Chat> = {}) => ({ id, title: id, ...extra }) as Chat
const pages = (...lists: Chat[][]): ChatPages => ({
  pages: lists.map((chats, i) => ({ chats, has_more: i < lists.length - 1, next_cursor: `c${i}` })),
  pageParams: lists.map((_, i) => (i === 0 ? undefined : `c${i - 1}`)),
})

describe('chat history pages', () => {
  it('flattens in order, skipping project chats and duplicates across pages', () => {
    const data = pages([chat('a'), chat('p', { project_id: 'x' } as Partial<Chat>)], [chat('a'), chat('b')])
    expect(flattenChats(data).map(c => c.id)).toEqual(['a', 'b'])
    expect(flattenChats(undefined)).toEqual([])
  })

  it('reads the next cursor only while the backend has more', () => {
    expect(nextChatCursor({ chats: [], has_more: true, next_cursor: 'n' })).toBe('n')
    expect(nextChatCursor({ chats: [], has_more: false, next_cursor: 'n' })).toBeUndefined()
  })

  it('patches and removes wherever the chat is', () => {
    const data = pages([chat('a')], [chat('b')])
    expect(flattenChats(patchChat(data, 'b', { title: 'B2' }))[1].title).toBe('B2')
    expect(flattenChats(removeChats(data, ['a'])).map(c => c.id)).toEqual(['b'])
  })

  it('moves an existing chat to the top or adds a new one', () => {
    const data = pages([chat('a')], [chat('b')])
    expect(flattenChats(prependChat(data, 'b')).map(c => c.id)).toEqual(['b', 'a'])
    expect(flattenChats(prependChat(data, 'n', chat('n'))).map(c => c.id)).toEqual(['n', 'a', 'b'])
    expect(prependChat(data, 'missing')).toBe(data)
    expect(flattenChats(prependChat(undefined, 'n', chat('n'))).map(c => c.id)).toEqual(['n'])
  })

  it('knows placeholder titles', () => {
    expect(isPlaceholderTitle('New chat')).toBe(true)
    expect(isPlaceholderTitle(undefined)).toBe(true)
    expect(isPlaceholderTitle('Trip plan')).toBe(false)
  })

  it('puts back only the chat whose delete failed, where it was', () => {
    const snapshot = pages([chat('a'), chat('b'), chat('c')], [chat('d')])
    // b and c were deleted together; c's delete succeeded, b's failed.
    const now = removeChats(snapshot, ['b', 'c'])
    const restored = restoreChat(now, snapshot, 'b')
    expect(restored?.pages.map(p => p.chats.map(c => c.id))).toEqual([['a', 'b'], ['d']])
    expect(restoreChat(restored, snapshot, 'b')).toBe(restored)
    expect(restoreChat(now, snapshot, 'zz')).toBe(now)
  })
})
