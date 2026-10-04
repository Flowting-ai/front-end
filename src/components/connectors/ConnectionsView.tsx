'use client'

// Connections view — covers S1 (empty), S2 (catalog), S3/S17 (connections),
// S14 (reconnect banner). Ported 1:1 from
// may-day-final/src/stories/teams/ConnectorLibraryV1.stories.tsx, wired to
// real data via ConnectorCatalog instead of the story's static mocks.
// See docs v1.5/connectors-v1.5-migration-plan.md §2/§3.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownOneIcon,
  ArrowUpDownIcon,
  SearchOneIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ConnectorCatalogCard, type ConnectorCatalogCardState } from '@/components/ConnectorCatalogCard'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Pagination } from '@/components/ConnectorBrowse'
import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/Tabs'
import { fetchRecommendations, type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog, getConnector, listConnectorCategories, listConnectors } from '@/lib/api/connectors'

const AVAILABLE_PAGE_SIZE = 10

// Catalogue pages, cached by (search term, category, cursor). Each page request takes seconds on a cold backend,
// and the list used to sit on the OLD page the whole time, so Next/Previous looked dead. Pages are now
// served from this cache when seen before (Previous is instant), and the page after the current one is
// prefetched in the background (Next is usually instant). Entries expire so connect/disconnect state
// does not go stale for long.
const PAGE_TTL_MS = 60_000
type BrowsePage = Awaited<ReturnType<typeof listConnectors>>
const pageCache = new Map<string, { at: number; page: BrowsePage }>()
const pageKey = (q: string, category: string, cursor: string | undefined) => `${q}::${category}::${cursor ?? ''}`
function cachedPage(q: string, category: string, cursor: string | undefined): BrowsePage | null {
  const hit = pageCache.get(pageKey(q, category, cursor))
  return hit && Date.now() - hit.at < PAGE_TTL_MS ? hit.page : null
}
async function fetchBrowsePage(q: string, category: string, cursor: string | undefined): Promise<BrowsePage> {
  const hit = cachedPage(q, category, cursor)
  if (hit) return hit
  const page = await listConnectors({
    q: q || category,
    category,
    linked: q ? undefined : false,
    cursor,
    limit: AVAILABLE_PAGE_SIZE,
  })
  pageCache.set(pageKey(q, category, cursor), { at: Date.now(), page })
  return page
}

const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const

const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 32, fontWeight: 400, lineHeight: 1.2 }
const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--neutral-white)', boxShadow: '0 0 0 1px var(--neutral-100)' }

// The page itself is the one scroll region — fills the real height its
// AppLayout ancestor already gives it (a bounded flex column, see
// src/components/layout/AppLayout.tsx's `flex: "1 0 0"` content wrapper), the
// same `height: '100%' + overflowY: 'auto'` pattern the old settings page's
// own PageShell used. A second, independently-sized scroll box nested inside
// this (an earlier version of this file had one, guessed at `calc(100vh -
// 360px)`) has no relation to the ancestor's real height and just leaves an
// arbitrary gap — one scroll region, correctly sized, is simpler and correct.
export function ConnectorsShell({ children, maxWidth = 1040 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <main
      className="kaya-scrollbar"
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehaviorY: 'contain',
        boxSizing: 'border-box',
        padding: 'clamp(28px, 5vw, 48px) clamp(20px, 4vw, 40px) 72px',
        background: 'var(--neutral-50)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ width: '100%', maxWidth, margin: '0 auto' }}>{children}</div>
    </main>
  )
}

function Header({ title, subtitle, tools }: { title: string; subtitle?: string; tools?: React.ReactNode }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACE.xl, marginBottom: SPACE.section }}>
      <div style={{ minWidth: 240 }}>
        <h1 style={heading}>{title}</h1>
        {subtitle && <p style={{ ...muted, marginTop: SPACE.sm }}>{subtitle}</p>}
      </div>
      {tools}
    </header>
  )
}

const Search = React.forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void }>(function Search({ value, onChange }, ref) {
  return (
    <div style={{ width: 'min(280px, 70vw)' }}>
      <InputField ref={ref} label="Search connectors" showLabel={false} value={value} onChange={onChange} placeholder="Search connectors" leftIcon={<SearchOneIcon size={16} />} size="small" fluid />
    </div>
  )
})

type CatalogView = 'discover' | 'all' | 'connected' | 'not-connected'
const VIEW_LABELS: [CatalogView, string][] = [['discover', 'Discover'], ['all', 'All'], ['connected', 'Connected'], ['not-connected', 'Not connected']]

// Alphabetical sorting applies within each connector view.
type SortMode = 'name-asc' | 'name-desc'
const SORT_LABELS: [SortMode, string, string][] = [
  ['name-asc', 'Name A–Z', 'Alphabetical, A to Z'],
  ['name-desc', 'Name Z–A', 'Alphabetical, Z to A'],
]

function SortMenu({ value, change }: { value: SortMode; change: (value: SortMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      trigger={<IconButton type="button" aria-label="Sort connectors" variant="outline" size="sm" icon={<ArrowUpDownIcon size={18} />} />}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
    >
      <Dropdown size="sm" maxHeight={false}>
        <Dropdown.Section fluid>
          {SORT_LABELS.map(([id, label, description]) => (
            <Dropdown.Item
              key={id}
              label={label}
              subLabel={description}
              rightIcon={id === value ? <TickTwoIcon /> : undefined}
              selected={id === value}
              fluid
              onClick={() => { change(id); setOpen(false) }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function CategoryMenu({ categories, value, change }: { categories: string[]; value: string; change: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  if (categories.length === 0) return null
  const options = ['', ...[...categories].sort((a, b) => a.localeCompare(b))]
  return (
    <Dropdown.Float
      trigger={<Button type="button" variant="outline" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>{value || 'All categories'}</Button>}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
    >
      <Dropdown size="sm">
        <Dropdown.Section fluid>
          {options.map(id => (
            <Dropdown.Item
              key={id || 'all'}
              label={id || 'All categories'}
              rightIcon={id === value ? <TickTwoIcon /> : undefined}
              selected={id === value}
              fluid
              onClick={() => { change(id); setOpen(false) }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function CatalogToolbar({
  view, changeView, query, setQuery, sort, setSort, categories, category, setCategory,
}: {
  view: CatalogView; changeView: (value: CatalogView) => void
  query: string; setQuery: (value: string) => void
  sort: SortMode; setSort: (value: SortMode) => void
  categories: string[]; category: string; setCategory: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.lg, flexWrap: 'wrap', marginBottom: SPACE.xxl }}>
      <TabsRoot value={view} onValueChange={value => changeView(value as CatalogView)}>
        <TabsList size="small" aria-label="Connector views">
          {VIEW_LABELS.map(([id, label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
        </TabsList>
      </TabsRoot>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
        <Search value={query} onChange={setQuery} />
        <CategoryMenu categories={categories} value={category} change={setCategory} />
        <SortMenu value={sort} change={setSort} />
      </div>
    </div>
  )
}

// 300px min track: three per row at full width (the shell caps content at
// 1040px), two on a laptop sidebar-open layout, one on a phone.
const CATALOG_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: SPACE.md }

function catalogCardState(summary: ConnectorCatalog): ConnectorCatalogCardState {
  if (summary.needsAttention) return 'reconnect-required'
  if (summary.connections.length > 0) return 'connected'
  return 'available'
}

function CatalogSectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ margin: `0 0 ${SPACE.lg}px` }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
        {label}
      </p>
      {sub && <p style={{ ...muted, marginTop: 2, fontSize: 'var(--font-size-caption)' }}>{sub}</p>}
    </div>
  )
}

// The category the card names: the one being filtered on when the row has
// it, otherwise the first the catalog filed it under.
function shownCategory(categories: string[], filter: string): string | undefined {
  return filter && categories.includes(filter) ? filter : categories[0]
}

function CatalogCell({ summary, select, highlight, pendingSlug, category }: { summary: ConnectorCatalog; select: (summary: ConnectorCatalog | ConnectorPick) => void; highlight?: string; pendingSlug?: string | null; category: string }) {
  const state = catalogCardState(summary)
  return (
    <ConnectorCatalogCard
      name={summary.name}
      description={summary.description}
      category={shownCategory(summary.categories, category)}
      icon={<ConnectorGlyph slug={summary.slug} name={summary.name} logoUrl={summary.logoUrl} size={32} />}
      density="detailed"
      state={state}
      action={state === 'available' ? 'icon-add' : state === 'reconnect-required' ? 'reconnect' : state === 'connected' ? 'manage' : 'none'}
      accountCount={summary.connections.length}
      highlight={highlight}
      actionPending={pendingSlug === summary.slug}
      onAction={() => select(summary)}
    />
  )
}

function PickSection({ label, sub, picks, select, pendingSlug, category }: { label: string; sub: string; picks: ConnectorPick[]; select: (summary: ConnectorPick) => void; pendingSlug?: string | null; category: string }) {
  if (picks.length === 0) return null
  return (
    <div style={{ marginBottom: SPACE.section }}>
      <CatalogSectionLabel label={label} sub={sub} />
      <div style={CATALOG_GRID}>
        {picks.map(pick => (
          <ConnectorCatalogCard
            key={pick.slug}
            title={pick.reason}
            name={pick.name}
            description={pick.description || pick.reason}
            category={shownCategory(pick.categories, category)}
            icon={<ConnectorGlyph slug={pick.slug} name={pick.name} logoUrl={pick.logoUrl} size={32} />}
            action="icon-add"
            actionPending={pendingSlug === pick.slug}
            onAction={() => select(pick)}
          />
        ))}
      </div>
    </div>
  )
}

const DISCOVER_CATEGORY_COUNT = 6
const DISCOVER_SECTION_SIZE = 6
// Over-fetched so the client-side category check below still fills a
// section against a backend that ignores `category` and only searches.
const DISCOVER_FETCH_SIZE = 24

// `category` narrows GET /connectors exactly. The same word goes in as `q`
// too (search already matches catalog categories) and rows are checked again
// here, so a backend that predates the param still returns the right apps.
function inCategory(filed: string[], category: string): boolean {
  return !category || filed.includes(category)
}

function CategorySection({
  category, connectedSlugs, select, pendingSlug, onRows, viewAll,
}: {
  category: string
  connectedSlugs: Set<string>
  select: (summary: ConnectorCatalog | ConnectorPick) => void
  pendingSlug?: string | null
  onRows?: (rows: ConnectorCatalog[]) => void
  viewAll: () => void
}) {
  const [rows, setRows] = useState<ConnectorCatalog[] | null>(null)
  useEffect(() => {
    let live = true
    void listConnectors({ q: category, category, linked: false, limit: DISCOVER_FETCH_SIZE })
      .then(page => {
        if (!live) return
        setRows(page.connectors)
        onRows?.(page.connectors)
      })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [category, onRows])

  const shown = rows
    ?.filter(row => inCategory(row.categories, category) && !connectedSlugs.has(row.slug))
    .slice(0, DISCOVER_SECTION_SIZE)
  if (shown?.length === 0) return null
  return (
    <div style={{ marginBottom: SPACE.section }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.md }}>
        <CatalogSectionLabel label={category} />
        <Button variant="ghost" size="sm" onClick={viewAll}>View all</Button>
      </div>
      <div style={CATALOG_GRID}>
        {shown
          ? shown.map(row => <CatalogCell key={row.slug} summary={row} select={select} pendingSlug={pendingSlug} category={category} />)
          : Array.from({ length: 3 }).map((_, i) => (
            <ConnectorCatalogCard key={i} name={`connector ${i + 1}`} density="detailed" state="loading" />
          ))}
      </div>
    </div>
  )
}

// Categories the person already works in lead Discover: each one their
// connected apps and recommended picks are filed under counts once. Ties keep
// the catalog's own most-used-first order.
function rankCategories(categories: string[], theirs: string[][]): string[] {
  const weight = new Map<string, number>()
  for (const filed of theirs) for (const category of filed) weight.set(category, (weight.get(category) ?? 0) + 1)
  return [...categories].sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0))
}

type PicksState = { sure: ConnectorPick[]; maybe: ConnectorPick[]; loading: boolean }

// A backend that predates `description` on picks sends none; the catalog
// entry has it.
function withDescriptions(picks: ConnectorPick[]): Promise<ConnectorPick[]> {
  return Promise.all(picks.map(pick => pick.description
    ? pick
    : getConnector(pick.slug).then(row => ({ ...pick, description: row.description }), () => pick)))
}

// The connectors half of GET /recommendations: `sureConnectors` are what
// Slack onboarding detected in their workspace, `maybeConnectors` what their
// memory profile suggests they use. A failed read reads as "none yet".
function useConnectorPicks(): PicksState {
  const [state, setState] = useState<PicksState>({ sure: [], maybe: [], loading: true })
  useEffect(() => {
    let live = true
    void fetchRecommendations()
      .then(result => Promise.all([withDescriptions(result.sureConnectors), withDescriptions(result.maybeConnectors)]))
      .then(([sure, maybe]) => { if (live) setState({ sure, maybe, loading: false }) })
      .catch(() => { if (live) setState({ sure: [], maybe: [], loading: false }) })
    return () => { live = false }
  }, [])
  return state
}

// Null until GET /connectors/categories answers, and for good if it fails.
function useConnectorCategories(): string[] | null {
  const [categories, setCategories] = useState<string[] | null>(null)
  useEffect(() => {
    let live = true
    void listConnectorCategories()
      .then(result => { if (live) setCategories(result) })
      .catch(() => { /* derived from the rows on screen instead */ })
    return () => { live = false }
  }, [])
  return categories
}

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
  const viewCategory = (value: string) => {
    setCategory(value)
    setView('all')
  }
  const discoverSections = category ? [category] : categories.slice(0, DISCOVER_CATEGORY_COUNT)

  const toolbar = (
    <CatalogToolbar
      view={view} changeView={setView}
      query={ownQuery} setQuery={changeQuery}
      sort={sort} setSort={setSort}
      categories={categories} category={category} setCategory={setCategory}
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
            <Button variant="outline" size="sm" onClick={() => setView('all')}>Browse all connectors</Button>
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

export function ConnectionsView({
  catalog, loading, select, addCustomApi, initialSearch = '', onRows, pendingSlug,
}: {
  catalog: ConnectorCatalog[]
  loading: boolean
  select: (summary: ConnectorCatalog | ConnectorPick) => void
  addCustomApi: () => void
  /** Pre-fills the catalog search — e.g. /connectors?q=slack from the welcome page's quick actions. */
  initialSearch?: string
  onRows?: (rows: ConnectorCatalog[]) => void
  /** Slug whose card should show a pending spinner (mid-fetch before its setup modal opens). */
  pendingSlug?: string | null
}) {
  const attention = useMemo(() => ConnectorCatalog.needingAttention(catalog), [catalog])

  if (loading) {
    return (
      <ConnectorsShell>
        <Header title="Connectors" subtitle="Tools your workspace can use across chat" />
        <div aria-hidden style={CATALOG_GRID}>
          {Array.from({ length: 8 }).map((_, i) => (
            <ConnectorCatalogCard key={i} name={`connector ${i + 1}`} density="detailed" state="loading" />
          ))}
        </div>
      </ConnectorsShell>
    )
  }

  return (
    <ConnectorsShell>
      <Header
        title="Connectors"
        subtitle="Tools your workspace can use across chat"
        tools={<Button variant="outline" size="sm" onClick={addCustomApi}>Add custom API</Button>}
      />
      {attention.length > 0 && (
        <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl, flexWrap: 'wrap', padding: SPACE.lg, marginBottom: SPACE.xxl, background: 'var(--yellow-50)' }}>
          <strong>{attention.length} account{attention.length === 1 ? '' : 's'} need attention</strong>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const first = catalog.find(row => row.needsAttention)
              if (first) select(first)
            }}
          >
            Review
          </Button>
        </div>
      )}
      <Catalog catalog={catalog} query={initialSearch} select={select} onRows={onRows} pendingSlug={pendingSlug} />
    </ConnectorsShell>
  )
}
