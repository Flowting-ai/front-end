'use client'

import React from 'react'
import { InformationCircleIcon } from '@strange-huge/icons'
import { LIBRARY_SETTINGS_ENABLED } from '@/lib/feature-flags'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import { useLibraryPrefs } from '@/lib/library/queries'

/**
 * Under the composer while an Admin has turned AI reference off for the workspace:
 * "Your Admin has turned off Library search. Attaching files still works." (prototype chat.tsx composer-note).
 * It says nothing when only the person's own switch is off. Reads the prefs only while the settings flag is on.
 */
export function LibrarySearchOffNote() {
  const prefs = useLibraryPrefs(LIBRARY_SETTINGS_ENABLED)
  if (prefs.data?.aiReferenceAllowed !== false) return null
  return (
    <p
      role="note"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '8px 0 0',
        fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)',
      }}
    >
      <InformationCircleIcon size={14} aria-hidden="true" />
      {CHAT_MESSAGES.librarySearchOffNote}
    </p>
  )
}
