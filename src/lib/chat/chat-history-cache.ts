import type { InfiniteData } from '@tanstack/react-query'
import type { Chat, ChatsListResponse } from '@/types/chat'

/**
 * Pure operations on the cached chat list (an infinite query of
 * GET /chats pages). Used by hooks/use-chat-history.ts.
 */

export type ChatPages = InfiniteData<ChatsListResponse, string | undefined>

/** Next cursor, or undefined when the backend says there is no more. */
export function nextChatCursor(last: ChatsListResponse): string | undefined {
  return last.has_more ? (last.next_cursor ?? undefined) : undefined
}

/**
 * The sidebar list: all loaded pages in order, without chats linked to a
 * project (those belong to their project page) and without duplicates (a chat
 * can move between pages as activity reorders the list).
 */
export function flattenChats(data: ChatPages | undefined): Chat[] {
  if (!data) return []
  const seen = new Set<string>()
  const out: Chat[] = []
  for (const page of data.pages) {
    for (const chat of page.chats ?? []) {
      if (chat.project_id || seen.has(chat.id)) continue
      seen.add(chat.id)
      out.push(chat)
    }
  }
  return out
}

function mapChats(data: ChatPages, fn: (chats: Chat[], pageIndex: number) => Chat[]): ChatPages {
  return { ...data, pages: data.pages.map((page, i) => ({ ...page, chats: fn(page.chats ?? [], i) })) }
}

/** Patch one chat wherever it is. */
export function patchChat(data: ChatPages | undefined, chatId: string, patch: Partial<Chat>): ChatPages | undefined {
  if (!data) return data
  return mapChats(data, chats => chats.map(c => (c.id === chatId ? { ...c, ...patch } : c)))
}

/** Remove chats wherever they are. */
export function removeChats(data: ChatPages | undefined, chatIds: string[]): ChatPages | undefined {
  if (!data) return data
  const ids = new Set(chatIds)
  return mapChats(data, chats => chats.filter(c => !ids.has(c.id)))
}

/** Put a chat first (adding it, or moving the cached copy when `chat` is omitted). */
export function prependChat(data: ChatPages | undefined, chatId: string, chat?: Chat): ChatPages | undefined {
  if (!data) {
    return chat ? { pages: [{ chats: [chat], next_cursor: null, has_more: false } as ChatsListResponse], pageParams: [undefined] } : data
  }
  const existing = chat ?? flattenChats(data).find(c => c.id === chatId)
  if (!existing) return data
  return mapChats(data, (chats, i) => {
    const rest = chats.filter(c => c.id !== chatId)
    return i === 0 ? [existing, ...rest] : rest
  })
}

/** A chat's title is still the placeholder the backend replaces after the first reply. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  return !title || title === 'New chat' || title === 'Untitled'
}
