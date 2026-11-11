'use client'

import React, { useEffect } from 'react'
import { trackLibrary } from '@/lib/library/analytics'
import { isSearching } from '@/lib/library/query-params'
import { useHasShared } from '@/lib/library/queries'
import { useLibraryQuery } from '@/lib/library/use-library-query'
import { FilesView } from './FilesView'
import { LibraryHeader } from './LibraryHeader'
import { LibraryShell } from './LibraryShell'
import { SuggestedView } from './SuggestedView'

/**
 * The Library page: header (title, storage, search, filter, sort, Trash), the Suggested / All files /
 * Shared tabs, and the list. All view state is in the URL (useLibraryQuery); all data is React Query.
 */
export function LibraryScreen() {
  const { query, setQuery, isPending } = useLibraryQuery()
  const { hasShared, isSuccess: sharedChecked } = useHasShared()

  // Landing on Shared when nothing is shared (an old link) falls back to All files. Only a check that
  // succeeded counts: a failed one (network, 5xx) leaves the person where they are.
  const redirectToAll = query.tab === 'shared' && sharedChecked && !hasShared
  useEffect(() => {
    if (redirectToAll) setQuery({ tab: 'all' }, 'replace')
  }, [redirectToAll, setQuery])

  useEffect(() => {
    trackLibrary('open_tab', { tab: query.tab })
  }, [query.tab])

  const showSuggested = query.tab === 'suggested' && !isSearching(query)

  return (
    <LibraryShell>
      <LibraryHeader query={query} setQuery={setQuery} />
      {showSuggested ? <SuggestedView /> : <FilesView query={query} setQuery={setQuery} isPending={isPending} />}
    </LibraryShell>
  )
}
