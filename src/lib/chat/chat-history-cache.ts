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

/**
 * Put one chat back where it was in `snapshot` (same page, same position), leaving every other
 * change alone. For a failed delete: restoring the whole snapshot would also bring back chats
 * whose deletes succeeded in the meantime.
 */
export function restoreChat(data: ChatPages | undefined, snapshot: ChatPages | undefined, chatId: string): ChatPages | undefined {
  if (!data || !snapshot) return data
  const pageIndex = snapshot.pages.findIndex(page => (page.chats ?? []).some(c => c.id === chatId))
  if (pageIndex < 0 || data.pages.some(page => (page.chats ?? []).some(c => c.id === chatId))) return data
  const before = snapshot.pages[pageIndex].chats ?? []
  const chat = before.find(c => c.id === chatId)!
  const at = before.indexOf(chat)
  return mapChats(data, (chats, i) => {
    if (i !== Math.min(pageIndex, data.pages.length - 1)) return chats
    // Keep its old neighbour order: insert after the last chat that preceded it and is still here.
    const prior = new Set(before.slice(0, at).map(c => c.id))
    let insertAt = 0
    chats.forEach((c, k) => { if (prior.has(c.id)) insertAt = k + 1 })
    return [...chats.slice(0, insertAt), chat, ...chats.slice(insertAt)]
  })
}

/** A chat's title is still the placeholder the backend replaces after the first reply. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  return !title || title === 'New chat' || title === 'Untitled'
}
