'use client'

import React from 'react'
import { SentFileChip } from './SentFileChip'
import { useFileRefs } from './useFileRefs'

/**
 * A file chip above a user message, when the history says which Library file it is. A deleted or locked file
 * reads "File deleted" / "Locked file" (never the name, and no link to its contents); an open or still-loading
 * one keeps the chip the chat already draws.
 */
export function SentLibraryAttachment({ fileId, state, children }: { fileId: string; state?: 'open' | 'deleted' | 'locked'; children: React.ReactNode }) {
  // The history already says deleted or locked: no lookup (a locked file's detail would only answer 403).
  if (state === 'deleted' || state === 'locked') return <SentFileChip fileId={fileId} fileRef={{ id: fileId, state }} />
  return <LookedUpAttachment fileId={fileId}>{children}</LookedUpAttachment>
}

function LookedUpAttachment({ fileId, children }: { fileId: string; children: React.ReactNode }) {
  const { refs } = useFileRefs([fileId])
  const ref = refs[fileId]
  if (ref && ref.state !== 'open') return <SentFileChip fileId={fileId} fileRef={ref} />
  return <>{children}</>
}
