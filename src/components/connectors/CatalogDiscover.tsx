'use client'

// The Discover view: recommended picks and category sections, each loaded when near the viewport.

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectorCatalogCard } from '@/components/ConnectorCatalogCard'
import { fetchRecommendations, type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog } from '@/lib/api/connectors'
import { connectorCategoriesQuery, connectorDetailQuery, connectorsPageQuery } from '@/lib/connectors/connector-queries'
import { getQueryClient } from '@/lib/query-client'

import { SPACE, CATALOG_GRID, CatalogSectionLabel, CatalogCell } from './connections-shared'

export const DISCOVER_CATEGORY_COUNT = 6
export const DISCOVER_SECTION_SIZE = 6
// Over-fetched so the client-side category check below still fills a
// section against a backend that ignores `category` and only searches.
export const DISCOVER_FETCH_SIZE = 24

// `category` narrows GET /connectors exactly. The same word goes in as `q`
// too (search already matches catalog categories) and rows are checked again
// here, so a backend that predates the param still returns the right apps.
export function inCategory(filed: string[], category: string): boolean {
  return !category || filed.includes(category)
}

export function CategorySection({
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
  // Fetch a section only once it is near the viewport, not all of them on page load.
  const hostRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect() }
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!near) return
    let live = true
    void getQueryClient().fetchQuery(connectorsPageQuery({ q: category, category, linked: false, limit: DISCOVER_FETCH_SIZE }))
      .then(page => {
        if (!live) return
        setRows(page.connectors)
        onRows?.(page.connectors)
      })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [near, category, onRows])

  const shown = rows
    ?.filter(row => inCategory(row.categories, category) && !connectedSlugs.has(row.slug))
    .slice(0, DISCOVER_SECTION_SIZE)
  if (shown?.length === 0) return null
  return (
    <div ref={hostRef} style={{ marginBottom: SPACE.section }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, marginBottom: SPACE.sm }}>
        <CatalogSectionLabel label={category} flush />
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
export function rankCategories(categories: string[], theirs: string[][]): string[] {
  const weight = new Map<string, number>()
  for (const filed of theirs) for (const category of filed) weight.set(category, (weight.get(category) ?? 0) + 1)
  return [...categories].sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0))
}

export type PicksState = { sure: ConnectorPick[]; maybe: ConnectorPick[]; loading: boolean }

// A backend that predates `description` on picks sends none; the catalog
// entry has it.
export function withDescriptions(picks: ConnectorPick[]): Promise<ConnectorPick[]> {
  return Promise.all(picks.map(pick => pick.description
    ? pick
    : getQueryClient().fetchQuery(connectorDetailQuery(pick.slug)).then(row => ({ ...pick, description: row.description }), () => pick)))
}

// The connectors half of GET /recommendations: `sureConnectors` are what
// Slack onboarding detected in their workspace, `maybeConnectors` what their
// memory profile suggests they use. A failed read reads as "none yet".
export function useConnectorPicks(): PicksState {
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
export function useConnectorCategories(): string[] | null {
  const [categories, setCategories] = useState<string[] | null>(null)
  useEffect(() => {
    let live = true
    void getQueryClient().fetchQuery(connectorCategoriesQuery())
      .then(result => { if (live) setCategories(result) })
      .catch(() => { /* derived from the rows on screen instead */ })
    return () => { live = false }
  }, [])
  return categories
}

