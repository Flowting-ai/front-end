'use client'

import React from 'react'
import Link from 'next/link'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import { sentFileView, type FileRef } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import { LockGlyph } from './LockGlyph'
import styles from './LibraryChat.module.css'

export interface SentFileChipProps {
  fileId: string
  fileRef: FileRef | undefined
  /** Opens the file beside the chat. Without it the chip links to the File page. */
  onOpen?: (fileId: string) => void
}

/**
 * A file sent with a message, above the bubble. Open: type glyph and name (plus Uploading / Processing
 * while it is on its way). Deleted: "File deleted", which still opens the link (it reads "No longer
 * available"). Locked: "Locked file", not clickable.
 */
export function SentFileChip({ fileId, fileRef, onOpen }: SentFileChipProps) {
  const view = sentFileView(fileRef)
  if (view.kind === 'locked') {
    return (
      <span className={styles.chip} style={{ paddingLeft: 10 }}>
        <LockGlyph size={14} />
        <span>{view.label}</span>
      </span>
    )
  }
  const content =
    view.kind === 'open' && fileRef?.state === 'open' ? (
      <>
        <FormatGlyph format={fileRef.format} size="xs" />
        <span>{view.label}</span>
        {view.status && <small>{view.status}</small>}
      </>
    ) : (
      <span>{view.label}</span>
    )
  const className = `${styles.chip} ${view.kind === 'deleted' ? styles.chipPlain : ''}`
  if (onOpen && view.kind === 'open') {
    return <button type="button" className={className} onClick={() => onOpen(fileId)}>{content}</button>
  }
  return <Link className={className} href={LIBRARY_FILE_ROUTE(fileId)}>{content}</Link>
}

/** The row of sent files above a user message, right-aligned like the bubble. */
export function SentFiles({ children }: { children: React.ReactNode }) {
  return <div className={styles.files}>{children}</div>
}
