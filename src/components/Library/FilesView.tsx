'use client'

import React, { useEffect, useRef } from 'react'
import { AlertCircleIcon, FilterMailIcon, SearchOneIcon } from '@strange-huge/icons'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { lengthBucket, resultBucket, trackLibrary } from '@/lib/library/analytics'
import { MESSAGES } from '@/lib/library/messages'
import { appliedFilterCount, chosenSort, effectiveListTab, isSearching, toLibraryHref, toggleSortPatch, type LibraryQuery } from '@/lib/library/query-params'
import { useLibraryFiles, useLibraryFlags } from '@/lib/library/queries'
import type { SetLibraryQuery } from '@/lib/library/use-library-query'
import { useLibraryViewer } from '@/lib/library/viewer'
import { LIBRARY_ROUTE } from '@/lib/routes'
import { EmptyState } from './EmptyState'
import { FileDialogs, useFileActions } from './FileDialogs'
import { FileTable } from './FileTable/FileTable'
import { FileTableSkeleton } from './LibrarySkeletons'
import { NoFilesYet } from './SuggestedView'

const visuallyHidden: React.CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }

/** All files and Shared, and search results: loading, error, empty and ready are all explicit states. */
export function FilesView({ query, setQuery, isPending }: { query: LibraryQuery; setQuery: SetLibraryQuery; isPending: boolean }) {
  const { viewerId, orgKey } = useLibraryViewer()
  const list = useLibraryFiles(query)
  const flags = useLibraryFlags()
  const { dialog, closeDialog, handle } = useFileActions()
  const tab = effectiveListTab(query)
  const searching = isSearching(query)
  const filtered = appliedFilterCount(query) > 0
  const viewKey = `${orgKey}|${toLibraryHref(LIBRARY_ROUTE, query)}`

  // One search event per settled search: length class and result bucket, never the text.
  const reported = useRef('')
  useEffect(() => {
    if (!searching || list.status !== 'ready' || list.isRefreshing) return
    const signature = `${query.q}|${query.scope}|${list.files.length}`
    if (reported.current === signature) return
    reported.current = signature
    trackLibrary('search', { scope: query.scope, value: `${lengthBucket(query.q.length)}:${resultBucket(list.files.length)}` })
  }, [searching, list.status, list.isRefreshing, list.files.length, query.q, query.scope])

  if (list.status === 'loading') return <FileTableSkeleton kind={tab === 'shared' ? 'shared' : 'all'} />

  if (list.status === 'error') {
    return (
      <EmptyState
        icon={<AlertCircleIcon size={20} />}
        title={searching ? MESSAGES.searchUnavailableTitle : MESSAGES.listError}
        text={searching ? MESSAGES.searchUnavailableText : undefined}
      >
        <Button variant="secondary" onClick={list.refetch}>{MESSAGES.retry}</Button>
      </EmptyState>
    )
  }

  if (list.files.length === 0) {
    // Search ignores the filters, so a search miss only offers to clear the search.
    if (searching) {
      return (
        <EmptyState icon={<SearchOneIcon size={20} />} title={MESSAGES.noMatchTitle} text={MESSAGES.searchNoMatchText}>
          <Button variant="secondary" onClick={() => setQuery({ q: '', scope: 'tab' })}>{MESSAGES.clearSearch}</Button>
        </EmptyState>
      )
    }
    if (filtered) {
      return (
        <EmptyState icon={<FilterMailIcon size={20} />} title={MESSAGES.noMatchTitle}>
          <Button variant="secondary" onClick={() => setQuery({ source: [], type: [] })}>{MESSAGES.resetFilters}</Button>
        </EmptyState>
      )
    }
    if (tab === 'shared') return <EmptyState icon={<Users size={20} strokeWidth={1.5} aria-hidden />} title={MESSAGES.sharedEmptyTitle} />
    return <NoFilesYet />
  }

  return (
    <>
      {/* Announces the result count after a search or filter change. */}
      <p role="status" style={visuallyHidden}>
        {searching ? `${list.files.length}${list.hasNextPage ? ' or more' : ''} results` : ''}
      </p>
      <FileTable
        files={list.files}
        kind={tab}
        viewerId={viewerId}
        viewKey={viewKey}
        sort={chosenSort(query)}
        onSort={(key) => setQuery((current) => toggleSortPatch(current, key))}
        onAction={handle}
        sharingEnabled={flags.data?.sharing !== false}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        isRefreshing={list.isRefreshing || isPending}
        label={searching ? 'Search results' : tab === 'shared' ? 'Shared files' : 'All files'}
      />
      <FileDialogs dialog={dialog} onClose={closeDialog} />
    </>
  )
}
