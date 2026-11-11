'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { trackLibrary } from '@/lib/library/analytics'
import { stashLibraryChat } from '@/lib/library/chat-handoff'
import { libraryPickAsFile } from '@/lib/library/upload/composer-uploads'
import type { LibraryFile } from '@/lib/library/file'
import { CHAT_ROUTE } from '@/lib/routes'


/**
 * "Ask about this file": opens a new chat with the file attached by its Library id. Typed text is sent as
 * the first message; with no text the chat opens with the file in the composer.
 */
export function useAskAbout() {
  const router = useRouter()
  // One ask at a time: a second click or Enter while the first is navigating would open a second chat
  // (losing the first question).
  const busy = useRef(false)
  return useCallback(
    async (file: LibraryFile, text = '') => {
      if (busy.current) return
      busy.current = true
      try {
        trackLibrary('ask_about', { format: file.format })
        // Attached by its Library id, like "Add from Library". Downloading it and attaching the bytes made
        // the chat upload it again, so every ask left a duplicate copy in Library.
        const attached = libraryPickAsFile({ id: file.id, name: file.name, sizeBytes: file.sizeBytes })
        stashLibraryChat({ file: attached, text: text.trim() })
        router.push(`${CHAT_ROUTE}?libraryFileId=${encodeURIComponent(file.id)}`)
      } finally {
        busy.current = false
      }
    },
    [router],
  )
}
