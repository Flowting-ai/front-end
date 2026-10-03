'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRightOneIcon, LinkSixIcon, PlusSignIcon, SearchOneIcon, SourceCodeIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { SetupModal } from '@/components/connectors/SetupModal'
import { useOrg } from '@/context/org-context'
import { bustConnectorCatalogCache, getConnector, listConnectors, type ConnectorCatalog } from '@/lib/api/connectors'
import { ORG_CONNECTORS_ROUTE } from '@/lib/routes'
import styles from './ChatHome.module.css'

const FEATURED = ['gmail', 'outlook', 'googlecalendar', 'slack', 'notion', 'googledrive']
const TRIGGER_STACK = ['gmail', 'outlook']
const VISIBLE_ROWS = 6

async function loadCatalog(): Promise<ConnectorCatalog[]> {
  const out: ConnectorCatalog[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await listConnectors({ linked: false, cursor, limit: 100 })
    out.push(...page.connectors)
    if (!page.hasMore || !page.nextCursor) return out
    cursor = page.nextCursor
  }
}

function rank(row: ConnectorCatalog, query: string): number {
  const name = row.name.toLowerCase()
  if (name.startsWith(query) || row.slug.startsWith(query)) return 0
  if (name.includes(query) || row.slug.includes(query)) return 1
  return 2
}

export function ConnectAppMenu() {
  const router = useRouter()
  const { orgId } = useOrg()
  const [catalog, setCatalog] = useState<ConnectorCatalog[] | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [setupFor, setSetupFor] = useState<ConnectorCatalog | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadCatalog()
      .then(rows => { if (!cancelled) setCatalog(rows) })
      .catch(() => { if (!cancelled) setCatalog([]) })
    return () => { cancelled = true }
  }, [])

  const bySlug = useMemo(() => new Map((catalog ?? []).map(row => [row.slug, row])), [catalog])
  const stack = TRIGGER_STACK.map(slug => bySlug.get(slug)).filter(row => row != null)

  const rows = useMemo(() => {
    const all = catalog ?? []
    const q = query.trim().toLowerCase()
    if (!q) {
      const featured = FEATURED.map(slug => bySlug.get(slug)).filter(row => row != null)
      const rest = all.filter(row => !FEATURED.includes(row.slug))
      return [...featured, ...rest].slice(0, VISIBLE_ROWS)
    }
    return all
      .map(row => ({ row, score: rank(row, q) }))
      .filter(({ score }) => score < 2)
      .sort((a, b) => a.score - b.score || a.row.name.localeCompare(b.row.name))
      .slice(0, VISIBLE_ROWS)
      .map(({ row }) => row)
  }, [bySlug, catalog, query])

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
    void loadCatalog().then(setCatalog).catch(() => {})
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
            {catalog === null ? (
              <Dropdown.Item label="Loading apps…" disabled fluid />
            ) : rows.length === 0 ? (
              <Dropdown.Item label={query.trim() ? 'No apps match that search' : 'No apps available'} disabled fluid />
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
