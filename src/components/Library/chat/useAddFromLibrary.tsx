'use client'

import React, { useState } from 'react'
import type { LibraryFile } from '@/lib/library/file'
import { LazyPickerDialog } from '../picker/LazyPickerDialog'

export interface UseAddFromLibraryOptions {
  /** Ids already attached (shown ticked, not pickable again). */
  excludeIds?: string[]
  /** "Add to chat" in the composer, "Attach" for a routine. */
  confirmLabel?: string
  onAdd: (files: LibraryFile[]) => void
  /** Attachment slots left; the picker stops further picks once reached. */
  max?: number
}

/**
 * "Add from Library": the + menu item (or a routine's Add files) calls `open`, and the caller renders
 * `dialog` once. Picked files are attached by reference (`libraryFileIds`), never re-uploaded.
 */
export function useAddFromLibrary({ excludeIds = [], confirmLabel, onAdd, max }: UseAddFromLibraryOptions) {
  const [isOpen, setOpen] = useState(false)
  const dialog = isOpen ? (
    <LazyPickerDialog
      excludeIds={excludeIds}
      confirmLabel={confirmLabel}
      max={max}
      onClose={() => setOpen(false)}
      onConfirm={onAdd}
    />
  ) : null
  return { open: () => setOpen(true), isOpen, dialog }
}
