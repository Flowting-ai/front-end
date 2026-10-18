'use client'

import type { LibraryFile } from '@/lib/library/file'

import React, { useState } from 'react'
import { AlertCircleIcon, DeleteTwoIcon, FolderLibraryIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { trackLibrary } from '@/lib/library/analytics'
import { FILE_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { useRequestAccess, useRestoreFile, useRetryProcessing } from '@/lib/library/mutations'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_REQUEST_ACCESS_ENABLED } from '@/lib/feature-flags'
import { LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { LinkButton } from './LinkButton'
import styles from './FileScreen.module.css'

// A sent request is remembered per person and file, so the button still reads "Request sent" after a
// reload. Storage may be blocked (private mode): then it is remembered for this visit only.
const requestKey = (viewerId: string | undefined, fileId: string) => `library:access-requested:${viewerId ?? 'anon'}:${fileId}`

function readRequested(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeRequested(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Blocked storage: the in-memory state still shows "Request sent".
  }
}

/** Request access, once per file. Rendered only while the backend has the endpoint (LIBRARY_REQUEST_ACCESS_ENABLED). */
function RequestAccessButton({ fileId }: { fileId: string }) {
  const { viewerId } = useLibraryViewer()
  const key = requestKey(viewerId, fileId)
  const request = useRequestAccess()
  const [sentKey, setSentKey] = useState<string | null>(null)
  const sent = sentKey === key || readRequested(key)
  return (
    <Button
      disabled={sent}
      loading={request.isPending}
      leftIcon={sent ? <TickTwoIcon size={16} /> : undefined}
      onClick={() =>
        request.mutate(
          { id: fileId },
          {
            onSuccess: () => {
              writeRequested(key)
              setSentKey(key)
              trackLibrary('request_access')
            },
          },
        )
      }
    >
      {sent ? FILE_MESSAGES.requestSent : MESSAGES.requestAccess}
    </Button>
  )
}

/** The viewer has no access: nothing about the file (title, owner, size) is shown, only a way to ask. */
export function LockedState({ fileId }: { fileId?: string }) {
  return (
    <EmptyState icon={<AlertCircleIcon size={20} />} title={FILE_MESSAGES.lockedTitle} text={FILE_MESSAGES.lockedText}>
      {LIBRARY_REQUEST_ACCESS_ENABLED && fileId ? <RequestAccessButton fileId={fileId} /> : null}
    </EmptyState>
  )
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
        {daysLeft !== undefined && <p>{daysLeft <= 0 ? FILE_MESSAGES.lessThanADayLeft : FILE_MESSAGES.daysLeft(daysLeft)}</p>}
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
