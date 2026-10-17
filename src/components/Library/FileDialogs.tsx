'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { downloadFile } from '@/lib/library/mutations'
import { libraryErrorMessage } from '@/lib/library/errors'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { captureError } from '@/lib/library/observability'
import type { LibraryFile } from '@/lib/library/file'
import type { RowAction } from './FileTable/RowMenu'

// Each dialog is its own chunk, fetched the first time it opens (`{open && ...}` below), so none of
// them weigh on the list page.
const ShareDialog = dynamic(() => import('./dialogs/ShareDialog').then((module) => module.ShareDialog), { ssr: false, loading: () => null })
const RenameDialog = dynamic(() => import('./dialogs/RenameDialog').then((module) => module.RenameDialog), { ssr: false, loading: () => null })
const DeleteFileDialog = dynamic(() => import('./dialogs/DeleteFileDialog').then((module) => module.DeleteFileDialog), { ssr: false, loading: () => null })

export type FileDialogState = { type: 'share' | 'rename' | 'delete'; file: LibraryFile } | null

export function FileDialogs({ dialog, onClose, onDeleted }: { dialog: FileDialogState; onClose: () => void; onDeleted?: () => void }) {
  if (!dialog) return null
  switch (dialog.type) {
    case 'share':
      return <ShareDialog file={dialog.file} onClose={onClose} onLostAccess={onDeleted} />
    case 'rename':
      return <RenameDialog file={dialog.file} onClose={onClose} />
    case 'delete':
      return <DeleteFileDialog file={dialog.file} onClose={onClose} onDeleted={onDeleted} />
  }
}

/** Row and page actions: the dialog ones open a dialog, Download asks for a short-lived link. */
export function useFileActions() {
  const [dialog, setDialog] = useState<FileDialogState>(null)
  const handle = (action: RowAction, file: LibraryFile) => {
    if (action === 'download') {
      toast(FILE_MESSAGES.downloading(file.name))
      downloadFile(file.id).catch((error: unknown) => {
        captureError(error, { boundary: 'download', fileId: file.id })
        toast.error(libraryErrorMessage(error, "Couldn't download this file."))
      })
      return
    }
    setDialog({ type: action, file })
  }
  return { dialog, closeDialog: () => setDialog(null), handle }
}
