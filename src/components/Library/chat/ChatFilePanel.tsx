'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRightOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/ui/button'
import { Tooltip } from '@/components/Tooltip'
import { Skeleton } from '@/components/Skeleton'
import { isLockedError } from '@/lib/library/errors'
import { CHAT_MESSAGES, MESSAGES } from '@/lib/library/messages'
import { downloadFile } from '@/lib/library/mutations'
import { useLibraryFile } from '@/lib/library/queries'
import type { CiteLocator } from '@/lib/library/schemas'
import { citationHref } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import { GoneState, LockedState } from '../FileStates'
import styles from './LibraryChat.module.css'

const FilePreview = dynamic(() => import('../viewers/FilePreview'), { ssr: false, loading: () => <Skeleton height={240} radius={12} /> })

export interface ChatFilePanelProps {
  fileId: string
  cite?: CiteLocator | null
  onClose: () => void
}

/**
 * A file beside the chat, opened from a citation or a sent-file chip. A locked file shows the same
 * locked state as the File page (Request access, no title); a deleted one shows "No longer available".
 */
export function ChatFilePanel({ fileId, cite = null, onClose }: ChatFilePanelProps) {
  const file = useLibraryFile(fileId)
  const locked = isLockedError(file.error)
  const gone = !locked && (file.isError || file.data?.life === 'trashed')
  const open = file.data && !gone ? file.data : null
  return (
    <aside className={`${styles.panel} ${open ? styles.panelWide : ''}`} aria-label="File">
      <div className={styles.panelHead}>
        <h3>
          {open ? (
            <>
              <FormatGlyph format={open.format} size="xs" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{open.title}</span>
            </>
          ) : gone ? MESSAGES.goneTitle : locked ? CHAT_MESSAGES.lockedFile : ''}
        </h3>
        {open && (
          <Tooltip content="Open file page">
            <Link
              href={citationHref(open.id, cite)}
              aria-label="Open file page"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: 'var(--neutral-600)' }}
            >
              <ArrowUpRightOneIcon size={16} />
            </Link>
          </Tooltip>
        )}
        <IconButton variant="ghost" size="sm" aria-label="Close file" icon={<CancelOneIcon size={16} />} onClick={onClose} />
      </div>
      <div className={styles.panelBody} style={{ padding: 20 }}>
        {file.isPending ? (
          <Skeleton height={240} radius={12} />
        ) : locked ? (
          <LockedState fileId={fileId} />
        ) : gone || !open ? (
          <GoneState />
        ) : (
          <FilePreview file={open} cite={cite} onDownload={() => void downloadFile(open.id)} />
        )}
      </div>
    </aside>
  )
}
