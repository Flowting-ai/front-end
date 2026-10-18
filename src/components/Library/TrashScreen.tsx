'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircleIcon, ArrowRightOneIcon, DeleteTwoIcon, MoreHorizontalIcon, UndoTwoIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import ConfirmModal from '@/components/ConfirmModal'
import { Dropdown } from '@/components/Dropdown'
import { personName } from '@/lib/library/access'
import { trackLibrary } from '@/lib/library/analytics'
import { TRASH_DAYS } from '@/lib/library/constants'
import { daysLeftLabel, formatBytes, formatDateTime } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { useDeleteForever, useEmptyTrash, useRestoreFile } from '@/lib/library/mutations'
import { useTrash } from '@/lib/library/queries'
import type { LibraryFile } from '@/lib/library/file'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_FILE_ROUTE, LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { FormatGlyph } from './FormatGlyph'
import tableStyles from './FileTable/FileTable.module.css'
import { TrashTableSkeleton } from './LibrarySkeletons'
import { LibraryShell } from './LibraryShell'
import styles from './TrashScreen.module.css'

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ')
const cell = cx(tableStyles.truncate, tableStyles.text)

function TrashRowMenu({ file, onRestore, onDelete }: { file: LibraryFile; onRestore: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)

  // The menu is portaled, so close it on scroll instead of leaving it behind its row.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [open])

  // Restore and Delete forever are the owner's alone (the server refuses anyone else).
  const { restore, deleteForever } = file.caps
  if (!restore && !deleteForever) return null
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      autoFlipVertical
      trigger={
        <IconButton
          className={tableStyles.menuHover}
          data-open={open || undefined}
          variant="ghost"
          size="sm"
          aria-label={`More actions for ${file.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          icon={<MoreHorizontalIcon size={18} />}
        />
      }
    >
      <Dropdown maxHeight={false} className={styles.menu}>
        {restore && (
          <Dropdown.Section fluid>
            <Dropdown.Item label="Restore" icon={<UndoTwoIcon />} fluid onClick={() => { setOpen(false); onRestore() }} />
          </Dropdown.Section>
        )}
        {deleteForever && (
          <Dropdown.Section fluid divider={restore}>
            <Dropdown.Item label="Delete forever" icon={<DeleteTwoIcon />} variant="danger" fluid onClick={() => { setOpen(false); onDelete() }} />
          </Dropdown.Section>
        )}
      </Dropdown>
    </Dropdown.Float>
  )
}

/**
 * Library > Trash, laid out like the prototype: a "Library > Trash" title (no storage label, no tools), a
 * banner with the 30 day rule, the size it frees and Empty Trash, then the table. Restore brings shares back.
 */
export function TrashScreen() {
  const trash = useTrash()
  const { viewerId } = useLibraryViewer()
  const restore = useRestoreFile()
  const deleteForever = useDeleteForever()
  const emptyTrash = useEmptyTrash()
  const [pendingDelete, setPendingDelete] = useState<LibraryFile | null>(null)
  const [emptying, setEmptying] = useState(false)
  const hasFiles = trash.status === 'ready' && trash.files.length > 0

  return (
    <LibraryShell>
      <header className={styles.header}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href={LIBRARY_ROUTE} className={styles.crumb}>Library</Link>
          <ArrowRightOneIcon size={20} aria-hidden="true" className={styles.separator} />
          <h1 aria-current="page" className={styles.title}>Trash</h1>
        </nav>
        <div className={styles.banner}>
          <span className={styles.bannerText}>{MESSAGES.trashBanner(TRASH_DAYS)}</span>
          <span className={styles.bannerActions}>
            {hasFiles && <span>Frees up {formatBytes(trash.freesBytes)}</span>}
            <Button variant="outline" size="sm" disabled={!hasFiles} onClick={() => setEmptying(true)}>Empty Trash</Button>
          </span>
        </div>
      </header>

      {trash.status === 'loading' ? (
        <TrashTableSkeleton />
      ) : trash.status === 'error' ? (
        <EmptyState icon={<AlertCircleIcon size={20} />} title={MESSAGES.listError}>
          <Button variant="secondary" onClick={trash.refetch}>{MESSAGES.retry}</Button>
        </EmptyState>
      ) : trash.files.length === 0 ? (
        <EmptyState icon={<DeleteTwoIcon size={20} />} title={MESSAGES.trashEmptyTitle} />
      ) : (
        <div className={cx('kaya-scrollbar', tableStyles.container, tableStyles.scroll)}>
          <div role="table" aria-label="Trash">
            {/* The header sticks while rows scroll under it (see the file table). In a narrow window Size, then Deleted, hide. */}
            <div role="rowgroup" className={tableStyles.stickyHead}>
              <div role="row" className={`${tableStyles.head} ${tableStyles.colsTrash}`}>
                <div role="columnheader" className={tableStyles.headLabel}>Name</div>
                <div role="columnheader" className={tableStyles.headLabel}>Days left</div>
                <div role="columnheader" className={cx(tableStyles.headLabel, tableStyles.cSize)}>Size</div>
                <div role="columnheader" className={cx(tableStyles.headLabel, tableStyles.cDeleted)}>Deleted</div>
                <div role="columnheader"><span className={tableStyles.srOnly}>Actions</span></div>
              </div>
            </div>
            <div role="rowgroup">
              {trash.files.map((file) => (
                <div key={file.id} role="row" className={cx(tableStyles.row, tableStyles.fixedRow, tableStyles.colsTrash)}>
                  <div role="cell" className={tableStyles.cell}>
                    {/* The owner can still open a file in Trash (its page shows Restore). */}
                    <Link href={`${LIBRARY_FILE_ROUTE(file.id)}?from=trash`} title={file.name} className={tableStyles.rowLink}>
                      <FormatGlyph format={file.format} />
                      <span className={tableStyles.nameStack}>
                        <span className={cx(cell, tableStyles.name)}>{file.name}</span>
                        {file.trashedBy && (
                          <span className={`${tableStyles.truncate} ${tableStyles.nameSub}`}>{MESSAGES.deletedBy(personName(file.trashedBy, viewerId))}</span>
                        )}
                      </span>
                    </Link>
                  </div>
                  <div role="cell" className={cell}>{daysLeftLabel(file.daysLeft)}</div>
                  <div role="cell" className={cx(cell, tableStyles.cSize)}>{formatBytes(file.sizeBytes)}</div>
                  <div role="cell" className={cx(cell, tableStyles.cDeleted)}>{file.trashedAt ? formatDateTime(file.trashedAt) : ''}</div>
                  <div role="cell" className={cx(tableStyles.above, tableStyles.actionsCell)}>
                    <TrashRowMenu
                      file={file}
                      onRestore={() => restore.mutate({ id: file.id }, { onSuccess: () => trackLibrary('restore', { format: file.format }) })}
                      onDelete={() => setPendingDelete(file)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {trash.hasNextPage && (
            <div className={styles.loadMore}>
              <Button variant="secondary" loading={trash.isFetchingNextPage} onClick={trash.fetchNextPage}>Load more</Button>
            </div>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          title={MESSAGES.deleteForeverTitle(pendingDelete.name)}
          description={MESSAGES.freesUpLine(pendingDelete.sizeBytes > 0 ? formatBytes(pendingDelete.sizeBytes) : null)}
          confirmLabel="Delete forever"
          onConfirm={async () => {
            await deleteForever.mutateAsync({ id: pendingDelete.id })
            trackLibrary('delete_forever', { format: pendingDelete.format })
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
      {emptying && (
        <ConfirmModal
          // The server empties the whole Trash; a count is shown only when every row is loaded.
          title={trash.hasNextPage ? MESSAGES.emptyTrashAllTitle : MESSAGES.emptyTrashTitle(trash.files.length)}
          description={MESSAGES.freesUpLine(trash.freesBytes > 0 ? formatBytes(trash.freesBytes) : null)}
          confirmLabel="Empty Trash"
          onConfirm={async () => {
            // 0: the count is unknown, so the toast says "Trash emptied" rather than a wrong number.
            await emptyTrash.mutateAsync({ count: trash.hasNextPage ? 0 : trash.files.length })
            trackLibrary('empty_trash')
          }}
          onClose={() => setEmptying(false)}
        />
      )}
    </LibraryShell>
  )
}
