'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { CancelOneIcon, DeleteTwoIcon } from '@strange-huge/icons'
import { ShieldCheck } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { Skeleton } from '@/components/Skeleton'
import Tabs from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { storageLabel } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { MIN_SEARCH_LENGTH, effectiveListTab, tabPatch, type LibraryQuery, type LibraryTab, type SearchScope } from '@/lib/library/query-params'
import { useHasShared, useLibraryPrefs, useStorage } from '@/lib/library/queries'
import { readSeen, shouldShowSettingsNotice, unseenChanges, writeSeen } from '@/lib/library/settings-notice'
import type { SetLibraryQuery } from '@/lib/library/use-library-query'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_TRASH_ROUTE } from '@/lib/routes'
import { LIBRARY_SETTINGS_SEEN_KEY } from '@/lib/storage-keys'
import { UnreadDot } from './FileMarks'
import { FilterPanel } from './FilterPanel'
import { LibrarySearch } from './LibrarySearch'
import { SAMPLE_DATA_TOGGLE_ENABLED, SampleDataToggle } from './SampleDataToggle'
import { SortMenu } from './SortMenu'
import styles from './LibraryHeader.module.css'

/**
 * "1.93 GB used" beside the title, on every tab, while searching and in every list state. It never
 * blocks the page: a placeholder while it first loads, and the last known value stays if a later
 * refetch fails (React Query keeps `data`). Only a first load that fails shows nothing.
 */
export function StorageLabel() {
  const storage = useStorage()
  if (storage.data) {
    return (
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
        {storageLabel(storage.data.usedBytes, storage.data.limitBytes)}
      </span>
    )
  }
  if (storage.isError) return null
  return <Skeleton width={84} height={14} radius={6} />
}

/** For members: "Your Admin changed Library settings" and what changed, until dismissed (prototype). */
function SettingsChangedNotice() {
  const { isAdmin } = useLibraryViewer()
  const prefs = useLibraryPrefs()
  // Read on the client only: prefs never load during the server render, so this cannot mismatch.
  const [seenAt, setSeenAt] = useState<string | null>(() => (typeof window === 'undefined' ? null : readSeen(LIBRARY_SETTINGS_SEEN_KEY)))
  const data = prefs.data
  if (isAdmin || !data || !shouldShowSettingsNotice(data.settingsChangedAt, seenAt)) return null
  const lines = unseenChanges(data.settingsChanges, seenAt)
  const dismiss = () => {
    const now = new Date().toISOString()
    writeSeen(LIBRARY_SETTINGS_SEEN_KEY, now)
    setSeenAt(now)
  }
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, margin: '20px 8px 0', padding: '16px 16px 16px 18px', borderRadius: 16,
        border: '1px solid var(--border-default)', background: 'var(--card-bg)',
      }}
    >
      <ShieldCheck size={20} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--neutral-600)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>{MESSAGES.settingsNoticeTitle}</h3>
        {lines.length > 0 && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>
            {lines.map((line) => <li key={line.key}>{line.text}</li>)}
          </ul>
        )}
      </div>
      <IconButton variant="ghost" size="sm" aria-label="Dismiss" icon={<CancelOneIcon size={14} />} onClick={dismiss} />
    </div>
  )
}

/** The Trash screen is a button at the far right of the header, not a tab. */
export function TrashLink() {
  return (
    <Tooltip content="Trash" side="bottom">
      <Link href={LIBRARY_TRASH_ROUTE} aria-label="Trash" className={styles.trash}>
        <DeleteTwoIcon size={20} />
      </Link>
    </Tooltip>
  )
}

const SCOPE_TAB_LABEL = { suggested: 'All files', all: 'All files', shared: 'Shared' } as const

/** While searching: "In All files" or "All of Library". */
function ScopeToggle({ query, setQuery }: { query: LibraryQuery; setQuery: SetLibraryQuery }) {
  const choose = (scope: SearchScope) => setQuery({ scope })
  return (
    <div role="group" aria-label="Search scope" className={styles.scope}>
      <button type="button" aria-pressed={query.scope === 'tab'} onClick={() => choose('tab')}>In {SCOPE_TAB_LABEL[query.tab]}</button>
      <button type="button" aria-pressed={query.scope === 'all'} onClick={() => choose('all')}>All of Library</button>
    </div>
  )
}

export interface LibraryHeaderProps {
  query: LibraryQuery
  setQuery: SetLibraryQuery
}

/**
 * Laid out like the prototype: the title and storage on the left and the tools (Filter, Sort, Search,
 * Trash) on the same row at the right; tabs underneath, or the search scope while searching.
 */
export function LibraryHeader({ query, setQuery }: LibraryHeaderProps) {
  const { hasShared, hasUnread } = useHasShared()
  // Shared appears only once something is shared with the person; stay visible while it is the open tab so the strip never loses the active item.
  const showShared = hasShared || query.tab === 'shared'
  const listTab = effectiveListTab(query)
  const searching = query.q.length >= MIN_SEARCH_LENGTH
  const showListTools = !searching && query.tab !== 'suggested'
  return (
    <header style={{ display: 'flex', flexDirection: 'column', padding: '28px 40px 13px', flexShrink: 0 }}>
      {/* In a narrow window the tools wrap under the title, right-aligned, instead of pushing the page sideways. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, rowGap: 8, minHeight: 36, padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 'none' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '36px', color: 'var(--neutral-900)' }}>{searching ? 'Search' : MESSAGES.title}</h1>
          <StorageLabel />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, rowGap: 8, marginLeft: 'auto', minWidth: 0 }}>
          {showListTools && <FilterPanel query={query} setQuery={setQuery} />}
          {showListTools && <SortMenu query={query} setQuery={setQuery} tab={listTab} />}
          {/* Search and Trash stay side by side on one line (the dev-only switch sits just left of search). */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 8, minWidth: 0 }}>
            {SAMPLE_DATA_TOGGLE_ENABLED && <SampleDataToggle />}
            <LibrarySearch query={query} setQuery={setQuery} />
            <TrashLink />
          </div>
        </div>
      </div>
      <SettingsChangedNotice />
      {searching ? (
        <ScopeToggle query={query} setQuery={setQuery} />
      ) : (
        <div style={{ marginTop: 24 }}>
          <Tabs value={query.tab} onValueChange={(value) => setQuery((current) => tabPatch(current, value as LibraryTab), 'push')}>
            <Tabs.List>
              <Tabs.Trigger value="suggested">Suggested</Tabs.Trigger>
              <Tabs.Trigger value="all">All files</Tabs.Trigger>
              {showShared && (
                <Tabs.Trigger value="shared">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Shared
                    {hasUnread && <UnreadDot />}
                  </span>
                </Tabs.Trigger>
              )}
            </Tabs.List>
          </Tabs>
        </div>
      )}
    </header>
  )
}
