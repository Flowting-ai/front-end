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
  PlusSignIcon,
  SearchOneIcon,
  SettingsOneIcon,
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
import { ConnectorCatalog, listConnectors } from '@/lib/api/connectors'

const AVAILABLE_PAGE_SIZE = 10

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
export function ConnectorsShell({ children }: { children: React.ReactNode }) {
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
      <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto' }}>{children}</div>
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

type CatalogView = 'all' | 'connected' | 'not-connected'
const VIEW_LABELS: [CatalogView, string][] = [['all', 'All'], ['connected', 'Connected'], ['not-connected', 'Not connected']]

type SortMode = 'recommended' | 'name'
type TypeFilter = 'all' | 'trending' | 'new'
const SORT_LABELS: [SortMode, string][] = [['recommended', 'Recommended'], ['name', 'Name A–Z']]
const TYPE_LABELS: [TypeFilter, string][] = [['all', 'All'], ['trending', 'Trending'], ['new', 'New']]

// No backend field curates "trending"/"new" (Gap #12 in the plan doc) —
// featured_weight is Pipedream's own sync weight, an approximate proxy only.
function typeMembers(type: TypeFilter, pool: ConnectorCatalog[]) {
  if (type === 'all') return pool
  const weighted = pool.map(row => ({ row, weight: row.featuredWeight }))
  if (type === 'trending') {
    return weighted.filter(x => x.weight != null).sort((a, b) => (b.weight as number) - (a.weight as number)).map(x => x.row)
  }
  return weighted.filter(x => x.weight == null).map(x => x.row)
}

function CountHint({ value }: { value: number }) {
  return <span style={{ color: 'var(--color-text-placeholder)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)' }}>{value}</span>
}

function RefineMenu({ value, change, pool }: { value: TypeFilter; change: (value: TypeFilter) => void; pool: ConnectorCatalog[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      trigger={<IconButton type="button" aria-label="Filter connectors by type" variant="outline" size="sm" icon={<SettingsOneIcon size={18} />} />}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
    >
      <Dropdown size="sm">
        <Dropdown.Section label="Type" fluid>
          {TYPE_LABELS.map(([id, label]) => (
            <Dropdown.Item
              key={id}
              label={label}
              badge={<CountHint value={typeMembers(id, pool).length} />}
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

function SortMenu({ value, change }: { value: SortMode; change: (value: SortMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      trigger={<IconButton type="button" aria-label="Sort connectors" variant="outline" size="sm" icon={<ArrowUpDownIcon size={18} />} />}
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
    >
      <Dropdown size="sm">
        <Dropdown.Section fluid>
          {SORT_LABELS.map(([id, label]) => (
            <Dropdown.Item key={id} label={label} selected={id === value} fluid onClick={() => { change(id); setOpen(false) }} />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function CatalogToolbar({
  view, changeView, query, setQuery, type, setType, pool, sort, setSort,
}: {
  view: CatalogView; changeView: (value: CatalogView) => void
  query: string; setQuery: (value: string) => void
  type: TypeFilter; setType: (value: TypeFilter) => void
  pool: ConnectorCatalog[]
  sort: SortMode; setSort: (value: SortMode) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.lg, flexWrap: 'wrap', marginBottom: SPACE.xxl }}>
      <TabsRoot value={view} onValueChange={value => changeView(value as CatalogView)}>
        <TabsList size="small" aria-label="Connector views">
          {VIEW_LABELS.map(([id, label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
        </TabsList>
      </TabsRoot>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Search value={query} onChange={setQuery} />
        <RefineMenu value={type} change={setType} pool={pool} />
        <SortMenu value={sort} change={setSort} />
      </div>
    </div>
  )
}

// 360px min track: two per row at every desktop width (the shell caps content
// at 1040px), one column below ~730px.
const CATALOG_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: SPACE.lg }

function catalogCardState(summary: ConnectorCatalog): ConnectorCatalogCardState {
  if (summary.needsAttention) return 'reconnect-required'
  if (summary.connections.length > 0) return 'connected'
  return 'available'
}

function CatalogSectionLabel({ label }: { label: string }) {
  return (
    <p style={{ margin: `0 0 ${SPACE.lg}px`, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
      {label}
    </p>
  )
}

function CatalogCell({ summary, select, highlight }: { summary: ConnectorCatalog; select: (summary: ConnectorCatalog) => void; highlight?: string }) {
  const state = catalogCardState(summary)
  return (
    <ConnectorCatalogCard
      name={summary.name}
      description={summary.description}
      icon={<ConnectorGlyph slug={summary.slug} name={summary.name} logoUrl={summary.logoUrl} size={40} />}
      density="detailed"
      state={state}
      action={state === 'available' ? 'icon-add' : state === 'reconnect-required' ? 'reconnect' : state === 'connected' ? 'manage' : 'none'}
      accountCount={summary.connections.length}
      highlight={highlight}
      onAction={() => select(summary)}
    />
  )
}

export function Catalog({
  catalog, query, select, custom, onRows,
}: {
  catalog: ConnectorCatalog[]
  query: string
  select: (summary: ConnectorCatalog) => void
  custom: () => void
  onRows?: (rows: ConnectorCatalog[]) => void
}) {
  const [view, setView] = useState<CatalogView>('all')
  const [ownQuery, setOwnQuery] = useState(query)
  const [type, setType] = useState<TypeFilter>('all')
  const [sort, setSort] = useState<SortMode>('recommended')
  const [page, setPage] = useState(1)
  const cursorsRef = useRef<(string | undefined)[]>([undefined])
  const [browseItems, setBrowseItems] = useState<ConnectorCatalog[]>([])
  const [browseHasMore, setBrowseHasMore] = useState(false)
  const [browseBusy, setBrowseBusy] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim())

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(ownQuery.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [ownQuery])

  useEffect(() => {
    setPage(1)
    cursorsRef.current = [undefined]
  }, [debouncedQuery, view])

  useEffect(() => {
    if (view === 'connected' && !debouncedQuery) {
      setBrowseItems([])
      setBrowseHasMore(false)
      setBrowseBusy(false)
      return
    }
    let cancelled = false
    setBrowseBusy(true)
    const cursor = cursorsRef.current[page - 1]
    const request = debouncedQuery
      ? listConnectors({ q: debouncedQuery, cursor, limit: AVAILABLE_PAGE_SIZE })
      : listConnectors({ linked: false, cursor, limit: AVAILABLE_PAGE_SIZE })
    void request
      .then(result => {
        if (cancelled) return
        setBrowseItems(result.connectors)
        setBrowseHasMore(result.hasMore)
        onRows?.(result.connectors)
        if (result.nextCursor) cursorsRef.current[page] = result.nextCursor
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
  }, [debouncedQuery, view, page, onRows])

  const searching = Boolean(debouncedQuery)
  const linkedRows = catalog.filter(row => row.linked || row.connections.length > 0)
  const source = searching || view !== 'connected' ? browseItems : linkedRows
  const pool = source.filter(summary => {
    const connected = summary.connections.length > 0 || summary.linked
    if (view === 'connected' && !connected) return false
    if (view === 'not-connected' && connected) return false
    return true
  })
  const items = typeMembers(type, pool)
  const sorted = sort === 'name' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : items
  const connectedItems = searching || view === 'all'
    ? (searching ? sorted.filter(summary => summary.connections.length > 0 || summary.linked) : linkedRows)
    : view === 'connected' ? sorted : []
  const availableItems = view === 'connected' && !searching
    ? []
    : sorted.filter(summary => summary.connections.length === 0 && !summary.linked)
  const showConnectedLabel = connectedItems.length > 0 && availableItems.length > 0
  const empty = !browseBusy && connectedItems.length === 0 && availableItems.length === 0

  return (
    <section id="all-connectors">
      <CatalogToolbar view={view} changeView={setView} query={ownQuery} setQuery={setOwnQuery} type={type} setType={setType} pool={pool} sort={sort} setSort={setSort} />
      {empty ? (
        <p style={{ ...muted, padding: SPACE.section, textAlign: 'center' }}>No connectors found.</p>
      ) : (
        <div style={{ marginBottom: SPACE.xxl }}>
          {connectedItems.length > 0 && (
            <div style={{ marginBottom: availableItems.length > 0 ? SPACE.xxl : 0 }}>
              {showConnectedLabel && <CatalogSectionLabel label="Connected" />}
              <div style={CATALOG_GRID}>
                {connectedItems.map(summary => <CatalogCell key={summary.slug} summary={summary} select={select} highlight={debouncedQuery} />)}
              </div>
            </div>
          )}
          {availableItems.length > 0 && (
            <div>
              {showConnectedLabel && <CatalogSectionLabel label="All connectors" />}
              <div style={CATALOG_GRID}>
                {availableItems.map(summary => <CatalogCell key={summary.slug} summary={summary} select={select} highlight={debouncedQuery} />)}
              </div>
              <div style={{ marginTop: SPACE.xl }}>
                <Pagination page={page} hasMore={browseHasMore} onChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}
      {(connectedItems.length > 0 || availableItems.length > 0) && (
        <Button variant="ghost" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={custom}>Add custom connector</Button>
      )}
    </section>
  )
}

export function ConnectionsView({
  catalog, loading, select, custom, initialSearch = '', onRows,
}: {
  catalog: ConnectorCatalog[]
  loading: boolean
  select: (summary: ConnectorCatalog) => void
  custom: () => void
  /** Pre-fills the catalog search — e.g. /connectors?q=slack from the welcome page's quick actions. */
  initialSearch?: string
  onRows?: (rows: ConnectorCatalog[]) => void
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
      <Header title="Connectors" subtitle="Tools your workspace can use across chat" />
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
      <Catalog catalog={catalog} query={initialSearch} select={select} custom={custom} onRows={onRows} />
    </ConnectorsShell>
  )
}
