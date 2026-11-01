'use client'

// The catalogue: Discover / All / Connected / Not connected, search, sort, category and paging.

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ConnectorCatalogCard } from '@/components/ConnectorCatalogCard'
import { Pagination } from '@/components/ConnectorBrowse'
import { type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog, listConnectors } from '@/lib/api/connectors'
import { queryKeys } from '@/lib/query-keys'

import {
  AVAILABLE_PAGE_SIZE,
  browseQuery,
  PAGE_TTL_MS,
  SPACE,
  muted,
  type CatalogView,
  type SortMode,
  CatalogToolbar,
  CATALOG_GRID,
  CatalogSectionLabel,
  CatalogCell,
  PickSection,
} from './connections-shared'
import {
  DISCOVER_CATEGORY_COUNT,
  inCategory,
  CategorySection,
  rankCategories,
  useConnectorPicks,
  useConnectorCategories,
} from './CatalogDiscover'

const VIEWS: readonly CatalogView[] = ['discover', 'all', 'connected', 'not-connected']
const SORTS: readonly SortMode[] = ['name-asc', 'name-desc']

/** How many pages past the loaded ones a URL ?page= may walk to before falling back to page 1. */
const MAX_PAGE_WALK = 20

/**
 * Shallow URL update (history.replaceState, which Next's useSearchParams follows) for the catalogue's
 * own keys: no navigation, no server round-trip, no scroll. Other params (open, connector…) are kept.
 */
function writeCatalogParams(patch: Record<string, string | null>) {
  const url = new URL(window.location.href)
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (!value) {
      if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true }
    } else if (url.searchParams.get(key) !== value) {
      url.searchParams.set(key, value)
      changed = true
    }
  }
  if (changed) window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * View, category, sort, page and search live in the URL (?view=&category=&sort=&page=&q=), so they
 * survive back/forward and deep links (e.g. /connectors?q=slack from a quick action).
 */
export function Catalog({
  catalog, select, onRows, pendingSlug,
}: {
  catalog: ConnectorCatalog[]
  /** The deep-linked search. Unused now: the catalogue reads `q` from the URL itself. */
  query?: string
  select: (summary: ConnectorCatalog | ConnectorPick) => void
  onRows?: (rows: ConnectorCatalog[]) => void
  pendingSlug?: string | null
}) {
  const searchParams = useSearchParams()
  const debouncedQuery = (searchParams.get('q') ?? '').trim()
  const rawView = searchParams.get('view') as CatalogView | null
  // A deep-linked search lands on All — Discover would hide most matches.
  const view: CatalogView = rawView && VIEWS.includes(rawView) ? rawView : debouncedQuery ? 'all' : 'discover'
  const category = searchParams.get('category') ?? ''
  const rawSort = searchParams.get('sort') as SortMode | null
  const sort: SortMode = rawSort && SORTS.includes(rawSort) ? rawSort : 'name-asc'
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const picks = useConnectorPicks()
  const catalogCategories = useConnectorCategories()
  const linkedRows = catalog.filter(row => row.linked || row.connections.length > 0)
  const theirCategories = [...linkedRows, ...picks.sure, ...picks.maybe].map(row => row.categories)
  // Without GET /connectors/categories, the categories of the apps on screen.
  const categories = rankCategories(catalogCategories ?? [...new Set(theirCategories.flat())], theirCategories)
  // The search box types ahead of the URL (which follows 300ms later). When `q` changes from outside
  // (back/forward, a second quick-action link), the box adopts it.
  const [ownQuery, setOwnQuery] = useState(debouncedQuery)
  const [seenUrlQuery, setSeenUrlQuery] = useState(debouncedQuery)
  if (debouncedQuery !== seenUrlQuery) {
    setSeenUrlQuery(debouncedQuery)
    if (ownQuery.trim() !== debouncedQuery) setOwnQuery(debouncedQuery)
  }
  const sectionRef = useRef<HTMLElement>(null)

  // Typing settles into the URL; a new search starts again at page 1.
  useEffect(() => {
    const next = ownQuery.trim()
    if (next === debouncedQuery) return
    const handle = window.setTimeout(() => writeCatalogParams({ q: next || null, page: null }), 300)
    return () => window.clearTimeout(handle)
  }, [ownQuery, debouncedQuery])

  // Recommended, and Connected with no search term, show rows from the picks and `linkedRows` below,
  // so nothing is browse-fetched for them.
  const skipBrowse = view === 'discover' || (view === 'connected' && !debouncedQuery)

  // The browse pages for one search/category, as one infinite query: pages[n] is page n + 1, and each
  // page's nextCursor reaches the one after it. Pages seen before come from the cache (Previous is
  // instant); a connect or disconnect invalidates them (bustConnectorCatalogCache, ["connectors"]).
  // View and sort are not in the key: neither changes the request (both filter/sort on screen).
  const browse = useInfiniteQuery({
    queryKey: queryKeys.connectors.catalog({ q: debouncedQuery, category }),
    queryFn: ({ pageParam }) => listConnectors(browseQuery(debouncedQuery, category, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    enabled: !skipBrowse,
    staleTime: PAGE_TTL_MS,
  })
  const loadedPages = browse.data?.pages.length ?? 0
  const currentPage = skipBrowse ? undefined : browse.data?.pages[page - 1]
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = browse
  const browseSettled = browse.isSuccess || browse.isError

  // Reach the page in the URL: fetch it when it is the next one, warm the one after the current page
  // (so Next is instant), and fall back to page 1 when the URL names a page no cursor reaches.
  useEffect(() => {
    if (skipBrowse || !browseSettled || isFetchingNextPage || browse.isFetchNextPageError) return
    if (page <= loadedPages - 1) return
    // A deeper page (a reload on ?page=3) is reached by walking the cursors one page at a time, up to a cap.
    if (hasNextPage && page <= loadedPages + MAX_PAGE_WALK) void fetchNextPage()
    else if (page > loadedPages) writeCatalogParams({ page: null })
  }, [skipBrowse, browseSettled, isFetchingNextPage, browse.isFetchNextPageError, page, loadedPages, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (currentPage) onRows?.(currentPage.connectors)
  }, [currentPage, onRows])

  const browseFailed = browse.isError && (!browse.data || browse.isFetchNextPageError)
  const browseItems = currentPage?.connectors ?? []
  const browseHasMore = currentPage?.hasMore ?? false

  // Changing page keeps the scroll position, so the new connectors landed off-screen: bring the top of
  // the list back into view.
  const changePage = (next: number) => {
    writeCatalogParams({ page: next > 1 ? String(next) : null })
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const byName = (a: { name: string }, b: { name: string }) =>
    sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  const filed = (row: { categories: string[] }) => inCategory(row.categories, category)

  const searching = Boolean(debouncedQuery)
  const source = (searching || view !== 'connected' ? browseItems : linkedRows).filter(filed)
  const pool = source.filter(summary => {
    const connected = summary.connections.length > 0 || summary.linked
    if (view === 'connected' && !connected) return false
    if (view === 'not-connected' && connected) return false
    return true
  })
  const sorted = [...pool].sort(byName)
  // The default "All" view's `pool` (unlike search results) is fetched with
  // `linked: false`, so it structurally never contains connected rows —
  // `sorted.filter(...connected)` would always be empty there. `linkedRows`
  // (from the full `catalog` prop, not `pool`) is the only source with them
  // in that branch, so it needs its own sort rather than reusing `sorted`.
  const connectedItems = searching
    ? sorted.filter(summary => summary.connections.length > 0 || summary.linked)
    : view === 'all' ? linkedRows.filter(filed).sort(byName)
    : view === 'connected' ? sorted : []
  const availableItems = view === 'connected' && !searching
    ? []
    : sorted.filter(summary => summary.connections.length === 0 && !summary.linked)
  const showConnectedLabel = connectedItems.length > 0 && availableItems.length > 0
  const loadingPage = !skipBrowse && !currentPage && !browseFailed
  const empty = !loadingPage && connectedItems.length === 0 && availableItems.length === 0

  const connectedSlugs = new Set(linkedRows.map(row => row.slug))
  const needle = debouncedQuery.toLowerCase()
  const worthShowing = (pick: ConnectorPick) =>
    !connectedSlugs.has(pick.slug) && filed(pick) && pick.name.toLowerCase().includes(needle)
  const sure = picks.sure.filter(worthShowing).sort(byName)
  const sureSlugs = new Set(sure.map(pick => pick.slug))
  const maybe = picks.maybe.filter(pick => worthShowing(pick) && !sureSlugs.has(pick.slug)).sort(byName)

  // Discover is for browsing; typing a search moves to All's results.
  const changeQuery = (value: string) => {
    setOwnQuery(value)
    if (value.trim() && view === 'discover') writeCatalogParams({ view: 'all', page: null })
  }
  const switchView = (next: CatalogView) => writeCatalogParams({ view: next, page: null })
  const switchCategory = (next: string) => writeCatalogParams({ category: next || null, page: null })
  const switchSort = (next: SortMode) => writeCatalogParams({ sort: next === 'name-asc' ? null : next })
  const viewCategory = (value: string) => writeCatalogParams({ category: value || null, view: 'all', page: null })
  const discoverSections = category ? [category] : categories.slice(0, DISCOVER_CATEGORY_COUNT)

  const toolbar = (
    <CatalogToolbar
      view={view} changeView={switchView}
      query={ownQuery} setQuery={changeQuery}
      sort={sort} setSort={switchSort}
      categories={categories} category={category} setCategory={switchCategory}
    />
  )

  if (view === 'discover') {
    const nothing = !picks.loading && sure.length + maybe.length === 0 && discoverSections.length === 0
    return (
      <section id="all-connectors">
        {toolbar}
        {picks.loading ? (
          <div aria-hidden style={{ ...CATALOG_GRID, marginBottom: SPACE.section }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <ConnectorCatalogCard key={i} name={`connector ${i + 1}`} density="detailed" state="loading" />
            ))}
          </div>
        ) : (
          <>
            <PickSection label="Detected in your workspace" sub="Apps your Slack workspace already uses" picks={sure} select={select} pendingSlug={pendingSlug} category={category} />
            <PickSection label="Suggested for you" sub="Apps your work points to" picks={maybe} select={select} pendingSlug={pendingSlug} category={category} />
          </>
        )}
        {discoverSections.map(name => (
          <CategorySection
            key={name}
            category={name}
            connectedSlugs={connectedSlugs}
            select={select}
            pendingSlug={pendingSlug}
            onRows={onRows}
            viewAll={() => viewCategory(name)}
          />
        ))}
        {nothing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.lg, padding: SPACE.section }}>
            <p style={{ ...muted, textAlign: 'center' }}>Nothing to recommend yet. Recommendations appear as Souvenir learns how you work.</p>
            <Button variant="outline" size="sm" onClick={() => switchView('all')}>Browse all connectors</Button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section id="all-connectors" ref={sectionRef}>
      {toolbar}
      {empty ? (
        <p style={{ ...muted, padding: SPACE.section, textAlign: 'center' }}>No connectors found.</p>
      ) : (
        <div style={{ marginBottom: SPACE.xxl }}>
          {connectedItems.length > 0 && (
            <div style={{ marginBottom: availableItems.length > 0 ? SPACE.xxl : 0 }}>
              {showConnectedLabel && <CatalogSectionLabel label="Connected" />}
              <div style={CATALOG_GRID}>
                {connectedItems.map(summary => <CatalogCell key={summary.slug} summary={summary} select={select} highlight={debouncedQuery} pendingSlug={pendingSlug} category={category} />)}
              </div>
            </div>
          )}
          {(availableItems.length > 0 || loadingPage) && (
            <div>
              {showConnectedLabel && <CatalogSectionLabel label={category ? `All ${category}` : 'All connectors'} />}
              {loadingPage ? (
                <div aria-busy aria-label="Loading connectors" style={CATALOG_GRID}>
                  {Array.from({ length: AVAILABLE_PAGE_SIZE }).map((_, i) => (
                    <ConnectorCatalogCard key={i} name={`connector ${i + 1}`} density="detailed" state="loading" />
                  ))}
                </div>
              ) : (
                <div style={CATALOG_GRID}>
                  {availableItems.map(summary => <CatalogCell key={summary.slug} summary={summary} select={select} highlight={debouncedQuery} pendingSlug={pendingSlug} category={category} />)}
                </div>
              )}
              {/* Locked while a page is loading, so a double-click cannot skip a page. */}
              <div style={{ marginTop: SPACE.xl, pointerEvents: loadingPage ? 'none' : undefined, opacity: loadingPage ? 0.6 : 1 }}>
                <Pagination page={page} hasMore={browseHasMore} onChange={changePage} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

