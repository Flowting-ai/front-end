'use client'

import React, { useState } from 'react'
import { AlertCircleIcon, TickTwoIcon, DeleteTwoIcon, FolderLibraryIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { trackLibrary } from '@/lib/library/analytics'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { useRequestAccess, useRestoreFile } from '@/lib/library/mutations'
import { useLibraryViewer } from '@/lib/library/viewer'
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

/** The viewer has no access: nothing about the file (title, owner, size) is shown, only a way to ask. */
export function LockedState({ fileId }: { fileId: string }) {
  const { viewerId } = useLibraryViewer()
  const key = requestKey(viewerId, fileId)
  const request = useRequestAccess()
  const [sentNow, setSentNow] = useState(false)
  const sent = sentNow || (typeof window !== 'undefined' && readRequested(key))
  return (
    <EmptyState icon={<AlertCircleIcon size={20} />} title={FILE_MESSAGES.lockedTitle} text={FILE_MESSAGES.lockedText}>
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
                setSentNow(true)
                trackLibrary('request_access')
              },
            },
          )
        }
      >
        {sent ? FILE_MESSAGES.requestSent : 'Request access'}
      </Button>
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
