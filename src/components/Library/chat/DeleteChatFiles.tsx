'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/Checkbox'
import { Skeleton } from '@/components/Skeleton'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { libraryApi } from '@/lib/library/api'
import { libraryKeys } from '@/lib/library/keys'
import { CHAT_MESSAGES, chatDeletedTrashFailed, MESSAGES } from '@/lib/library/messages'
import { deleteChatToast, savedFilesLine, type OpenFileRef } from '@/lib/library/sources'
import { useLibraryViewer } from '@/lib/library/viewer'
import { FormatGlyph } from '../FormatGlyph'
import { chatDeletedToast } from './chat-deleted-toast'
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
  /** Resolves with how many files could not be moved; each is tried, so one failure never stops the rest. */
  return async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0
    try {
      const results = await Promise.allSettled(ids.map((id) => libraryApi.trashFile(id)))
      return results.filter((result) => result.status === 'rejected').length
    } finally {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) })
    }
  }
}

export interface DeleteChatWithFilesDialogProps {
  chatId: string
  chatTitle: string
  files: OpenFileRef[]
  /** The chat's saved files are still being looked up: the list is a placeholder and Delete waits. */
  loading?: boolean
  /** Deletes the chat itself (the existing chat delete). */
  onDeleteChat: () => Promise<void>
  onClose: () => void
}

/**
 * The prototype's Delete chat dialog: "Delete <chat>?", the saved files, "Also delete these files", and
 * a red Delete. With the box ticked the files go to Trash after the chat is deleted.
 */
export function DeleteChatWithFilesDialog({ chatId, chatTitle, files, loading = false, onDeleteChat, onClose }: DeleteChatWithFilesDialogProps) {
  const [alsoDelete, setAlsoDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const { orgKey } = useLibraryViewer()
  const trashFiles = useTrashChatFiles()
  const confirm = async () => {
    setBusy(true)
    // Stage 1: the chat. On failure the dialog stays open so Delete can be retried.
    try {
      await onDeleteChat()
    } catch {
      toast.error(MESSAGES.genericFailure)
      setBusy(false)
      return
    }
    // The chat is gone, so every "Used in" list and file origin in Library has changed.
    void queryClient.invalidateQueries({ queryKey: libraryKeys.all(orgKey) })
    // Stage 2: the files. The chat is gone, so it is never retried; report what could not be trashed and close.
    let failed = 0
    if (alsoDelete) {
      try {
        failed = await trashFiles(files.map((file) => file.id))
      } catch {
        failed = files.length
      }
    }
    if (failed > 0) toast.error(chatDeletedTrashFailed(failed))
    // Undo brings back the chat only, so it is offered when no file went to Trash with it.
    else chatDeletedToast(deleteChatToast(files.length, alsoDelete), chatId, queryClient, orgKey, { undo: !alsoDelete || files.length === 0 })
    setBusy(false)
    onClose()
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{`Delete ${chatTitle}?`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {loading ? (
            <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton height={20} />
              <Skeleton height={20} />
            </div>
          ) : (
            <DeleteChatFiles files={files} alsoDelete={alsoDelete} onAlsoDeleteChange={setAlsoDelete} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={busy || loading} onClick={confirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
