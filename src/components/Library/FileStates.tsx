'use client'

import type { LibraryFile } from '@/lib/library/file'

import React from 'react'
import { AlertCircleIcon, DeleteTwoIcon, FolderLibraryIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { trackLibrary } from '@/lib/library/analytics'
import { FILE_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { useRestoreFile, useRetryProcessing } from '@/lib/library/mutations'
import { LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { LinkButton } from './LinkButton'
import styles from './FileScreen.module.css'

/** The viewer has no access: nothing about the file (title, owner, size) is shown. */
export function LockedState() {
  return <EmptyState icon={<AlertCircleIcon size={20} />} title={FILE_MESSAGES.lockedTitle} text={FILE_MESSAGES.lockedText} />
}

/** Deleted, never existed, or not visible to this person: one line, no title, no hint the file existed. */
export function GoneState({ backHref = LIBRARY_ROUTE }: { backHref?: string }) {
  return (
    <EmptyState icon={<FolderLibraryIcon size={20} />} title={FILE_MESSAGES.goneTitle}>
      <LinkButton href={backHref}>{FILE_MESSAGES.backToLibrary}</LinkButton>
    </EmptyState>
  )
}

/** A file in Trash, opened by its owner: how many days are left, and Restore. */
export function TrashedBanner({ fileId, title, daysLeft, canRestore }: { fileId: string; title: string; daysLeft: number | undefined; canRestore: boolean }) {
  const restore = useRestoreFile()
  return (
    <div role="status" className={styles.stateBanner}>
      <DeleteTwoIcon size={20} className={styles.stateIcon} />
      <div className={styles.grow}>
        <b>{FILE_MESSAGES.inTrash}</b>
        {daysLeft !== undefined && <p>{FILE_MESSAGES.daysLeft(daysLeft)}</p>}
      </div>
      {canRestore && (
        <Button
          variant="secondary"
          size="sm"
          loading={restore.isPending}
          onClick={() => restore.mutate({ id: fileId, title }, { onSuccess: () => trackLibrary('restore') })}
        >
          {FILE_MESSAGES.restore}
        </Button>
      )}
    </div>
  )
}

/** Uploading or Processing: a spinner, the word, and a progress bar that runs until the file is ready. */
export function ProcessingBanner({ phase }: { phase: 'uploading' | 'processing' }) {
  const label = phase === 'uploading' ? FILE_MESSAGES.uploading : FILE_MESSAGES.processing
  return (
    <div role="status" className={styles.stateBanner}>
      <Spinner size={20} className={styles.stateIcon} />
      <div className={styles.grow}>
        <b>{label}</b>
        <div className={styles.progress} aria-hidden="true"><i /></div>
      </div>
    </div>
  )
}

const GHOST_WIDTHS = [92, 84, 96, 60, 88, 72, 90, 40]

/** Where the preview will be, while the file is not ready yet. */
export function GhostLines() {
  return (
    <div className={styles.ghostLines} aria-hidden="true">
      {GHOST_WIDTHS.map((width, index) => (
        <i key={index} style={{ width: `${width}%` }} />
      ))}
    </div>
  )
}


/** Library work does not block access to the original file. */
export function LibraryProcessingBanner({ file }: { file: LibraryFile }) {
  const retry = useRetryProcessing()
  if (!file.processingPending && file.processingPhase !== 'failed') return null
  const failed = file.processingPhase === 'failed'
  return (
    <div role={failed ? 'alert' : 'status'} className={styles.stateBanner}>
      {!failed && <Spinner size={20} className={styles.stateIcon} />}
      <p className={styles.grow}>{failed ? FILE_MESSAGES.libraryProcessingFailed : FILE_MESSAGES.libraryProcessing}</p>
      {failed && file.caps.rename && (
        <Button variant="secondary" disabled={retry.isPending} onClick={() => retry.mutate(file.id)}>{MESSAGES.retry}</Button>
      )}
    </div>
  )
}
