import React from 'react'
import { Skeleton } from '@/components/Skeleton'
import { COLUMN_CLASS, HIDE_CLASS, type TableKind } from './FileTable/FileTable'
import tableStyles from './FileTable/FileTable.module.css'
import suggestedStyles from './SuggestedView.module.css'
import fileStyles from './FileScreen.module.css'
import trashStyles from './TrashScreen.module.css'
import styles from './LibrarySkeletons.module.css'

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ')
const fade = (index: number) => 1 - index * 0.07
const nameWidth = (index: number) => `${46 + ((index * 23) % 40)}%`

function Avatars({ count }: { count: number }) {
  return (
    <span className={styles.avatars}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} width={24} height={24} radius="50%" className={styles.avatar} />
      ))}
    </span>
  )
}

function NameCell({ index }: { index: number }) {
  return (
    <div role="presentation" className={cx(styles.row, styles.nameCell)}>
      <Skeleton width={32} height={32} radius={8} />
      <Skeleton width={nameWidth(index)} height={14} radius={6} />
    </div>
  )
}

/** The page title and storage line, tool buttons and tab strip, with the real header's spacing. */
export function LibraryHeaderSkeleton({ tools = true }: { tools?: boolean }) {
  return (
    <header aria-hidden="true" className={styles.header}>
      <div className={cx(styles.row, styles.headerBar)}>
        <div className={cx(styles.row, styles.gap12)}>
          <Skeleton width={88} height={24} radius={8} />
          <Skeleton width={84} height={14} radius={6} />
        </div>
        <div className={styles.grow} />
        {tools && (
          <div className={cx(styles.row, styles.gap4)}>
            <Skeleton width={240} height={36} radius={10} />
            <Skeleton width={36} height={36} radius={10} />
          </div>
        )}
      </div>
      <div className={styles.tabs}>
        <Skeleton width={216} height={36} radius={12} />
      </div>
    </header>
  )
}

/** Header row plus rows with the table's real grid, so nothing shifts when the files arrive. */
export function FileTableSkeleton({ rows = 9, kind = 'all' }: { rows?: number; kind?: TableKind }) {
  const all = kind === 'all'
  const hide = HIDE_CLASS[kind]
  return (
    <div role="status" aria-busy="true" aria-label="Loading files" className={cx(tableStyles.container, styles.table)}>
      <div>
        <div className={cx(tableStyles.head, COLUMN_CLASS[kind])}>
          <Skeleton width={44} height={12} radius={6} />
          <span className={hide.access}><Skeleton width={48} height={12} radius={6} /></span>
          {all && <span className={hide.source}><Skeleton width={52} height={12} radius={6} /></span>}
          <Skeleton width={all ? 64 : 84} height={12} radius={6} />
          <span className={hide.type}><Skeleton width={36} height={12} radius={6} /></span>
          <span />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={cx(tableStyles.row, tableStyles.fixedRow, COLUMN_CLASS[kind])} style={{ opacity: fade(index) }}>
            <NameCell index={index} />
            <span className={hide.access}><Avatars count={1 + (index % 3 === 2 ? 1 : 0)} /></span>
            {all && <span className={hide.source}><Skeleton width={64} height={14} radius={6} /></span>}
            <Skeleton width={96} height={14} radius={6} />
            <span className={hide.type}><Skeleton width={68} height={14} radius={6} /></span>
            <Skeleton width={28} height={28} radius={8} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Trash table: Name, Days left, Size, Deleted, menu (Size, then Deleted, hide in a narrow window). */
export function TrashTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading trash" className={cx(tableStyles.container, styles.table)}>
      <div>
        <div className={cx(tableStyles.head, tableStyles.colsTrash)}>
          <Skeleton width={44} height={12} radius={6} />
          <Skeleton width={60} height={12} radius={6} />
          <span className={tableStyles.cSize}><Skeleton width={32} height={12} radius={6} /></span>
          <span className={tableStyles.cDeleted}><Skeleton width={56} height={12} radius={6} /></span>
          <span />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={cx(tableStyles.row, tableStyles.fixedRow, tableStyles.colsTrash)} style={{ opacity: fade(index) }}>
            <NameCell index={index} />
            <Skeleton width={56} height={14} radius={6} />
            <span className={tableStyles.cSize}><Skeleton width={52} height={14} radius={6} /></span>
            <span className={tableStyles.cDeleted}><Skeleton width={110} height={14} radius={6} /></span>
            <Skeleton width={28} height={28} radius={8} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHead({ width, action }: { width: number; action?: boolean }) {
  return (
    <div className={cx(styles.row, styles.sectionHead)}>
      <Skeleton width={width} height={18} radius={6} className={styles.sectionTitle} />
      {action && <Skeleton width={64} height={28} radius={8} />}
    </div>
  )
}

function Tiles() {
  return (
    <div className={suggestedStyles.tileGrid}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={cx(suggestedStyles.tile, styles.tile)}>
          <Skeleton width={32} height={32} radius={8} />
          <div className={styles.stack6}>
            <Skeleton width="70%" height={14} radius={6} />
            <Skeleton width="40%" height={12} radius={6} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Recent cards, Frequently used and Generated tiles, in the Suggested view's real sizes and gaps. */
export function SuggestedSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading suggestions" className={cx(suggestedStyles.page, styles.suggested)}>
      <section className={styles.stack10}>
        <SectionHead width={56} action />
        <div className={cx(suggestedStyles.cardGrid, styles.cardGrid)}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cx(suggestedStyles.card, styles.card)}>
              <Skeleton width="70%" height={14} radius={6} />
              <div className={styles.cardIcon}>
                <Skeleton width={56} height={56} radius={14} />
              </div>
              <Skeleton width="50%" height={12} radius={6} />
            </div>
          ))}
        </div>
      </section>
      <section className={styles.stack10}>
        <SectionHead width={112} />
        <Tiles />
      </section>
      <section className={styles.stack10}>
        <SectionHead width={76} action />
        <Tiles />
      </section>
    </div>
  )
}

/** Trash header: the "Library > Trash" title and the rule banner. */
export function TrashHeaderSkeleton() {
  return (
    <header aria-hidden="true" className={trashStyles.header}>
      <div className={trashStyles.breadcrumb}>
        <Skeleton width={72} height={24} radius={8} />
        <Skeleton width={20} height={20} radius={6} />
        <Skeleton width={64} height={24} radius={8} />
      </div>
      <Skeleton height={48} radius={12} className={styles.banner} />
    </header>
  )
}

/** A file page, like the real one: floating pills on a grey canvas, the white page, the info card and the ask pill. */
export function FilePageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading file" className={cx(fileStyles.viewer, fileStyles.viewerInfo)}>
      <div className={fileStyles.bar} aria-hidden="true">
        <Skeleton width={240} height={36} radius={12} />
        <span className={fileStyles.end}>
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width={84} height={36} radius={12} />
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width={36} height={36} radius={12} />
        </span>
      </div>
      <div className={cx(fileStyles.scroll, styles.clip)}>
        <div className={fileStyles.main}>
          <div className={fileStyles.page}>
            <Skeleton width="48%" height={26} radius={8} />
            <Skeleton width={96} height={12} radius={6} className={styles.meta} />
            <div className={styles.stack12}>
              {[92, 84, 96, 60, 88, 72, 90, 40].map((width, index) => (
                <Skeleton key={index} width={`${width}%`} height={10} radius={6} />
              ))}
            </div>
          </div>
        </div>
        <div className={fileStyles.spacer} />
      </div>
      <div className={fileStyles.slide}><aside className={fileStyles.info} aria-hidden="true">
        <div className={fileStyles.infoHead}>
          <Skeleton width={72} height={16} radius={6} />
        </div>
        <div className={fileStyles.block}>
          <Skeleton width="70%" height={16} radius={6} />
          <Skeleton width="55%" height={12} radius={6} className={styles.below} />
        </div>
        <div className={cx(fileStyles.block, styles.stack12)}>
          {[60, 40, 70, 70, 45, 35].map((width, index) => (
            <div key={index} className={styles.infoRow}>
              <Skeleton width={56} height={14} radius={6} />
              <Skeleton width={`${width}%`} height={14} radius={6} />
            </div>
          ))}
        </div>
        <div className={fileStyles.block}>
          <Skeleton width={80} height={14} radius={6} />
          <Skeleton width="60%" height={12} radius={6} className={styles.below} />
        </div>
        <div className={fileStyles.block}>
          <Skeleton width={110} height={14} radius={6} />
          <div className={cx(styles.row, styles.person)}>
            <Skeleton width={28} height={28} radius="50%" />
            <Skeleton width={96} height={14} radius={6} />
          </div>
        </div>
      </aside></div>
      <div className={fileStyles.dock} aria-hidden="true">
        <Skeleton width="min(560px, calc(100% - 48px))" height={52} radius={16} />
      </div>
    </div>
  )
}

/** The Library route while it loads: header plus the default (Suggested) view. */
export function LibraryRouteLoading() {
  return (
    <div className={styles.route}>
      <LibraryHeaderSkeleton tools={false} />
      <SuggestedSkeleton />
    </div>
  )
}

/** The file route while it loads. */
export function FileRouteLoading() {
  return (
    <div className={styles.route}>
      <FilePageSkeleton />
    </div>
  )
}

/** The Trash route while it loads. */
export function TrashRouteLoading() {
  return (
    <div className={styles.route}>
      <TrashHeaderSkeleton />
      <TrashTableSkeleton />
    </div>
  )
}
