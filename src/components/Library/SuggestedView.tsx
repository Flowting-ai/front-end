'use client'

import React from 'react'
import Link from 'next/link'
import { AlertCircleIcon, BubbleChatIcon, FolderLibraryIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { activityLine, displayFileName } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { DEFAULT_QUERY, toLibraryHref } from '@/lib/library/query-params'
import type { LibraryFileRow } from '@/lib/library/schemas'
import { isSuggestedEmpty, selectSuggested, tileLine } from '@/lib/library/suggested'
import { useLibraryFlags, useSuggested } from '@/lib/library/queries'
import { CHAT_ROUTE, LIBRARY_FILE_ROUTE, LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { FormatGlyph } from './FormatGlyph'
import { UnreadDot } from './FileMarks'
import { FileDialogs, useFileActions } from './FileDialogs'
import { RowMenu, type RowAction } from './FileTable/RowMenu'
import { LinkButton } from './LinkButton'
import { SuggestedSkeleton } from './LibrarySkeletons'
import styles from './SuggestedView.module.css'

const ALL_FILES = toLibraryHref(LIBRARY_ROUTE, { ...DEFAULT_QUERY, tab: 'all' })
const GENERATED_FILES = toLibraryHref(LIBRARY_ROUTE, { ...DEFAULT_QUERY, tab: 'all', source: ['generated'] })

const sectionTitle: React.CSSProperties = { margin: '0 0 0 8px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <LinkButton href={href} variant="ghost" size="sm" className="bg-transparent" aria-label={`See all ${label}`}>
      See all
    </LinkButton>
  )
}

/** No files at all (Suggested and All files): "No files yet", one line, and a way to start a chat. */
export function NoFilesYet() {
  return (
    <EmptyState icon={<FolderLibraryIcon size={20} />} title={MESSAGES.noFilesYetTitle} text={MESSAGES.noFilesYetText}>
      <LinkButton href={CHAT_ROUTE}>
        <BubbleChatIcon size={14} />
        {MESSAGES.newChat}
      </LinkButton>
    </EmptyState>
  )
}

type MenuProps ={ onAction: (action: RowAction, file: LibraryFileRow) => void; sharingEnabled: boolean }

/** Menu width for cards and tiles: fits the owner-only explanation without cutting it off. */
const MENU_WIDTH = 240

/** A Recent card: the name, a centred type glyph, and one quiet line saying what last happened. Hover shows a "more" menu. */
function RecentCard({ file, onAction, sharingEnabled, first }: { file: LibraryFileRow; first: boolean } & MenuProps) {
  const name = displayFileName(file)
  return (
    <div className={styles.card}>
      <Link href={LIBRARY_FILE_ROUTE(file.id)} title={name} className={`${styles.link} ${styles.cardLink}`}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: 22 }}>
          <span
            className={styles.cardTitle}
            style={{
              flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-body)', fontWeight: file.unread ? 600 : 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)',
            }}
          >
            {name}
          </span>
        </span>
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {file.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.thumbnailUrl} alt="" width={96} height={64} loading="lazy" decoding="async" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 10 }} />
          ) : (
            <FormatGlyph format={file.format} size="lg" />
          )}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{activityLine(file)}</span>
      </Link>
      {file.unread && <span className={styles.cardDot}><UnreadDot /></span>}
      <span className={styles.more}>
        <RowMenu file={file} onAction={onAction} sharingEnabled={sharingEnabled} menuWidth={MENU_WIDTH} placement={first ? "bottom-start" : "bottom-end"} />
      </span>
    </div>
  )
}

/**
 * A compact tile for Frequently used and Generated, as in the prototype: the type glyph, the name, and
 * one quiet line ("Opened 4 times", "Run of Weekly sales report"). No sparkle: the row says Generated.
 */
function FileTile({ file, row, onAction, sharingEnabled }: { file: LibraryFileRow; row: 'frequent' | 'generated' } & MenuProps) {
  const name = displayFileName(file)
  const meta = tileLine(row, file, activityLine(file))
  return (
    <div className={styles.tile}>
      <Link href={LIBRARY_FILE_ROUTE(file.id)} title={name} className={`${styles.link} ${styles.tileLink}`}>
        <FormatGlyph format={file.format} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 24 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)' }}>{name}</span>
          {meta && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{meta}</span>}
        </span>
      </Link>
      <span className={styles.more}>
        <RowMenu file={file} onAction={onAction} sharingEnabled={sharingEnabled} menuWidth={MENU_WIDTH} />
      </span>
    </div>
  )
}

/** Suggested: Recent (one row of cards), then Frequently used and Generated tiles. Empty rows are hidden. */
export function SuggestedView() {
  const suggested = useSuggested()
  const flags = useLibraryFlags()
  const { dialog, closeDialog, handle } = useFileActions()
  const menu: MenuProps = { onAction: handle, sharingEnabled: flags.data?.sharing !== false }

  if (suggested.isPending) return <SuggestedSkeleton />
  if (suggested.isError || !suggested.data) {
    return (
      <EmptyState icon={<AlertCircleIcon size={20} />} title={MESSAGES.listError}>
        <Button variant="secondary" onClick={() => void suggested.refetch()}>{MESSAGES.retry}</Button>
      </EmptyState>
    )
  }
  const view = selectSuggested(suggested.data)
  if (isSuggestedEmpty(view)) {
    return (
      <NoFilesYet />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '15px 40px 120px', overflowY: 'auto', overflowX: 'hidden', minHeight: 0, flex: '1 1 0' }} className={`kaya-scrollbar ${styles.page}`}>
      {view.recent.length > 0 && (
        <section aria-labelledby="suggested-recent" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
            <h2 id="suggested-recent" style={sectionTitle}>Recent</h2>
            <SeeAll href={ALL_FILES} label="files" />
          </div>
          <div className={styles.cardGrid} style={{ padding: 3 }}>
            {view.recent.map((file, index) => (
              <RecentCard key={file.id} file={file} first={index < 2} {...menu} />
            ))}
          </div>
        </section>
      )}
      {view.frequent.length > 0 && (
        <section aria-labelledby="suggested-frequent" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 32 }}>
            <h2 id="suggested-frequent" style={sectionTitle}>Frequently used</h2>
          </div>
          <div className={styles.tileGrid}>
            {view.frequent.slice(0, 3).map((file) => (
              <FileTile key={file.id} file={file} row="frequent" {...menu} />
            ))}
          </div>
        </section>
      )}
      {view.generated.length > 0 && (
        <section aria-labelledby="suggested-generated" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
            <h2 id="suggested-generated" style={sectionTitle}>Generated</h2>
            <SeeAll href={GENERATED_FILES} label="generated files" />
          </div>
          <div className={styles.tileGrid}>
            {view.generated.slice(0, 3).map((file) => (
              <FileTile key={file.id} file={file} row="generated" {...menu} />
            ))}
          </div>
        </section>
      )}
      <FileDialogs dialog={dialog} onClose={closeDialog} />
    </div>
  )
}
