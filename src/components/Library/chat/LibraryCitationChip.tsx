'use client'

import React from 'react'
import Link from 'next/link'
import { Tooltip } from '@/components/Tooltip'
import { trackLibrary } from '@/lib/library/analytics'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import type { CiteLocator } from '@/lib/library/schemas'
import { citationHref, citationLabel, type FileRef } from '@/lib/library/sources'
import { LockGlyph } from './LockGlyph'
import styles from './LibraryChat.module.css'

export interface LibraryCitationChipProps {
  /** What the viewer may know about the cited file. */
  fileRef: FileRef
  locator?: CiteLocator | null
  /** Opens the locked panel beside the chat (the same panel the File page shows). */
  onOpenLocked?: (fileId: string) => void
  /** Overrides the default link to the File page (for example to open a side panel). */
  onOpen?: (fileId: string, locator?: CiteLocator | null) => void
}

/**
 * A Library citation after the sentence it supports. Open: the file name only (an audio citation adds
 * the time), linking to the passage. Locked: "Locked file". Deleted: "File deleted",
 * never the title.
 */
export function LibraryCitationChip({ fileRef, locator, onOpenLocked, onOpen }: LibraryCitationChipProps) {
  const label = citationLabel(fileRef, locator)
  if (fileRef.state === 'deleted') {
    return (
      <Tooltip content={CHAT_MESSAGES.fileDeletedTip}>
        <span className={`${styles.cite} ${styles.deleted}`} tabIndex={0}>
          <span>{label}</span>
        </span>
      </Tooltip>
    )
  }
  if (fileRef.state === 'locked') {
    return (
      <Tooltip content={CHAT_MESSAGES.lockedFileTip}>
        <button type="button" className={`${styles.cite} ${styles.locked}`} onClick={() => onOpenLocked?.(fileRef.id)}>
          <LockGlyph />
          <span>{label}</span>
        </button>
      </Tooltip>
    )
  }
  if (onOpen) {
    return (
      <Tooltip content={CHAT_MESSAGES.openCitedTip}>
        <button type="button" className={styles.cite} onClick={() => onOpen(fileRef.id, locator)}>
          <span>{label}</span>
        </button>
      </Tooltip>
    )
  }
  return (
    <Tooltip content={CHAT_MESSAGES.openCitedTip}>
      <Link className={styles.cite} href={citationHref(fileRef.id, locator)} onClick={() => trackLibrary('citation_opened')}>
        <span>{label}</span>
      </Link>
    </Tooltip>
  )
}
