'use client'

// The Library files a chat saved, for the Delete chat dialog ("2 saved files stay in Library", "Also delete
// these files"). The ids come from the chat's own messages (`document_id` on each attachment); each file is
// then read through the File detail query, and only files this chat created that the viewer may delete count.
// When the history names fewer ids than it has attachments (the backend does not send `document_id` yet,
// LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A10) the list would be wrong, so the status is "unknown" instead.

import { useQuery } from '@tanstack/react-query'
import { getChatMessages } from '@/lib/api/chat'
import { libraryApi } from '@/lib/library/api'
import { libraryKeys } from '@/lib/library/keys'
import type { OpenFileRef } from '@/lib/library/sources'
import { useLibraryViewer } from '@/lib/library/viewer'
import { refFromDetail } from './useFileRefs'

const MAX_PAGES = 5

export type ChatSavedFiles = { status: 'loading' } | { status: 'unknown' } | { status: 'ready'; files: OpenFileRef[] }

export async function savedFilesOf(chatId: string): Promise<ChatSavedFiles> {
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
