'use client'

// The catalogue: Discover / All / Connected / Not connected, search, sort, category and paging.

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectorCatalogCard } from '@/components/ConnectorCatalogCard'
import { Pagination } from '@/components/ConnectorBrowse'
import { type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog } from '@/lib/api/connectors'

import {
  AVAILABLE_PAGE_SIZE,
  cachedPage,
  fetchBrowsePage,
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

export function Catalog({
  catalog, query, select, onRows, pendingSlug,
}: {
  catalog: ConnectorCatalog[]
  query: string
  select: (summary: ConnectorCatalog | ConnectorPick) => void
  onRows?: (rows: ConnectorCatalog[]) => void
  pendingSlug?: string | null
}) {
  // A deep-linked search lands on All — Discover would hide most matches.
  const [view, setView] = useState<CatalogView>(query ? 'all' : 'discover')
  const picks = useConnectorPicks()
  const catalogCategories = useConnectorCategories()
  const [category, setCategory] = useState('')
  const linkedRows = catalog.filter(row => row.linked || row.connections.length > 0)
  const theirCategories = [...linkedRows, ...picks.sure, ...picks.maybe].map(row => row.categories)
  // Without GET /connectors/categories, the categories of the apps on screen.
  const categories = rankCategories(catalogCategories ?? [...new Set(theirCategories.flat())], theirCategories)
  const [ownQuery, setOwnQuery] = useState(query)
  // `query` (the `initialSearch` deep-link, e.g. /connectors?q=slack from a
  // quick action) only seeds `ownQuery` once with a plain useState — a real
  // gap if a second quick-action link changes `query` while this component
  // stays mounted (a client-side navigation to /connectors?q=zoom while
  // already on /connectors), since the search box would silently keep
  // showing the old term. Re-adopt `query` during render whenever it
  // actually changes, same "adjust state when a prop changes" pattern as
  // AccountName's nickname sync in AccountDetailView.tsx.
  const [syncedQuery, setSyncedQuery] = useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setOwnQuery(query)
    if (query) setView('all')
  }
  const [sort, setSort] = useState<SortMode>('name-asc')
  const [page, setPage] = useState(1)
  const cursorsRef = useRef<(string | undefined)[]>([undefined])
  const [browseItems, setBrowseItems] = useState<ConnectorCatalog[]>([])
  const [browseHasMore, setBrowseHasMore] = useState(false)
  const [browseBusy, setBrowseBusy] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim())
  const sectionRef = useRef<HTMLElement>(null)
  const lastPageRef = useRef(1)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(ownQuery.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [ownQuery])

  // Was a `useEffect(() => { setPage(1); cursorsRef.current = [undefined] },
  // [debouncedQuery, view])` — the `setPage(1)` half is a pure "reset
  // pagination when the search term or tab changes" adjustment, not a
  // subscription to anything external, so it converts to React's documented
  // "adjust state when a prop/dependency changes" render-time pattern (no
  // effect needed; self-terminating once paginationKey === syncedPaginationKey).
  // The ref reset can't move into that same render-time block — React
  // disallows writing a ref's `.current` during render (`react-hooks/refs`) —
  // so it stays in a small dedicated effect below, keyed on the same value.
  const paginationKey = `${view}::${debouncedQuery}::${category}`
  const [syncedPaginationKey, setSyncedPaginationKey] = useState(paginationKey)
  if (paginationKey !== syncedPaginationKey) {
    setSyncedPaginationKey(paginationKey)
    setPage(1)
  }
  useEffect(() => {
    cursorsRef.current = [undefined]
  }, [paginationKey])

  // Same technique for the "nothing to browse-fetch" case (Recommended, or
  // Connected with no search term — those rows come from the picks and
  // `linkedRows` below, not `browseItems`): the reset itself is derivable
  // from the current view/query, not a side effect, so it moves out of the
  // fetch effect below instead of being its unconditional first branch.
  const skipBrowse = view === 'discover' || (view === 'connected' && !debouncedQuery)
  const [syncedSkipBrowse, setSyncedSkipBrowse] = useState(skipBrowse)
  if (skipBrowse !== syncedSkipBrowse) {
    setSyncedSkipBrowse(skipBrowse)
    if (skipBrowse) {
      setBrowseItems([])
      setBrowseHasMore(false)
      setBrowseBusy(false)
    }
  }

  useEffect(() => {
    if (skipBrowse) return
    let cancelled = false
    const cursor = cursorsRef.current[page - 1]
    const hit = cachedPage(debouncedQuery, category, cursor)
    // Not cached: show the loading skeleton until it arrives. Cached: no flash, apply right away.
    if (!hit) setBrowseBusy(true)
    const request = hit ? Promise.resolve(hit) : fetchBrowsePage(debouncedQuery, category, cursor)
    void request
      .then(result => {
        if (cancelled) return
        setBrowseItems(result.connectors)
        setBrowseHasMore(result.hasMore)
        onRows?.(result.connectors)
        if (result.nextCursor) {
          cursorsRef.current[page] = result.nextCursor
          // Warm the next page so clicking Next is instant.
          if (result.hasMore) void fetchBrowsePage(debouncedQuery, category, result.nextCursor).catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBrowseItems([])
          setBrowseHasMore(false)
        }
      })
      .finally(() => {
        if (!cancelled) setBrowseBusy(false)
      })
    return () => { cancelled = true }
  }, [skipBrowse, debouncedQuery, category, view, page, onRows])

  // Changing page keeps the scroll position, so the new connectors landed off-screen: bring the top of
  // the list back into view.
  useEffect(() => {
    if (lastPageRef.current !== page) sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    lastPageRef.current = page
  }, [page])

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
  const loadingPage = browseBusy && !skipBrowse
  const empty = !browseBusy && connectedItems.length === 0 && availableItems.length === 0

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
    if (value.trim() && view === 'discover') setView('all')
  }
  // View, category and sort switches re-render a full grid of cards; as
  // transitions they don't block the click or typing that caused them.
  const [, startTransition] = useTransition()
  const switchView = (next: CatalogView) => startTransition(() => setView(next))
  const switchCategory = (next: string) => startTransition(() => setCategory(next))
  const switchSort = (next: SortMode) => startTransition(() => setSort(next))
  const viewCategory = (value: string) => {
    startTransition(() => {
      setCategory(value)
      setView('all')
    })
  }
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
                <Pagination page={page} hasMore={browseHasMore} onChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

