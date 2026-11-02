'use client'

// The Library half of a chat's Sources (the Context panel lists it above the web pages read): every
// Library file the chat used (files sent in it, files its answers cited), the cited ones marked "Cited
// in answer", each with a switch to leave it out for the rest of the chat. The off list rides with
// every message (`librarySourcesOff`, see library-sources-off.ts); the backend keeping it and leaving
// those files out of answers is LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A10.

import { useMemo, useSyncExternalStore } from 'react'
import type { UIMessage } from '@/types/chat'
import { buildSourceRows, sourcesCount, toggleSourceOff, type FileRef, type SourceRow } from '@/lib/library/sources'
import { getSourcesOff, setSourcesOff, subscribeSourcesOff } from '@/lib/library/library-sources-off'
import { useFileRefs } from './useFileRefs'

export interface ChatLibrarySources {
  rows: SourceRow[]
  count: number
  /** Switch a file off (or back on) for the rest of this chat. */
  toggle: (fileId: string) => void
}

const NO_IDS: string[] = []

/** `chatId` undefined (no chat yet, or a temp- id before the first send lands) lists nothing. */
export function useChatLibrarySources(chatId: string | undefined, messages: readonly UIMessage[]): ChatLibrarySources {
  const key = chatId && !chatId.startsWith('temp-') ? chatId : ''
  const offIds = useSyncExternalStore(subscribeSourcesOff, () => getSourcesOff(key), () => getSourcesOff(key))

  const { scopeIds, citedIds, citedRefs } = useMemo(() => {
    const scope: string[] = []
    const cited: string[] = []
    const refs: Record<string, FileRef> = {}
    if (key) {
      for (const message of messages) {
        for (const id of message.libraryFileIds ?? []) scope.push(id)
        for (const citation of message.libraryCitations ?? []) {
          cited.push(citation.fileId)
          refs[citation.fileId] = citation.state === 'open'
            ? { id: citation.fileId, state: 'open', title: citation.title, format: citation.format }
            : { id: citation.fileId, state: citation.state }
        }
      }
    }
    return { scopeIds: Array.from(new Set(scope)), citedIds: Array.from(new Set(cited)), citedRefs: refs }
  }, [key, messages])

  // Names for the files that were sent (citations already carry theirs, and never a locked one's).
  // Fetched as soon as the list can show; until a file's answer is in, its row reads "Loading…".
  const unnamed = useMemo(() => {
    const ids = scopeIds.filter((id) => !citedRefs[id])
    return ids.length ? ids : NO_IDS
  }, [scopeIds, citedRefs])
  const { refs: sentRefs } = useFileRefs(unnamed)

  const rows = useMemo(() => buildSourceRows({
    scopeIds,
    citedIds,
    attachedIds: scopeIds,
    offIds: [...offIds],
    refs: { ...sentRefs, ...citedRefs },
    pendingIds: unnamed.filter((id) => !sentRefs[id]),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [scopeIds, citedIds, offIds, sentRefs, citedRefs, unnamed])

  return {
    rows,
    count: sourcesCount(scopeIds, citedIds),
    toggle: (fileId) => setSourcesOff(key, toggleSourceOff([...offIds], fileId)),
  }
}
