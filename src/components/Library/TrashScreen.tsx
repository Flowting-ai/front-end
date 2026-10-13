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
import { daysLeftLabel, displayFileName, formatBytes, formatDateTime } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { useDeleteForever, useEmptyTrash, useRestoreFile } from '@/lib/library/mutations'
import { useTrash } from '@/lib/library/queries'
import type { LibraryFileRow } from '@/lib/library/schemas'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_FILE_ROUTE, LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { FormatGlyph } from './FormatGlyph'
import { ROW_HEIGHT } from './FileTable/FileTable'
import tableStyles from './FileTable/FileTable.module.css'
import { TrashTableSkeleton } from './LibrarySkeletons'
import { LibraryShell } from './LibraryShell'

const cell: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)', minWidth: 0 }
const head: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }

function TrashRowMenu({ file, onRestore, onDelete }: { file: LibraryFileRow; onRestore: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)

  // The menu is portaled, so close it on scroll instead of leaving it behind its row.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', close, { capture: true })
  }, [open])

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
          aria-label={`More actions for ${displayFileName(file)}`}
          aria-haspopup="menu"
          aria-expanded={open}
          icon={<MoreHorizontalIcon size={18} />}
        />
      }
    >
      <Dropdown maxHeight={false} style={{ minWidth: 168 }}>
        <Dropdown.Section fluid>
          <Dropdown.Item label="Restore" icon={<UndoTwoIcon />} fluid onClick={() => { setOpen(false); onRestore() }} />
        </Dropdown.Section>
        <Dropdown.Section fluid divider>
          <Dropdown.Item label="Delete forever" icon={<DeleteTwoIcon />} variant="danger" fluid onClick={() => { setOpen(false); onDelete() }} />
        </Dropdown.Section>
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
  const [pendingDelete, setPendingDelete] = useState<LibraryFileRow | null>(null)
  const [emptying, setEmptying] = useState(false)
  const hasFiles = trash.status === 'ready' && trash.files.length > 0

  return (
    <LibraryShell>
      <header style={{ display: 'flex', flexDirection: 'column', padding: '28px 40px 16px', flexShrink: 0 }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 8px' }}>
          <Link href={LIBRARY_ROUTE} style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '36px', color: 'var(--neutral-600)', textDecoration: 'none' }}>Library</Link>
          <ArrowRightOneIcon size={20} aria-hidden="true" style={{ color: 'var(--neutral-400)' }} />
          <h1 aria-current="page" style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '36px', color: 'var(--neutral-900)' }}>Trash</h1>
        </nav>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, rowGap: 8, marginTop: 12, padding: '8px 8px 8px 16px', borderRadius: 12,
            background: 'var(--neutral-100)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)',
          }}
        >
          <span style={{ flex: '1 1 260px', minWidth: 0 }}>{MESSAGES.trashBanner(TRASH_DAYS)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flex: 'none' }}>
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
        <div className={`kaya-scrollbar ${tableStyles.container}`} style={{ flex: '1 1 0', minHeight: 0, overflowX: 'hidden', overflowY: 'auto', margin: '0 40px 20px' }}>
          <div role="table" aria-label="Trash">
            {/* The header sticks while rows scroll under it (see the file table). In a narrow window Size, then Deleted, hide. */}
            <div role="rowgroup" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <div role="row" className={`${tableStyles.head} ${tableStyles.colsTrash}`}>
                <div role="columnheader" style={head}>Name</div>
                <div role="columnheader" style={head}>Days left</div>
                <div role="columnheader" className={tableStyles.cSize} style={head}>Size</div>
                <div role="columnheader" className={tableStyles.cDeleted} style={head}>Deleted</div>
                <div role="columnheader"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></div>
              </div>
            </div>
            <div role="rowgroup">
              {trash.files.map((file) => (
                <div key={file.id} role="row" className={`${tableStyles.row} ${tableStyles.colsTrash}`} style={{ height: ROW_HEIGHT }}>
                  <div role="cell" style={{ minWidth: 0 }}>
                    {/* The owner can still open a file in Trash (its page shows Restore). */}
                    <Link href={LIBRARY_FILE_ROUTE(file.id)} title={displayFileName(file)} className={tableStyles.rowLink}>
                      <FormatGlyph format={file.format} />
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className={tableStyles.truncate} style={{ ...cell, color: 'var(--neutral-900)' }}>{displayFileName(file)}</span>
                        {file.trashedBy && (
                          <span className={`${tableStyles.truncate} ${tableStyles.nameSub}`}>{MESSAGES.deletedBy(personName(file.trashedBy, viewerId))}</span>
                        )}
                      </span>
                    </Link>
                  </div>
                  <div role="cell" className={tableStyles.truncate} style={cell}>{daysLeftLabel(file.daysLeft)}</div>
                  <div role="cell" className={`${tableStyles.truncate} ${tableStyles.cSize}`} style={cell}>{formatBytes(file.sizeBytes)}</div>
                  <div role="cell" className={`${tableStyles.truncate} ${tableStyles.cDeleted}`} style={cell}>{file.trashedAt ? formatDateTime(file.trashedAt) : ''}</div>
                  <div role="cell" className={tableStyles.above} style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <Button variant="secondary" loading={trash.isFetchingNextPage} onClick={trash.fetchNextPage}>Load more</Button>
            </div>
          )}
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          title={MESSAGES.deleteForeverTitle(displayFileName(pendingDelete))}
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
          title={MESSAGES.emptyTrashTitle(trash.files.length)}
          description={MESSAGES.freesUpLine(trash.freesBytes > 0 ? formatBytes(trash.freesBytes) : null)}
          confirmLabel="Empty Trash"
          onConfirm={async () => {
            await emptyTrash.mutateAsync({ count: trash.files.length })
            trackLibrary('empty_trash')
          }}
          onClose={() => setEmptying(false)}
        />
      )}
    </LibraryShell>
  )
}
