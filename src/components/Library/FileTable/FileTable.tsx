'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { ArrowDownTwoIcon, ArrowUpDownIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { formatDateTime, formatLabel } from '@/lib/library/format'
import type { SortDir, SortKey } from '@/lib/library/query-params'
import type { LibraryFile } from '@/lib/library/file'
import { nextRowIndex, withFocusedRow } from '@/lib/library/table-focus'
import { LIBRARY_FILE_ROUTE } from '@/lib/routes'
import { AccessAvatars } from '../PersonAvatar'
import { FileThumb } from '../FileThumb'
import { GeneratedMark, UnreadDot } from '../FileMarks'
import { cancelFilePreload, preloadFilePage } from '../viewers/preload'
import { RowMenu, type RowAction } from './RowMenu'
import styles from './FileTable.module.css'

// Keep in step with .fixedRow in FileTable.module.css.
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

function SortHeading({ label, sortKey, active, dir, onSort }: { label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (key: SortKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={styles.sortButton}
      data-active={active}
    >
      {label}
      {/* Sortable headings always show an arrow; the active one shows the direction. */}
      {active ? (dir === 'asc' ? <ArrowUpTwoIcon size={12} /> : <ArrowDownTwoIcon size={12} />) : <ArrowUpDownIcon size={12} />}
    </button>
  )
}

function HeadLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.headLabel}>{children}</span>
}

export interface FileRowProps {
  file: LibraryFile
  kind: TableKind
  viewerId: string | undefined
  rowIndex: number
  onAction: (action: RowAction, file: LibraryFile) => void
  className?: string
  /** The virtualiser's offset for this row, in px. A number (not a style object) so a memoised row
   *  only re-renders when its file or position changes, not on every scroll tick. */
  offset?: number
}

export function FileRow({ file, kind, viewerId, rowIndex, onAction, className, offset }: FileRowProps) {
  const name = file.name
  const caps = file.caps
  const hide = HIDE_CLASS[kind]
  return (
    <div role="row" aria-rowindex={rowIndex} className={cx(styles.row, styles.fixedRow, COLUMN_CLASS[kind], className)} style={offset === undefined ? undefined : { transform: `translateY(${offset}px)` }}>
      <div role="cell" className={styles.cell}>
        <Link
          href={LIBRARY_FILE_ROUTE(file.id)}
          className={styles.rowLink}
          title={name}
          // Warm the file page (code, then details and preview) while the pointer is over the row.
          onPointerEnter={() => preloadFilePage(file.format, file.id)}
          onPointerLeave={cancelFilePreload}
          onFocus={() => preloadFilePage(file.format, file.id)}
        >
          <FileThumb file={file} width={32} height={32} className={styles.thumb} />
          <span className={styles.nameStack}>
            <span className={styles.nameLine}>
              <span className={cx(styles.truncate, styles.text, styles.name)} data-unread={file.unread}>{name}</span>
              {file.source === 'generated' && <GeneratedMark file={file} />}
              {file.unread && <UnreadDot />}
            </span>
            {file.snippet && <span className={cx(styles.truncate, styles.text, styles.snippet)}>{file.snippet}</span>}
          </span>
        </Link>
      </div>
      <div role="cell" className={cx(styles.above, styles.cell, hide.access)}>
        <AccessAvatars file={file} viewerId={viewerId} />
      </div>
      {kind === 'all' && (
        <div role="cell" className={cx(styles.truncate, styles.text, hide.source)}>{file.source === 'generated' ? 'Generated' : 'Uploaded'}</div>
      )}
      <div role="cell" className={cx(styles.truncate, styles.text)}>
        {kind === 'shared' && file.sharedAt ? formatDateTime(file.sharedAt) : formatDateTime(file.createdAt)}
      </div>
      <div role="cell" className={cx(styles.truncate, styles.text, hide.type)}>{formatLabel(file.format)}</div>
      <div role="cell" className={cx(styles.above, styles.actionsCell)}>
        {(caps.open) && <RowMenu file={file} onAction={onAction} />}
      </div>
    </div>
  )
}

// FileTable itself is skipped by React Compiler (useVirtualizer returns unmemoisable functions), so
// rows are memoised by hand. Files are immutable objects, so a changed file is a new reference.
const MemoFileRow = React.memo(FileRow)

export interface FileTableProps {
  files: LibraryFile[]
  kind: TableKind
  viewerId: string | undefined
  /** Identifies this view, so its scroll position can be restored. */
  viewKey: string
  /** The sort to mark on the headings; a null key marks none (Shared's untouched order). */
  sort: { key: SortKey | null; dir: SortDir }
  onSort: (key: SortKey) => void
  onAction: (action: RowAction, file: LibraryFile) => void
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
  files, kind, viewerId, viewKey, sort, onSort, onAction, hasNextPage, isFetchingNextPage, fetchNextPage, isRefreshing = false, label = 'Files',
}: FileTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // The row holding keyboard focus stays rendered while it is scrolled out of view (table-focus.ts).
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  // A row an arrow key moved to: setting focusedIndex renders it, then the effect below focuses it.
  const pendingFocus = useRef<number | null>(null)
  const rowCount = files.length
  // The count guard drops a focused index the list shrank under before the effect below resets it.
  const rangeExtractor = useCallback((range: Range) => withFocusedRow(defaultRangeExtractor(range), focusedIndex, rowCount), [focusedIndex, rowCount])
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => files[index]?.id ?? index,
    initialOffset: scrollMemory.get(viewKey) ?? 0,
    rangeExtractor,
  })
  const items = virtualizer.getVirtualItems()
  // The last row the viewport (plus overscan) reaches. Not the last of `items`: that can be the pinned
  // focused row, which would keep loading pages while the person is near the top.
  const visibleEnd = virtualizer.range?.endIndex
  const lastIndex = visibleEnd === undefined ? -1 : Math.min(visibleEnd + OVERSCAN, files.length - 1)

  // The list shrank under the focused row (a refetch with fewer files): move focus to the new last
  // row if the table still had focus (the row unmounted, so focus fell to <body>), otherwise drop it.
  useEffect(() => {
    if (focusedIndex === null || focusedIndex < files.length) return
    const active = document.activeElement
    const tableHadFocus = active === null || active === document.body || bodyRef.current?.contains(active)
    if (files.length > 0 && tableHadFocus) {
      pendingFocus.current = files.length - 1
      setFocusedIndex(files.length - 1)
    } else {
      setFocusedIndex(null)
    }
  }, [focusedIndex, files.length])

  // Load the next page when the person scrolls near the end of what is loaded.
  useEffect(() => {
    if (lastIndex >= files.length - LOAD_MORE_THRESHOLD && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [lastIndex, files.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null || target !== focusedIndex) return
    pendingFocus.current = null
    bodyRef.current?.querySelector<HTMLElement>(`[aria-rowindex="${target + 2}"] a`)?.focus({ preventScroll: true })
  }, [focusedIndex])

  // Rows are indexed from their aria-rowindex (the header is row 1).
  const rowIndexOf = (target: EventTarget) => {
    const row = (target as HTMLElement).closest?.('[role="row"]')
    const value = Number(row?.getAttribute('aria-rowindex'))
    return Number.isFinite(value) && value >= 2 ? value - 2 : null
  }

  const onBodyFocus = (event: React.FocusEvent) => setFocusedIndex(rowIndexOf(event.target))
  const onBodyBlur = (event: React.FocusEvent) => {
    if (!bodyRef.current?.contains(event.relatedTarget as Node | null)) setFocusedIndex(null)
  }

  // Arrow Up/Down, Home and End move between rows from a row's link (not from inside its menu).
  const onBodyKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.target as HTMLElement).classList.contains(styles.rowLink)) return
    const current = rowIndexOf(event.target)
    if (current === null) return
    const next = nextRowIndex(event.key, current, files.length)
    if (next === null || next === current) return
    event.preventDefault()
    pendingFocus.current = next
    setFocusedIndex(next)
    virtualizer.scrollToIndex(next, { align: 'auto' })
  }

  // Remember where this view was scrolled to, and restore it when the view changes without a remount
  // (a sort change); on mount initialOffset has already placed it.
  const mountedViewKey = useRef(viewKey)
  useEffect(() => {
    if (mountedViewKey.current !== viewKey) {
      mountedViewKey.current = viewKey
      virtualizer.scrollToOffset(scrollMemory.get(viewKey) ?? 0)
    }
    const element = scrollRef.current
    return () => {
      if (element) scrollMemory.set(viewKey, element.scrollTop)
    }
    // The virtualizer instance is stable for the component's life.
  }, [viewKey, virtualizer])

  const dateKey: SortKey = kind === 'shared' ? 'shared' : 'created'
  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => (sort.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending')
  const hide = HIDE_CLASS[kind]

  return (
    <div
      ref={scrollRef}
      className={cx('kaya-scrollbar', styles.container, styles.scroll)}
      data-refreshing={isRefreshing}
    >
      <div role="table" aria-label={label} aria-rowcount={hasNextPage ? -1 : files.length + 1} aria-busy={isRefreshing}>
        {/* The header sticks to the top of the scroll area; it lives on this wrapper because a sticky element only sticks inside a tall parent. */}
        <div role="rowgroup" className={styles.stickyHead}>
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
            <div role="columnheader"><span className={styles.srOnly}>Actions</span></div>
          </div>
        </div>
        <div
          ref={bodyRef}
          role="rowgroup"
          className={styles.body}
          style={{ height: virtualizer.getTotalSize() }}
          onFocus={onBodyFocus}
          onBlur={onBodyBlur}
          onKeyDown={onBodyKeyDown}
        >
          {items.map((item) => {
            const file = files[item.index]
            if (!file) return null
            return (
              <MemoFileRow
                key={file.id}
                file={file}
                kind={kind}
                viewerId={viewerId}
                rowIndex={item.index + 2}
                onAction={onAction}
                className={styles.virtualRow}
                offset={item.start}
              />
            )
          })}
        </div>
      </div>
      {isFetchingNextPage && (
        <p role="status" className={cx(styles.text, styles.loadingMore)}>Loading more files</p>
      )}
    </div>
  )
}
