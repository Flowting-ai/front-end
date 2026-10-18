'use client'

// The chat's Sources: a header button ("Sources · N") and the panel beside the answer. It lists every
// Library file the chat used (files sent in it, files its answers cited), marks the cited ones "Cited
// in answer", and lets a file be switched off for the rest of the chat. The off list rides with every
// message (`librarySourcesOff`, see library-sources-off.ts); the backend keeping it and leaving those
// files out of answers is LIBRARY_FLOW_A_BACKEND_TICKET.md Part 3 A10.

import React, { useMemo, useState, useSyncExternalStore } from 'react'
import type { UIMessage } from '@/types/chat'
import { buildSourceRows, sourcesCount, toggleSourceOff, type FileRef } from '@/lib/library/sources'
import { getSourcesOff, setSourcesOff, subscribeSourcesOff } from '@/lib/library/library-sources-off'
import { useFileRefs } from './useFileRefs'
import { SourcesButton, SourcesPanel } from './SourcesPanel'

export function ChatSources({ chatId, messages }: { chatId: string | undefined; messages: readonly UIMessage[] }) {
  const [open, setOpen] = useState(false)
  const key = chatId ?? ''
  const offIds = useSyncExternalStore(subscribeSourcesOff, () => getSourcesOff(key), () => getSourcesOff(key))

  const { scopeIds, citedIds, citedRefs } = useMemo(() => {
    const scope: string[] = []
    const cited: string[] = []
    const refs: Record<string, FileRef> = {}
    for (const message of messages) {
      for (const id of message.libraryFileIds ?? []) scope.push(id)
      for (const citation of message.libraryCitations ?? []) {
        cited.push(citation.fileId)
        refs[citation.fileId] = citation.state === 'open'
          ? { id: citation.fileId, state: 'open', title: citation.title, format: citation.format }
          : { id: citation.fileId, state: citation.state }
      }
    }
    return { scopeIds: Array.from(new Set(scope)), citedIds: Array.from(new Set(cited)), citedRefs: refs }
  }, [messages])

  // Names for the files that were sent (citations already carry theirs, and never a locked one's).
  const { refs: sentRefs } = useFileRefs(open ? scopeIds.filter((id) => !citedRefs[id]) : [])
  const count = sourcesCount(scopeIds, citedIds)
  if (!chatId || count === 0) return null

  const rows = buildSourceRows({
    scopeIds,
    citedIds,
    attachedIds: scopeIds,
    offIds: [...offIds],
    refs: { ...sentRefs, ...citedRefs },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  return (
    <>
      <div style={{ position: 'absolute', top: 8, right: 104, zIndex: 10 }}>
        <SourcesButton count={count} open={open} onClick={() => setOpen((value) => !value)} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 52, right: 12, bottom: 12, zIndex: 20, display: 'flex', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card-deep)' }}>
          <SourcesPanel rows={rows} onToggle={(fileId) => setSourcesOff(key, toggleSourceOff([...offIds], fileId))} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
