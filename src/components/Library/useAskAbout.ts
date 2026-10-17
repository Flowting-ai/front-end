'use client'

import { useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { trackLibrary } from '@/lib/library/analytics'
import { stashLibraryChat } from '@/lib/library/chat-handoff'
import { libraryApi } from '@/lib/library/api'
import { captureError } from '@/lib/library/observability'
import type { LibraryFile } from '@/lib/library/file'
import { CHAT_ROUTE } from '@/lib/routes'


/**
 * "Ask about this file": fetches the file, then opens a new chat with it attached. Typed text is sent as
 * the first message; with no text the chat opens with the file in the composer.
 */
export function useAskAbout() {
  const router = useRouter()
  // One ask at a time: the download can take seconds, and a second click or Enter in that time would
  // download again and open a second chat (losing the first question).
  const busy = useRef(false)
  return useCallback(
    async (file: LibraryFile, text = '') => {
      if (busy.current) return
      busy.current = true
      try {
        trackLibrary('ask_about', { format: file.format })
        let attached: File | null = null
        try {
          const url = await libraryApi.getDownloadUrl(file.id)
          const response = await fetch(url)
          if (!response.ok) throw new Error(`download failed (${response.status})`)
          const blob = await response.blob()
          attached = new File([blob], file.name, { type: blob.type })
        } catch (error) {
          captureError(error, { boundary: 'ask-about', fileId: file.id })
          toast.error("Couldn't attach this file. Opening a new chat without it.")
        }
        stashLibraryChat({ file: attached, text: text.trim() })
        router.push(`${CHAT_ROUTE}?libraryFileId=${encodeURIComponent(file.id)}`)
      } finally {
        busy.current = false
      }
    },
    [router],
  )
}
