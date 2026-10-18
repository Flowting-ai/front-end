'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { LIBRARY_SETTINGS_ENABLED } from '@/lib/feature-flags'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import { useLibraryPrefs } from '@/lib/library/queries'
import { saveOutcome } from '@/lib/library/sources'
import { useDontSaveChat } from '@/lib/library/library-dont-save'
import { composerUploadFormat, markSaveChoice } from '@/lib/library/upload/composer-uploads'
import { AskSaveDialog } from './AskSaveDialog'

/**
 * Applies the person's auto-save setting to the files of a message about to be sent: Always saves,
 * Never keeps them in the chat ("Not saved. Auto-save is Never."), Ask each time shows
 * "Save N files to Library?". The choice rides with the message (`saveToLibrary`, see
 * composer-uploads). Until the backend serves /library/prefs (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 1) this is
 * off, and every file is saved as before.
 */
export function useSaveChoice(chatId?: string): { decideSave: (files: File[]) => Promise<void>; saveDialog: React.ReactNode } {
  const prefs = useLibraryPrefs(LIBRARY_SETTINGS_ENABLED)
  const dontSaveChat = useDontSaveChat(chatId)
  const [pending, setPending] = useState<{ files: File[]; resolve: () => void } | null>(null)

  const decideSave = (files: File[]): Promise<void> => {
    if (files.length === 0) return Promise.resolve()
    // "Don't save files from this chat" applies whatever the auto-save setting is (and needs no prefs).
    if (!prefs.data && !dontSaveChat) return Promise.resolve()
    const outcome = saveOutcome({
      mode: prefs.data?.effectiveAutoSave ?? 'always',
      forcedOff: prefs.data?.forcedOff ?? false,
      dontSaveChat,
    })
    if (outcome.action === 'save') {
      markSaveChoice(files, true)
      return Promise.resolve()
    }
    if (outcome.action === 'keep') {
      markSaveChoice(files, false)
      if (outcome.message) toast(outcome.message)
      return Promise.resolve()
    }
    return new Promise((resolve) => setPending({ files, resolve }))
  }

  const saveDialog = pending && (
    <AskSaveDialog
      files={pending.files.map((file, i) => ({ key: `${i}-${file.name}`, name: file.name, format: composerUploadFormat(file) }))}
      onChoose={(save) => {
        markSaveChoice(pending.files, save)
        if (!save) toast(CHAT_MESSAGES.notSavedAsk)
        pending.resolve()
        setPending(null)
      }}
    />
  )

  return { decideSave, saveDialog }
}
