'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/Checkbox'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { libraryApi } from '@/lib/library/api'
import { libraryKeys } from '@/lib/library/keys'
import { CHAT_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { deleteChatToast, savedFilesLine, type OpenFileRef } from '@/lib/library/sources'
import { useLibraryViewer } from '@/lib/library/viewer'
import { FormatGlyph } from '../FormatGlyph'
import styles from './LibraryChat.module.css'

export interface DeleteChatFilesProps {
  /** Files saved to Library from this chat that the viewer may delete (owner, or Admin over a workspace file). */
  files: OpenFileRef[]
  alsoDelete: boolean
  onAlsoDeleteChange: (next: boolean) => void
}

/** The Library part of the Delete chat dialog: what stays in Library, and "Also delete these files" (off by default). */
export function DeleteChatFiles({ files, alsoDelete, onAlsoDeleteChange }: DeleteChatFilesProps) {
  if (files.length === 0) return <p className={styles.bodyText}>{CHAT_MESSAGES.noSavedFiles}</p>
  return (
    <>
      <p className={styles.bodyText}>{savedFilesLine(files.length)}</p>
      <div className={styles.usage}>
        {files.map((file) => (
          <div className={styles.usageRow} key={file.id}>
            <FormatGlyph format={file.format} size="xs" />
            <span className={styles.usageName}>{file.title}</span>
            <small>{file.generated ? CHAT_MESSAGES.outputKind : CHAT_MESSAGES.uploadKind}</small>
          </div>
        ))}
      </div>
      <label className={styles.checkLine}>
        <Checkbox checked={alsoDelete} onCheckedChange={(value) => onAlsoDeleteChange(value === true)} aria-label={CHAT_MESSAGES.alsoDeleteFiles} />
        <span>{CHAT_MESSAGES.alsoDeleteFiles}</span>
      </label>
    </>
  )
}

/** Moves the chat's saved files to Trash (30 days, restorable with their shares) and refreshes every Library read. */
export function useTrashChatFiles() {
  const queryClient = useQueryClient()
  const { orgKey } = useLibraryViewer()
  return async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map((id) => libraryApi.trashFile(id)))
    } finally {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) })
    }
  }
}

export interface DeleteChatWithFilesDialogProps {
  chatTitle: string
  files: OpenFileRef[]
  /** Deletes the chat itself (the existing chat delete). */
  onDeleteChat: () => Promise<void>
  onClose: () => void
}

/**
 * The prototype's Delete chat dialog: "Delete <chat>?", the saved files, "Also delete these files", and
 * a red Delete. With the box ticked the files go to Trash after the chat is deleted.
 */
export function DeleteChatWithFilesDialog({ chatTitle, files, onDeleteChat, onClose }: DeleteChatWithFilesDialogProps) {
  const [alsoDelete, setAlsoDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const trashFiles = useTrashChatFiles()
  const confirm = async () => {
    setBusy(true)
    try {
      await onDeleteChat()
      if (alsoDelete) await trashFiles(files.map((file) => file.id))
      toast(deleteChatToast(files.length, alsoDelete))
      onClose()
    } catch {
      toast.error(MESSAGES.genericFailure)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{`Delete ${chatTitle}?`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DeleteChatFiles files={files} alsoDelete={alsoDelete} onAlsoDeleteChange={setAlsoDelete} />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={busy} onClick={confirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
