'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDownTwoIcon, ArrowUpDownIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { capsOf } from '@/lib/library/access'
import { displayFileName, formatDateTime, formatLabel } from '@/lib/library/format'
import type { SortDir, SortKey } from '@/lib/library/query-params'
import type { LibraryFileRow } from '@/lib/library/schemas'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import { AccessAvatars } from '../PersonAvatar'
import { FormatGlyph } from '../FormatGlyph'
import { GeneratedMark, UnreadDot } from '../FileMarks'
import { preloadFilePage } from '../viewers/preload'
import { RowMenu, type RowAction } from './RowMenu'
import styles from './FileTable.module.css'

export const ROW_HEIGHT = 50
const OVERSCAN = 8
const LOAD_MORE_THRESHOLD = 5

/** The grid columns per list, as CSS classes so a narrow window can hide columns (FileTable.module.css). */
export const COLUMN_CLASS = {
  all: styles.colsAll,
  shared: styles.colsShared,
} as const

/** Which columns hide first in a narrow window: All files drops Source then Access; Shared drops Type. */
export const HIDE_CLASS = {
  all: { access: styles.cTight, source: styles.cNarrow, type: undefined },
  shared: { access: undefined, source: undefined, type: styles.cNarrow },
} as const

export type TableKind = keyof typeof COLUMN_CLASS

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ')

// Scroll position per view, kept in memory so coming back from a file lands where the person was.
const scrollMemory = new Map<string, number>()

const cellText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-700)' }

function SortHeading({ label, sortKey, active, dir, onSort }: { label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (key: SortKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: active ? 'var(--neutral-900)' : 'var(--neutral-600)',
      }}
    >
      {label}
      {/* Sortable headings always show an arrow; the active one shows the direction. */}
      {active ? (dir === 'asc' ? <ArrowUpTwoIcon size={12} /> : <ArrowDownTwoIcon size={12} />) : <ArrowUpDownIcon size={12} />}
    </button>
  )
}

function HeadLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>{children}</span>
}

export interface FileRowProps {
  file: LibraryFileRow
  kind: TableKind
  viewerId: string | undefined
  rowIndex: number
  onAction: (action: RowAction, file: LibraryFileRow) => void
  sharingEnabled: boolean
  style?: React.CSSProperties
}

export function FileRow({ file, kind, viewerId, rowIndex, onAction, sharingEnabled, style }: FileRowProps) {
  const name = displayFileName(file)
  const caps = capsOf(file)
  const hide = HIDE_CLASS[kind]
  return (
    <div role="row" aria-rowindex={rowIndex} className={cx(styles.row, COLUMN_CLASS[kind])} style={{ height: ROW_HEIGHT, ...style }}>
      <div role="cell" style={{ minWidth: 0 }}>
        <Link
          href={LIBRARY_FILE_ROUTE(file.id)}
          className={styles.rowLink}
          title={name}
          // Warm the file page's code while the pointer is over the row, so opening it does not wait.
          onPointerEnter={() => preloadFilePage(file.format)}
          onFocus={() => preloadFilePage(file.format)}
        >
          {file.thumbnailUrl ? (
            // Small private rendition in a fixed box; the type icon stands in when there is none.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.thumbnailUrl} alt="" width={32} height={32} loading="lazy" decoding="async" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <FormatGlyph format={file.format} />
          )}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span className={styles.truncate} style={{ ...cellText, fontWeight: file.unread ? 500 : 400, color: 'var(--neutral-900)' }}>{name}</span>
              {file.source === 'generated' && <GeneratedMark file={file} />}
              {file.unread && <UnreadDot />}
            </span>
            {file.snippet && <span className={styles.truncate} style={{ ...cellText, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{file.snippet}</span>}
          </span>
        </Link>
      </div>
      <div role="cell" className={cx(styles.above, hide.access)} style={{ minWidth: 0 }}>
        <AccessAvatars file={file} viewerId={viewerId} />
      </div>
      {kind === 'all' && (
        <div role="cell" className={cx(styles.truncate, hide.source)} style={cellText}>{file.source === 'generated' ? 'Generated' : 'Uploaded'}</div>
      )}
      <div role="cell" className={styles.truncate} style={cellText}>
        {kind === 'shared' && file.sharedAt ? formatDateTime(file.sharedAt) : formatDateTime(file.createdAt)}
      </div>
      <div role="cell" className={cx(styles.truncate, hide.type)} style={cellText}>{formatLabel(file.format)}</div>
      <div role="cell" className={styles.above} style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {(caps.open) && <RowMenu file={file} onAction={onAction} sharingEnabled={sharingEnabled} />}
      </div>
    </div>
  )
}

export interface FileTableProps {
  files: LibraryFileRow[]
  kind: TableKind
  viewerId: string | undefined
  /** Identifies this view, so its scroll position can be restored. */
  viewKey: string
  /** The sort to mark on the headings; a null key marks none (Shared's untouched order). */
  sort: { key: SortKey | null; dir: SortDir }
  onSort: (key: SortKey) => void
  onAction: (action: RowAction, file: LibraryFileRow) => void
  sharingEnabled: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  /** A refetch is running behind the rows on screen: dim them and mark the table busy. */
  isRefreshing?: boolean
  label?: string
}

/**
 * The file list. It is a virtualised ARIA table: only the visible rows (plus a few) are in the DOM,
 * every row has a fixed height, and rows carry aria-rowindex so assistive tech knows where it is in
 * a list that is not all rendered. Only Name and the date column sort.
 */
export function FileTable({
  files, kind, viewerId, viewKey, sort, onSort, onAction, sharingEnabled, hasNextPage, isFetchingNextPage, fetchNextPage, isRefreshing = false, label = 'Files',
}: FileTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => files[index]?.id ?? index,
    initialOffset: scrollMemory.get(viewKey) ?? 0,
  })
  const items = virtualizer.getVirtualItems()
  const lastIndex = items.length > 0 ? items[items.length - 1].index : -1

  // Load the next page when the person scrolls near the end of what is loaded.
  useEffect(() => {
    if (lastIndex >= files.length - LOAD_MORE_THRESHOLD && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [lastIndex, files.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Remember where this view was scrolled to.
  useEffect(() => {
    const element = scrollRef.current
    return () => {
      if (element) scrollMemory.set(viewKey, element.scrollTop)
    }
  }, [viewKey])

  const dateKey: SortKey = kind === 'shared' ? 'shared' : 'created'
  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => (sort.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending')
  const hide = HIDE_CLASS[kind]

  return (
    <div
      ref={scrollRef}
      className={cx('kaya-scrollbar', styles.container)}
      style={{ flex: '1 1 0', minHeight: 0, overflowX: 'hidden', overflowY: 'auto', margin: '0 40px 20px', opacity: isRefreshing ? 0.6 : 1, transition: 'opacity 120ms' }}
    >
      <div role="table" aria-label={label} aria-rowcount={hasNextPage ? -1 : files.length + 1} aria-busy={isRefreshing}>
        {/* The header sticks to the top of the scroll area; it lives on this wrapper because a sticky element only sticks inside a tall parent. */}
        <div role="rowgroup" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <div role="row" aria-rowindex={1} className={cx(styles.head, COLUMN_CLASS[kind])}>
            <div role="columnheader" aria-sort={ariaSort('name')}>
              <SortHeading label="Name" sortKey="name" active={sort.key === 'name'} dir={sort.dir} onSort={onSort} />
            </div>
            <div role="columnheader" className={hide.access}><HeadLabel>Access</HeadLabel></div>
            {kind === 'all' && <div role="columnheader" className={hide.source}><HeadLabel>Source</HeadLabel></div>}
            <div role="columnheader" aria-sort={ariaSort(dateKey)}>
              <SortHeading label={kind === 'shared' ? 'Date shared' : 'Created'} sortKey={dateKey} active={sort.key === dateKey} dir={sort.dir} onSort={onSort} />
            </div>
            <div role="columnheader" className={hide.type}><HeadLabel>Type</HeadLabel></div>
            <div role="columnheader"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></div>
          </div>
        </div>
        <div role="rowgroup" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map((item) => {
            const file = files[item.index]
            if (!file) return null
            return (
              <FileRow
                key={file.id}
                file={file}
                kind={kind}
                viewerId={viewerId}
                rowIndex={item.index + 2}
                onAction={onAction}
                sharingEnabled={sharingEnabled}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
              />
            )
          })}
        </div>
      </div>
      {isFetchingNextPage && (
        <p role="status" style={{ ...cellText, textAlign: 'center', padding: 12, margin: 0, color: 'var(--neutral-500)' }}>Loading more files</p>
      )}
    </div>
  )
}
