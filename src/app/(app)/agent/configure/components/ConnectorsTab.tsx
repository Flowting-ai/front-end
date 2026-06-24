'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ArrowUpRightOneIcon } from '@strange-huge/icons'
import { ConnectorRow } from '@/components/ConnectorRow'
import { listConnectors } from '@/lib/api/connectors'
import { getVersion, setVersionBlockedConnectors, unblockVersionConnector } from '@/lib/api/personas'
import type { ConnectorCatalogEntry, ConnectorAccountOption } from '@/lib/api/connectors'
import { CONNECTOR_LOGO_MAP } from '@/lib/connectorLogos'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="var(--neutral-400)" strokeWidth="1.5"/>
      <path d="M10.5 10.5L13.5 13.5" stroke="var(--neutral-400)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="var(--neutral-600)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// ── Account-grouping helpers ───────────────────────────────────────────────────
// Workspace connectors are org-owned shared accounts (scope: 'shared_team'); a
// single connector can expose several. Personal connectors are the viewer's own
// linked account (scope: 'personal'). Both are surfaced through account_options;
// we fall back to the entry's scalar fields for older catalog responses.

function logoFor(entry: ConnectorCatalogEntry): string | undefined {
  return CONNECTOR_LOGO_MAP[entry.slug] ?? entry.icon_url
}

/** Connected, active shared-team accounts for this connector. */
function workspaceAccountsOf(entry: ConnectorCatalogEntry): ConnectorAccountOption[] {
  const opts = (entry.account_options ?? []).filter(
    o => o.scope === 'shared_team' && o.connected && o.status === 'active',
  )
  if (opts.length > 0) return opts
  // Fallback: the single workspace summary on the entry.
  if (entry.workspace_linked) {
    return [{
      account_ref:        entry.shared_account_id ? `shared:${entry.shared_account_id}` : 'shared',
      connector_slug:     entry.slug,
      scope:              'shared_team',
      account_label:      entry.account_label ?? 'Shared',
      account_identifier: entry.account_identifier,
      connected:          true,
      status:             'active',
      team_ids:           [],
      team_names:         [],
      shared_account_id:  entry.shared_account_id,
      linked_by_user_id:  entry.workspace_linked_by,
      can_manage:         false,
    }]
  }
  return []
}

/** True when the viewer has a personal (own) connection for this connector. */
function hasPersonalAccount(entry: ConnectorCatalogEntry): boolean {
  const opts = (entry.account_options ?? []).filter(o => o.connected && o.status === 'active')
  if (opts.length > 0) return opts.some(o => o.scope === 'personal')
  return entry.linked
}

/** A connector is usable by this agent when the viewer has any working account
 *  for it (personal or shared) or the org has enabled it. */
function isAvailable(entry: ConnectorCatalogEntry): boolean {
  return (
    entry.linked ||
    entry.org_enabled === true ||
    (entry.account_options ?? []).some(o => o.connected && o.status === 'active') ||
    entry.workspace_linked
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 12px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 5, backgroundColor: 'var(--neutral-100)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 14, width: '40%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
        <div style={{ height: 11, width: '60%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
      </div>
      <div style={{ height: 20, width: 34, borderRadius: 20, backgroundColor: 'var(--neutral-100)' }} />
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize:   14,
  lineHeight: '22px',
  color:      '#0a0a0a',
  margin:     0,
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectorsTab({
  repoId,
  versionId,
  personaName,
  onConnectorsChange,
  onSaveVersion,
}: {
  repoId?:             string
  versionId?:          string
  personaName?:        string
  onConnectorsChange?: (enabled: string[], disabled: string[]) => void
  onSaveVersion?:      () => Promise<void>
}) {
  const { push } = useRouter()
  const { safeNavigate } = usePersonaConfigure()

  const [connectors,   setConnectors]   = useState<ConnectorCatalogEntry[]>([])
  const [blockedSlugs, setBlockedSlugs] = useState<Set<string>>(new Set())
  const [showNavModal, setShowNavModal] = useState(false)
  const [isSavingNav,  setIsSavingNav]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [savingSlug,   setSavingSlug]   = useState<string | null>(null)
  const [searchQuery,  setSearchQuery]  = useState('')

  // Stable ref so callbacks never force load/toggle recreation.
  const onChangeRef = useRef(onConnectorsChange)
  useEffect(() => { onChangeRef.current = onConnectorsChange })

  // Report the current enabled/disabled split (by slug) to the parent.
  const emitChange = useCallback((available: ConnectorCatalogEntry[], blocked: Set<string>) => {
    const enabled  = available.filter(c => !blocked.has(c.slug)).map(c => c.slug)
    const disabled = available.filter(c =>  blocked.has(c.slug)).map(c => c.slug)
    onChangeRef.current?.(enabled, disabled)
  }, [])

  const load = useCallback(async () => {
    if (!repoId || !versionId) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const [catalog, version] = await Promise.all([
        listConnectors(),
        getVersion(repoId, versionId),
      ])
      const available = catalog.filter(isAvailable)
      const blocked   = new Set<string>(version.blocked_connectors ?? [])
      setConnectors(available)
      setBlockedSlugs(blocked)
      emitChange(available, blocked)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load connectors'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [repoId, versionId, emitChange])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial connector load hydrates local UI state from the API
  useEffect(() => { void load() }, [load])

  // Flip the per-agent block for a connector slug. `enabled` = the new desired
  // state (ON = unblock, OFF = block). Block is per slug, so toggling any row for
  // a slug (personal or workspace) controls the same underlying state.
  const setEnabled = useCallback(async (slug: string, enabled: boolean) => {
    if (!repoId || !versionId || savingSlug) return
    setSavingSlug(slug)
    const prev = new Set(blockedSlugs)
    const next = new Set(blockedSlugs)
    if (enabled) next.delete(slug)
    else         next.add(slug)
    setBlockedSlugs(next)
    emitChange(connectors, next)

    const displayName = connectors.find(c => c.slug === slug)?.display_name ?? slug
    const agentLabel  = personaName ? ` for ${personaName}` : ''
    try {
      if (enabled) {
        await unblockVersionConnector(repoId, versionId, slug)
        toast.success(`${displayName} enabled${agentLabel}`)
      } else {
        await setVersionBlockedConnectors(repoId, versionId, [...next])
        toast.success(`${displayName} disabled${agentLabel}`)
      }
    } catch (err) {
      setBlockedSlugs(prev)
      emitChange(connectors, prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update connector')
    } finally {
      setSavingSlug(null)
    }
  }, [repoId, versionId, savingSlug, blockedSlugs, connectors, personaName, emitChange])

  const matchesSearch = useCallback((c: ConnectorCatalogEntry) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const visible = connectors.filter(matchesSearch)

  // Workspace rows: one per connected shared account (a connector may have many).
  const workspaceRows = visible.flatMap(entry =>
    workspaceAccountsOf(entry).map(account => ({ entry, account })),
  )
  // Personal rows: one per connector the viewer personally linked.
  const personalRows = visible.filter(hasPersonalAccount)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', paddingTop: 3 }}>

      {/* ── Manage-in-settings navigation modal ────────────────────────── */}
      {showNavModal && (
        <>
          <div
            onClick={() => { if (!isSavingNav) setShowNavModal(false) }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(38,33,30,0.32)', zIndex: 50 }}
          />
          <div style={{
            position:        'fixed',
            top:             '50%',
            left:            '50%',
            transform:       'translate(-50%, -50%)',
            zIndex:          51,
            backgroundColor: 'white',
            borderRadius:    16,
            boxShadow:       '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
            width:           400,
            maxWidth:        'calc(100vw - 48px)',
            padding:         24,
            display:         'flex',
            flexDirection:   'column',
            gap:             16,
          }}>
            <div>
              <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }}>
                Leave to Settings?
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
                You are about to leave the agent editor. You can save a version first before going to Settings.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                variant="outline"
                size="sm"
                disabled={isSavingNav}
                onClick={() => setShowNavModal(false)}
              >
                Stay
              </Button>
              <Button
                variant="default"
                size="sm"
                loading={isSavingNav}
                onClick={async () => {
                  setIsSavingNav(true)
                  try {
                    await onSaveVersion?.()
                    push('/settings/connectors')
                  } catch {
                    // onSaveVersion shows its own error toast; stay in modal
                  } finally {
                    setIsSavingNav(false)
                  }
                }}
              >
                Save and continue
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0 }}>
          Connectors
        </h2>
        <Button
          variant="outline"
          size="sm"
          rightIcon={<ArrowUpRightOneIcon size={16} animated />}
          onClick={() => setShowNavModal(true)}
        >
          Manage in Settings
        </Button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '7px 10px', borderRadius: 10, backgroundColor: 'white', boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)' }}>
        <SearchIcon />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search connectors…"
          style={{ flex: 1, minWidth: 0, padding: '0 2px', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#6a625d', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
            <XIcon />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 22, width: 200, borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
            {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 22, width: 160, borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      ) : loadError ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: '0 0 12px' }}>
            {loadError}
          </p>
          <button
            onClick={() => void load()}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--neutral-200)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)' }}
          >
            Retry
          </button>
        </div>
      ) : connectors.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-400)', margin: 0, maxWidth: 300 }}>
            No connectors are available yet. Connect or enable connectors in Settings to use them in this agent.
          </p>
          <Button variant="secondary" size="sm" onClick={() => safeNavigate('/settings/connectors')}>
            Go to Settings
          </Button>
        </div>
      ) : workspaceRows.length === 0 && personalRows.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0, padding: '16px 12px' }}>
          No connectors match &ldquo;{searchQuery}&rdquo;.
        </p>
      ) : (
        <>
          {/* ── Workspace connectors — shared org accounts ──────────────────── */}
          {workspaceRows.length > 0 && (
            <section data-help-id="help-connectors-workspace" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ ...SECTION_LABEL, marginBottom: 4, paddingLeft: 12 }}>Workspace connectors</p>
              {workspaceRows.map(({ entry, account }) => (
                <ConnectorRow
                  key={`${entry.slug}:${account.account_ref}`}
                  name={entry.display_name}
                  description={entry.description}
                  iconUrl={logoFor(entry)}
                  status="connected-workspace"
                  accountLabel={account.account_label}
                  active={!blockedSlugs.has(entry.slug)}
                  onActiveChange={enabled => void setEnabled(entry.slug, enabled)}
                  disabled={savingSlug === entry.slug}
                />
              ))}
            </section>
          )}

          {/* ── Personal connectors — the viewer's own accounts ─────────────── */}
          {personalRows.length > 0 && (
            <section data-help-id="help-connectors-personal" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ ...SECTION_LABEL, marginBottom: 4, paddingLeft: 12 }}>Personal connectors</p>
              {personalRows.map(entry => (
                <ConnectorRow
                  key={entry.slug}
                  name={entry.display_name}
                  description={entry.description}
                  iconUrl={logoFor(entry)}
                  status="connected-personal"
                  active={!blockedSlugs.has(entry.slug)}
                  onActiveChange={enabled => void setEnabled(entry.slug, enabled)}
                  disabled={savingSlug === entry.slug}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
