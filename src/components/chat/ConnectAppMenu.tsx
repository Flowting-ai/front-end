'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRightOneIcon, LinkSixIcon, PlusSignIcon, SearchOneIcon, SourceCodeIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { SetupModal } from '@/components/connectors/SetupModal'
import { useOrg } from '@/context/org-context'
import { bustConnectorCatalogCache, getConnector, type ConnectorCatalog } from '@/lib/api/connectors'
import {
  cachedFeaturedApps, cachedSearch, featuredIsStale, invalidateConnectApps, loadFeaturedApps, searchApps,
} from '@/lib/connect-apps-cache'
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
  // First render reads the module cache only (empty on the server → no hydration mismatch); the
  // effect below fills it and refreshes in the background when stale.
  const [featuredRows, setFeaturedRows] = useState<ConnectorCatalog[] | null>(() => cachedFeaturedApps())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState<{ q: string; rows: ConnectorCatalog[] } | null>(null)
  const [setupFor, setSetupFor] = useState<ConnectorCatalog | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const hit = cachedFeaturedApps()
    if (!hit || featuredIsStale()) {
      void loadFeaturedApps().then(rows => { if (!cancelled) setFeaturedRows(rows) }).catch(() => { if (!cancelled) setFeaturedRows(prev => prev ?? []) })
    }
    return () => { cancelled = true }
  }, [])

  // Typed search goes to the backend (8 results), debounced; a repeated query is served from cache.
  const q = query.trim()
  useEffect(() => {
    if (!q || cachedSearch(q)) return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchApps(q)
        .then(rows => { if (!cancelled) setSearched({ q, rows }) })
        .catch(() => { if (!cancelled) setSearched({ q, rows: [] }) })
    }, SEARCH_DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q])
  const results = !q ? null : (cachedSearch(q) ?? (searched?.q === q ? searched.rows : null))

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
    void getConnector(row.slug)
      .then(detail => {
        changeOpen(false)
        setSetupFor(detail)
      })
      .catch(() => toast.error(`Couldn't load ${row.name}`))
      .finally(() => setPendingSlug(null))
  }

  function connected() {
    setSetupFor(null)
    bustConnectorCatalogCache()
    invalidateConnectApps()
    void loadFeaturedApps().then(setFeaturedRows).catch(() => {})
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
