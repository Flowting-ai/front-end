'use client'

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRightOneIcon, LinkSixIcon, PlusSignIcon, SearchOneIcon, SourceCodeIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { SetupModal } from '@/components/connectors/lazy'
import { useOrg } from '@/context/org-context'
import { bustConnectorCatalogCache, type ConnectorCatalog } from '@/lib/api/connectors'
import { appSearchQuery, connectorDetailQuery, featuredAppsQuery } from '@/lib/connectors/connector-queries'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ORG_CONNECTORS_ROUTE } from '@/lib/routes'
import styles from './ChatHome.module.css'

const TRIGGER_STACK = ['gmail', 'outlook']
const SKELETON_ROWS = 6
const SEARCH_DEBOUNCE_MS = 200

/** Placeholder rows while the featured apps load for the first time (same height as a menu item). */
function AppRowsSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0' }}>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 8px' }}>
          <span className="kaya-skeleton" style={{ width: 20, height: 20, borderRadius: 6, flex: 'none' }} />
          <span className="kaya-skeleton" style={{ height: 12, width: `${48 + (i * 9) % 30}%`, borderRadius: 5 }} />
        </div>
      ))}
    </div>
  )
}

export function ConnectAppMenu() {
  const router = useRouter()
  const { orgId } = useOrg()
  const queryClient = useQueryClient()
  // Featured apps by slug (warmed from the app shell) and typed backend search,
  // both React Query: cached, deduplicated, refreshed in the background when stale.
  const featuredQ = useQuery(featuredAppsQuery())
  // A failed first load shows an empty list instead of skeletons forever.
  const featuredRows: ConnectorCatalog[] | null = featuredQ.data ?? (featuredQ.isError ? [] : null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [setupFor, setSetupFor] = useState<ConnectorCatalog | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  // Typed search goes to the backend (8 results), debounced; a repeated query is served from cache.
  const q = query.trim()
  const debouncedQ = useDebouncedValue(q, SEARCH_DEBOUNCE_MS)
  const searchQ = useQuery(appSearchQuery(debouncedQ))
  // A query already searched shows at once, without waiting for the debounce.
  const cachedNow = q ? queryClient.getQueryData<ConnectorCatalog[]>(appSearchQuery(q).queryKey) : undefined
  const results = !q ? null : (cachedNow ?? (debouncedQ === q ? (searchQ.data ?? (searchQ.isError ? [] : null)) : null))

  const stack = TRIGGER_STACK
    .map(slug => (featuredRows ?? []).find(row => row.slug === slug))
    .filter((row): row is ConnectorCatalog => row != null)
  const rows = q ? results : featuredRows

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function go(href: string) {
    changeOpen(false)
    router.push(href)
  }

  function choose(row: ConnectorCatalog) {
    if (row.connections.length > 0) {
      go(`${ORG_CONNECTORS_ROUTE}?connector=${encodeURIComponent(row.slug)}`)
      return
    }
    setPendingSlug(row.slug)
    void queryClient.fetchQuery(connectorDetailQuery(row.slug))
      .then(detail => {
        changeOpen(false)
        setSetupFor(detail)
      })
      .catch(() => toast.error(`Couldn't load ${row.name}`))
      .finally(() => setPendingSlug(null))
  }

  function connected() {
    setSetupFor(null)
    // Refetches featured (new linked tick), search results and every connector list.
    bustConnectorCatalogCache()
  }

  return (
    <>
      <Dropdown.Float
        open={open}
        onOpenChange={changeOpen}
        placement="bottom-start"
        autoFlipVertical
        trigger={
          <button type="button" className={styles.contextAction} aria-haspopup="dialog" aria-expanded={open}>
            {stack.length > 0 ? (
              <span className={styles.appStack} aria-hidden>
                {stack.map(row => (
                  <ConnectorGlyph key={row.slug} slug={row.slug} name={row.name} logoUrl={row.logoUrl} size={14} className={styles.appStackItem} />
                ))}
              </span>
            ) : (
              <LinkSixIcon size={16} />
            )}
            <span>Connect an app</span>
          </button>
        }
      >
        <Dropdown size="md" style={{ width: 'min(340px, calc(100vw - 32px))' }} maxHeight="min(460px, calc(100dvh - 120px))">
          <Dropdown.Section fluid>
            <p className={styles.connectIntro}>Connect your favorite apps and tools so Souvenir can act on your data</p>
            <InputField
              label="Search apps"
              showLabel={false}
              value={query}
              onChange={setQuery}
              placeholder="Search apps…"
              leftIcon={<SearchOneIcon size={16} />}
              size="small"
              autoFocus
              fluid
            />
          </Dropdown.Section>
          <Dropdown.Section divider fluid>
            {rows === null ? (
              <AppRowsSkeleton />
            ) : rows.length === 0 ? (
              <Dropdown.Item label={q ? 'No apps match that search' : 'No apps available'} disabled fluid />
            ) : rows.map(row => {
              const linked = row.connections.length > 0
              return (
                <Dropdown.Item
                  key={row.slug}
                  label={row.name}
                  avatar={<ConnectorGlyph slug={row.slug} name={row.name} logoUrl={row.logoUrl} size={20} />}
                  rightIcon={linked ? <TickTwoIcon /> : <PlusSignIcon />}
                  aria-label={linked ? `${row.name}, connected` : `Connect ${row.name}`}
                  disabled={pendingSlug === row.slug}
                  onClick={() => choose(row)}
                  fluid
                />
              )
            })}
          </Dropdown.Section>
          <Dropdown.Section divider fluid>
            <Dropdown.Item label="View all" icon={<LinkSixIcon />} rightIcon={<ArrowUpRightOneIcon />} onClick={() => go(ORG_CONNECTORS_ROUTE)} fluid />
            <Dropdown.Item label="Connect your own API" icon={<SourceCodeIcon />} onClick={() => go(`${ORG_CONNECTORS_ROUTE}?add=api`)} fluid />
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>

      {setupFor && createPortal(
        <SetupModal
          catalog={setupFor}
          orgId={orgId}
          mode="connect"
          cancel={() => setSetupFor(null)}
          onConnected={connected}
        />,
        document.body,
      )}
    </>
  )
}
