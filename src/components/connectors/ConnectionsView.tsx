'use client'

// Connections view — covers S1 (empty), S2 (catalog), S3/S17 (connections),
// S14 (reconnect banner). Ported 1:1 from
// may-day-final/src/stories/teams/ConnectorLibraryV1.stories.tsx, wired to
// real data via ConnectorCatalog instead of the story's static mocks.
// See docs-v1.5/connectors-v1.5-migration-plan.md §2/§3.

// Parts: connections-shared.tsx, CatalogDiscover.tsx, Catalog.tsx.

import React, { useMemo } from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { type ConnectorPick } from '@/lib/api/recommendations'
import { ConnectorCatalog } from '@/lib/api/connectors'

import {
  SPACE,
  panel,
  ConnectorsShell,
  Header,
  CatalogToolbar,
  ConnectorsSpinner,
} from './connections-shared'
import { Catalog } from './Catalog'

export { ConnectorsShell } from './connections-shared'
export { Catalog } from './Catalog'

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
        <Header
          title="Connectors"
          subtitle="Tools your workspace can use across chat"
          tools={<Button variant="default" size="sm" leftIcon={<PlusSignIcon size={14} />} disabled>Add custom API</Button>}
        />
        <CatalogLoading />
      </ConnectorsShell>
    )
  }

  return (
    <ConnectorsShell>
      <Header
        title="Connectors"
        subtitle="Tools your workspace can use across chat"
        tools={<Button variant="default" size="sm" leftIcon={<PlusSignIcon size={14} />} onClick={addCustomApi}>Add custom API</Button>}
      />
      {attention.length > 0 && (
        <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xl, flexWrap: 'wrap', padding: SPACE.lg, marginBottom: SPACE.xxl, background: 'var(--yellow-50)' }}>
          <strong>{attention.length} account{attention.length === 1 ? '' : 's'} need attention</strong>
          <Button
            variant="outline"
            attention
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

// Loading stand-in: the real toolbar (inert) over a centred spinner.
function CatalogLoading() {
  const noop = () => {}
  return (
    <section aria-busy="true">
      <CatalogToolbar
        view="discover" changeView={noop}
        query="" setQuery={noop}
        sort="name-asc" setSort={noop}
        categories={['All']} category="" setCategory={noop}
      />
      <ConnectorsSpinner minHeight={480} />
    </section>
  )
}
