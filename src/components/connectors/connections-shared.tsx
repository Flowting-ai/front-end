'use client'

// Shared pieces of the connectors page: catalogue page cache, spacing and text
// styles, the page shell, header, search, toolbar menus and card helpers.

import React, { useState } from 'react'
import { ArrowDownOneIcon, ArrowUpDownIcon, SearchOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { ConnectorCatalogCard, type ConnectorCatalogCardState } from '@/components/ConnectorCatalogCard'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { Tabs as TabsRoot, TabsList, TabsTrigger } from '@/components/Tabs'
import { type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog, type ConnectorListQuery, type ConnectorListPage } from '@/lib/api/connectors'
import { connectorsPageQuery } from '@/lib/connectors/connector-queries'
import { getQueryClient } from '@/lib/query-client'


export const AVAILABLE_PAGE_SIZE = 10

// Catalogue pages, cached by (search term, category, cursor) in React Query. Each page request takes
// seconds on a cold backend, and the list used to sit on the OLD page the whole time, so Next/Previous
// looked dead. Pages seen before are served from the cache (Previous is instant), and the page after the
// current one is prefetched in the background (Next is usually instant). A connect or disconnect
// invalidates them (bustConnectorCatalogCache), and they go stale after a minute.
export const PAGE_TTL_MS = 60_000
export type BrowsePage = ConnectorListPage
export const browseQuery = (q: string, category: string, cursor: string | undefined): ConnectorListQuery => ({
  q: q || category,
  category,
  linked: q ? undefined : false,
  cursor,
  limit: AVAILABLE_PAGE_SIZE,
})
export function cachedPage(q: string, category: string, cursor: string | undefined): BrowsePage | null {
  const key = connectorsPageQuery(browseQuery(q, category, cursor)).queryKey
  const state = getQueryClient().getQueryState(key)
  return state?.data && !state.isInvalidated && Date.now() - state.dataUpdatedAt < PAGE_TTL_MS ? state.data : null
}
export function fetchBrowsePage(q: string, category: string, cursor: string | undefined): Promise<BrowsePage> {
  return getQueryClient().fetchQuery({ ...connectorsPageQuery(browseQuery(q, category, cursor)), staleTime: PAGE_TTL_MS })
}

export const SPACE = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, section: 32 } as const

export const heading: React.CSSProperties = { margin: 0, color: 'var(--neutral-900)', fontFamily: 'var(--font-title)', fontSize: 32, fontWeight: 400, lineHeight: 1.2 }
export const muted: React.CSSProperties = { margin: 0, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)' }
export const panel: React.CSSProperties = { borderRadius: 12, background: 'var(--card-bg)', boxShadow: '0 0 0 1px var(--neutral-100)' }

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

export function Header({ title, subtitle, tools }: { title: string; subtitle?: string; tools?: React.ReactNode }) {
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

export const Search = React.forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void }>(function Search({ value, onChange }, ref) {
  return (
    <div style={{ width: 'min(280px, 70vw)' }}>
      <InputField ref={ref} label="Search connectors" showLabel={false} value={value} onChange={onChange} placeholder="Search connectors" leftIcon={<SearchOneIcon size={16} />} size="small" fluid />
    </div>
  )
})

export type CatalogView = 'discover' | 'all' | 'connected' | 'not-connected'
export const VIEW_LABELS: [CatalogView, string][] = [['discover', 'Discover'], ['all', 'All'], ['connected', 'Connected'], ['not-connected', 'Not connected']]

// Alphabetical sorting applies within each connector view.
export type SortMode = 'name-asc' | 'name-desc'
export const SORT_LABELS: [SortMode, string, string][] = [
  ['name-asc', 'Name A–Z', 'Alphabetical, A to Z'],
  ['name-desc', 'Name Z–A', 'Alphabetical, Z to A'],
]

export function SortMenu({ value, change }: { value: SortMode; change: (value: SortMode) => void }) {
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

export function CategoryMenu({ categories, value, change }: { categories: string[]; value: string; change: (value: string) => void }) {
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

export function CatalogToolbar({
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
export const CATALOG_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: SPACE.md }

export function catalogCardState(summary: ConnectorCatalog): ConnectorCatalogCardState {
  if (summary.needsAttention) return 'reconnect-required'
  if (summary.connections.length > 0) return 'connected'
  return 'available'
}

export function CatalogSectionLabel({ label, sub, flush }: { label: string; sub?: string; flush?: boolean }) {
  return (
    <div style={{ margin: flush ? 0 : `0 0 ${SPACE.lg}px` }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
        {label}
      </p>
      {sub && <p style={{ ...muted, marginTop: 2, fontSize: 'var(--font-size-caption)' }}>{sub}</p>}
    </div>
  )
}

// The category the card names: the one being filtered on when the row has
// it, otherwise the first the catalog filed it under.
export function shownCategory(categories: string[], filter: string): string | undefined {
  return filter && categories.includes(filter) ? filter : categories[0]
}

export function CatalogCell({ summary, select, highlight, pendingSlug, category }: { summary: ConnectorCatalog; select: (summary: ConnectorCatalog | ConnectorPick) => void; highlight?: string; pendingSlug?: string | null; category: string }) {
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

export function PickSection({ label, sub, picks, select, pendingSlug, category }: { label: string; sub: string; picks: ConnectorPick[]; select: (summary: ConnectorPick) => void; pendingSlug?: string | null; category: string }) {
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

