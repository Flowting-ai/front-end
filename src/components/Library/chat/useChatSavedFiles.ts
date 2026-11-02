'use client'

// The Library files a chat saved, for the Delete chat dialog ("2 saved files stay in Library", "Also delete
// these files"). Since 25 Oct `GET /chats/{id}` lists them (`savedFiles`: the caller's own, still in Library).
// Where it can't (an agent chat, an older server) the ids come from the chat's own messages (`document_id` on
// each attachment), and only files this chat created that the viewer may delete count. When that history names
// fewer ids than it has attachments, the list would be wrong, so the status is "unknown" instead.

import { useQuery } from '@tanstack/react-query'
import { getChatLibraryState, getChatMessages } from '@/lib/api/chat'
import { libraryApi } from '@/lib/library/api'
import { libraryKeys } from '@/lib/library/keys'
import type { OpenFileRef } from '@/lib/library/sources'
import { useLibraryViewer } from '@/lib/library/viewer'
import { refFromDetail } from './useFileRefs'

const MAX_PAGES = 5

export type ChatSavedFiles = { status: 'loading' } | { status: 'unknown' } | { status: 'ready'; files: OpenFileRef[] }

/** The server's list, read as the dialog shows files; null when the chat endpoint can't say. */
async function savedFilesFromChat(chatId: string): Promise<OpenFileRef[] | null> {
  let saved
  try {
    saved = (await getChatLibraryState(chatId)).savedFiles
  } catch {
    return null
  }
  if (!Array.isArray(saved)) return null
  const details = await Promise.allSettled(saved.map((file) => libraryApi.getFile(file.id)))
  const files: OpenFileRef[] = []
  for (const detail of details) {
    if (detail.status !== 'fulfilled' || !detail.value.caps.delete) continue
    const ref = refFromDetail(detail.value)
    if (ref.state === 'open') files.push(ref)
  }
  return files
}

export async function savedFilesOf(chatId: string): Promise<ChatSavedFiles> {
  const fromChat = await savedFilesFromChat(chatId)
  if (fromChat) return { status: 'ready', files: fromChat }
  const ids: string[] = []
  let unnamed = 0
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getChatMessages(chatId, cursor)
    for (const message of result.messages) {
      if (message.role !== 'user') continue
      for (const attachment of message.file_attachments ?? []) {
        if (attachment.origin === 'generated') continue
        if (!attachment.document_id) unnamed += 1
        else if (!ids.includes(attachment.document_id)) ids.push(attachment.document_id)
      }
    }
    if (!result.has_more || !result.next_cursor) break
    cursor = result.next_cursor
  }
  if (unnamed > 0) return { status: 'unknown' }
  const details = await Promise.allSettled(ids.map((id) => libraryApi.getFile(id)))
  const files: OpenFileRef[] = []
  for (const detail of details) {
    if (detail.status !== 'fulfilled') continue
    const file = detail.value
    if (file.life !== 'active' || !file.caps.delete) continue
    // An upload that does not say which chat it came from cannot be told from a file only picked from Library
    // (Part 3 A5): never offer to delete a file on a guess.
    if (file.provenance.kind === 'upload' && !file.provenance.chatId) return { status: 'unknown' }
    // Files this chat created; a file only picked from Library stays out of the question.
    if (file.provenance.chatId !== chatId) continue
    const ref = refFromDetail(file)
    if (ref.state === 'open') files.push(ref)
  }
  return { status: 'ready', files }
}

export function useChatSavedFiles(chatId: string, enabled = true): ChatSavedFiles {
  const { orgKey, ready } = useLibraryViewer()
  const query = useQuery({
    queryKey: [...libraryKeys.all(orgKey), 'chat-saved-files', chatId],
    queryFn: () => savedFilesOf(chatId),
    enabled: enabled && ready,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  if (query.data) return query.data
  // A failed lookup must not block deleting: treat it like an unknown history.
  return query.isError ? { status: 'unknown' } : { status: 'loading' }
}
