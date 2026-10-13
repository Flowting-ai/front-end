import React from 'react'
import { Skeleton } from '@/components/Skeleton'
import { COLUMN_CLASS, HIDE_CLASS, ROW_HEIGHT, type TableKind } from './FileTable/FileTable'
import tableStyles from './FileTable/FileTable.module.css'
import suggestedStyles from './SuggestedView.module.css'
import fileStyles from './FileScreen.module.css'

const fade = (index: number) => 1 - index * 0.07
const nameWidth = (index: number) => `${46 + ((index * 23) % 40)}%`

function Avatars({ count }: { count: number }) {
  return (
    <span style={{ display: 'inline-flex' }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} width={24} height={24} radius="50%" style={{ marginLeft: index ? -6 : 0, boxShadow: '0 0 0 2px var(--card-bg)' }} />
      ))}
    </span>
  )
}

function NameCell({ index }: { index: number }) {
  return (
    <div role="presentation" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Skeleton width={32} height={32} radius={8} />
      <Skeleton width={nameWidth(index)} height={14} radius={6} />
    </div>
  )
}

/** The page title and storage line, tool buttons and tab strip, with the real header's spacing. */
export function LibraryHeaderSkeleton({ tools = true }: { tools?: boolean }) {
  return (
    <header aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', padding: '28px 40px 13px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 36, padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={88} height={24} radius={8} />
          <Skeleton width={84} height={14} radius={6} />
        </div>
        <div style={{ flex: 1 }} />
        {tools && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Skeleton width={240} height={36} radius={10} />
            <Skeleton width={36} height={36} radius={10} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 24 }}>
        <Skeleton width={216} height={36} radius={12} />
      </div>
    </header>
  )
}

/** Header row plus rows with the table's real grid, so nothing shifts when the files arrive. */
export function FileTableSkeleton({ rows = 9, kind = 'all' }: { rows?: number; kind?: TableKind }) {
  const all = kind === 'all'
  const hide = HIDE_CLASS[kind]
  const cols = `${tableStyles.head} ${COLUMN_CLASS[kind]}`
  const rowCols = `${tableStyles.row} ${COLUMN_CLASS[kind]}`
  return (
    <div role="status" aria-busy="true" aria-label="Loading files" className={tableStyles.container} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', margin: '0 40px 20px' }}>
      <div>
        <div className={cols}>
          <Skeleton width={44} height={12} radius={6} />
          <span className={hide.access}><Skeleton width={48} height={12} radius={6} /></span>
          {all && <span className={hide.source}><Skeleton width={52} height={12} radius={6} /></span>}
          <Skeleton width={all ? 64 : 84} height={12} radius={6} />
          <span className={hide.type}><Skeleton width={36} height={12} radius={6} /></span>
          <span />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={rowCols} style={{ height: ROW_HEIGHT, opacity: fade(index) }}>
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
    <div role="status" aria-busy="true" aria-label="Loading trash" className={tableStyles.container} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', margin: '0 40px 20px' }}>
      <div>
        <div className={`${tableStyles.head} ${tableStyles.colsTrash}`}>
          <Skeleton width={44} height={12} radius={6} />
          <Skeleton width={60} height={12} radius={6} />
          <span className={tableStyles.cSize}><Skeleton width={32} height={12} radius={6} /></span>
          <span className={tableStyles.cDeleted}><Skeleton width={56} height={12} radius={6} /></span>
          <span />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={`${tableStyles.row} ${tableStyles.colsTrash}`} style={{ height: ROW_HEIGHT, opacity: fade(index) }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
      <Skeleton width={width} height={18} radius={6} style={{ marginLeft: 8 }} />
      {action && <Skeleton width={64} height={28} radius={8} />}
    </div>
  )
}

function Tiles() {
  return (
    <div className={suggestedStyles.tileGrid}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={suggestedStyles.tile} style={{ alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <Skeleton width={32} height={32} radius={8} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
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
    <div role="status" aria-busy="true" aria-label="Loading suggestions" className={suggestedStyles.page} style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '15px 40px 120px', overflow: 'hidden', minHeight: 0, flex: '1 1 0' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead width={56} action />
        <div className={suggestedStyles.cardGrid} style={{ padding: 3 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={suggestedStyles.card} style={{ padding: 14, gap: 12, alignItems: 'stretch' }}>
              <Skeleton width="70%" height={14} radius={6} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton width={56} height={56} radius={14} />
              </div>
              <Skeleton width="50%" height={12} radius={6} />
            </div>
          ))}
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead width={112} />
        <Tiles />
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead width={76} action />
        <Tiles />
      </section>
    </div>
  )
}

/** Trash header: the "Library > Trash" title and the rule banner. */
export function TrashHeaderSkeleton() {
  return (
    <header aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', padding: '28px 40px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 8px' }}>
        <Skeleton width={72} height={24} radius={8} />
        <Skeleton width={20} height={20} radius={6} />
        <Skeleton width={64} height={24} radius={8} />
      </div>
      <Skeleton height={48} radius={12} style={{ marginTop: 12 }} />
    </header>
  )
}

/** A file page, like the real one: floating pills on a grey canvas, the white page, the info card and the ask pill. */
export function FilePageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading file" className={`${fileStyles.viewer} ${fileStyles.viewerInfo}`}>
      <div className={fileStyles.bar} aria-hidden="true">
        <Skeleton width={240} height={36} radius={12} />
        <span className={fileStyles.end}>
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width={84} height={36} radius={12} />
          <Skeleton width={36} height={36} radius={12} />
          <Skeleton width={36} height={36} radius={12} />
        </span>
      </div>
      <div className={fileStyles.scroll} style={{ overflow: 'hidden' }}>
        <div className={fileStyles.main}>
        <div className={fileStyles.page}>
          <Skeleton width="48%" height={26} radius={8} />
          <Skeleton width={96} height={12} radius={6} style={{ marginTop: 10, marginBottom: 32 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <Skeleton width="55%" height={12} radius={6} style={{ marginTop: 12 }} />
        </div>
        <div className={fileStyles.block} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[60, 40, 70, 70, 45, 35].map((width, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: 12 }}>
              <Skeleton width={56} height={14} radius={6} />
              <Skeleton width={`${width}%`} height={14} radius={6} />
            </div>
          ))}
        </div>
        <div className={fileStyles.block}>
          <Skeleton width={80} height={14} radius={6} />
          <Skeleton width="60%" height={12} radius={6} style={{ marginTop: 12 }} />
        </div>
        <div className={fileStyles.block}>
          <Skeleton width={110} height={14} radius={6} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Skeleton width={28} height={28} radius="50%" />
            <Skeleton width={96} height={14} radius={6} />
          </div>
        </div>
      </aside></div>
      <div className={fileStyles.dock} aria-hidden="true">
        <Skeleton height={52} radius={16} style={{ width: 'min(560px, calc(100% - 48px))' }} />
      </div>
    </div>
  )
}

/** The Library route while it loads: header plus the default (Suggested) view. */
export function LibraryRouteLoading() {
  return (
    <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <LibraryHeaderSkeleton tools={false} />
      <SuggestedSkeleton />
    </div>
  )
}

/** The file route while it loads. */
export function FileRouteLoading() {
  return (
    <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <FilePageSkeleton />
    </div>
  )
}

/** The Trash route while it loads. */
export function TrashRouteLoading() {
  return (
    <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <TrashHeaderSkeleton />
      <TrashTableSkeleton />
    </div>
  )
}
