'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ArrowUpRightOneIcon } from '@strange-huge/icons'
import { listConnectors } from '@/lib/api/connectors'
import { getVersion, setVersionBlockedConnectors, unblockVersionConnector } from '@/lib/api/personas'
import type { ConnectorCatalogEntry } from '@/lib/api/connectors'
import { CONNECTOR_LOGO_MAP } from '@/lib/connectorLogos'

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

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'conn-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <style>{`@keyframes conn-spin { to { transform: rotate(360deg) } }`}</style>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Connector avatar ──────────────────────────────────────────────────────────

function ConnectorAvatar({ entry, size = 26 }: { entry: ConnectorCatalogEntry; size?: number }) {
  const localLogo = CONNECTOR_LOGO_MAP[entry.slug]

  if (localLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- local brand asset
      <img src={localLogo} alt={entry.display_name} width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />
    )
  }

  if (entry.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic connector icon URL
      <img src={entry.icon_url} alt={entry.display_name} width={size} height={size} style={{ objectFit: 'contain', flexShrink: 0 }} />
    )
  }

  const letter = entry.display_name.charAt(0).toUpperCase()
  const hue    = [...entry.slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      backgroundColor: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 60% 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: size * 0.45,
      flexShrink: 0, userSelect: 'none',
    }}>
      {letter}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={on}
      role="switch"
      style={{
        position: 'relative', display: 'inline-block',
        width: 34, height: 20, borderRadius: 20,
        border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
        backgroundColor: on ? '#6e98cb' : 'var(--neutral-200, #d1c6bd)',
        boxShadow: on
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.7)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(106,98,93,0.3)',
        transition: 'background-color 200ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: 'white',
        boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.4)',
        transition: 'left 200ms',
      }} />
    </button>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, padding: '0 12px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 5, backgroundColor: 'var(--neutral-100)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 14, width: '40%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
        <div style={{ height: 11, width: '60%', borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
      </div>
      <div style={{ height: 20, width: 34, borderRadius: 20, backgroundColor: 'var(--neutral-100)' }} />
    </div>
  )
}

// ── Persona connector row ─────────────────────────────────────────────────────

function PersonaConnectorRow({
  entry,
  enabled,
  saving,
  onToggle,
}: {
  entry:    ConnectorCatalogEntry
  enabled:  boolean
  saving:   boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 56, padding: '0 12px', borderRadius: 12,
    }}>
      <div style={{
        width: 38, height: 38, backgroundColor: 'white', borderRadius: 5,
        padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: '1px solid var(--neutral-100)',
      }}>
        <ConnectorAvatar entry={entry} size={26} />
      </div>

      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.display_name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: '#827a74', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.description}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {saving && <SpinnerIcon size={12} />}
        <ToggleSwitch on={enabled} onChange={onToggle} disabled={saving} />
      </div>
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

// ── User-removed connector tracking (per version) ─────────────────────────────
// Tracks connectors the user explicitly toggled OFF so they don't get
// auto-enabled again when linked connectors are synced from Settings.

function removedKey(versionId: string) {
  return `persona_conn_removed_${versionId}`
}

function getUserRemovedSlugs(versionId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(removedKey(versionId))
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveUserRemovedSlug(versionId: string, slug: string) {
  if (typeof window === 'undefined') return
  try {
    const s = getUserRemovedSlugs(versionId)
    s.add(slug)
    localStorage.setItem(removedKey(versionId), JSON.stringify([...s]))
  } catch {}
}

function clearUserRemovedSlug(versionId: string, slug: string) {
  if (typeof window === 'undefined') return
  try {
    const s = getUserRemovedSlugs(versionId)
    s.delete(slug)
    localStorage.setItem(removedKey(versionId), JSON.stringify([...s]))
  } catch {}
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

  const [linked,          setLinked]          = useState<ConnectorCatalogEntry[]>([])
  const [personaSlugs,    setPersonaSlugs]    = useState<Set<string>>(new Set())
  const [blockedSlugs,    setBlockedSlugs]    = useState<Set<string>>(new Set())
  const [confirmSlug,     setConfirmSlug]     = useState<string | null>(null)
  const [showNavModal,    setShowNavModal]     = useState(false)
  const [isSavingNav,     setIsSavingNav]     = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [loadError,       setLoadError]       = useState('')
  const [savingSlug,      setSavingSlug]      = useState<string | null>(null)
  const [searchQuery,     setSearchQuery]     = useState('')

  // Stable ref so callbacks never force load/handleToggle recreation
  const onChangeRef = useRef(onConnectorsChange)
  useEffect(() => { onChangeRef.current = onConnectorsChange })

  const load = useCallback(async () => {
    if (!repoId || !versionId) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const [catalog, version] = await Promise.all([
        listConnectors(),
        getVersion(repoId, versionId),
      ])
      const linkedConnectors = catalog.filter(c => c.linked)
      setLinked(linkedConnectors)

      // blocked_connectors is a block-list: slugs in it are disabled; all
      // other linked connectors are considered enabled.
      const existingBlocked = new Set<string>(version.blocked_connectors ?? [])
      const desired = new Set<string>(
        linkedConnectors.filter(c => !existingBlocked.has(c.slug)).map(c => c.slug),
      )

      setPersonaSlugs(desired)
      setBlockedSlugs(existingBlocked)
      onChangeRef.current?.([...desired], [...existingBlocked])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load connectors'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [repoId, versionId])

  useEffect(() => { void load() }, [load])

  const handleToggle = useCallback((slug: string) => {
    if (savingSlug || !repoId || !versionId) return
    if (personaSlugs.has(slug)) {
      // Show confirmation before disabling
      setConfirmSlug(slug)
    } else {
      // Re-enable immediately (no confirmation needed)
      void doEnable(slug)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- doEnable captured below
  }, [savingSlug, repoId, versionId, personaSlugs])

  // Re-enable a connector: unblock it for this persona version
  const doEnable = useCallback(async (slug: string) => {
    if (!repoId || !versionId) return
    setSavingSlug(slug)
    const prevPersona  = new Set(personaSlugs)
    const prevBlocked  = new Set(blockedSlugs)
    const nextPersona  = new Set(personaSlugs)
    const nextBlocked  = new Set(blockedSlugs)
    nextPersona.add(slug)
    nextBlocked.delete(slug)
    clearUserRemovedSlug(versionId, slug)
    setPersonaSlugs(nextPersona)
    setBlockedSlugs(nextBlocked)
    onChangeRef.current?.([...nextPersona], [...nextBlocked])
    try {
      await unblockVersionConnector(repoId, versionId, slug)
      const displayName = linked.find(c => c.slug === slug)?.display_name ?? slug
      const agentLabel  = personaName ? ` for ${personaName}` : ''
      toast.success(`${displayName} enabled${agentLabel}`)
    } catch (err) {
      setPersonaSlugs(prevPersona)
      setBlockedSlugs(prevBlocked)
      onChangeRef.current?.([...prevPersona], [...prevBlocked])
      toast.error(err instanceof Error ? err.message : 'Failed to enable connector')
    } finally {
      setSavingSlug(null)
    }
  }, [repoId, versionId, personaSlugs, blockedSlugs, linked, personaName])

  // Disable a connector (called after confirm dialog confirms)
  const doDisable = useCallback(async (slug: string) => {
    setConfirmSlug(null)
    if (!repoId || !versionId) return
    setSavingSlug(slug)
    const prevPersona  = new Set(personaSlugs)
    const prevBlocked  = new Set(blockedSlugs)
    const nextPersona  = new Set(personaSlugs)
    const nextBlocked  = new Set(blockedSlugs)
    nextPersona.delete(slug)
    nextBlocked.add(slug)
    saveUserRemovedSlug(versionId, slug)
    setPersonaSlugs(nextPersona)
    setBlockedSlugs(nextBlocked)
    onChangeRef.current?.([...nextPersona], [...nextBlocked])
    try {
      await setVersionBlockedConnectors(repoId, versionId, [...nextBlocked])
      const displayName = linked.find(c => c.slug === slug)?.display_name ?? slug
      const agentLabel  = personaName ? ` for ${personaName}` : ''
      toast.success(`${displayName} removed${agentLabel}`)
    } catch (err) {
      setPersonaSlugs(prevPersona)
      setBlockedSlugs(prevBlocked)
      onChangeRef.current?.([...prevPersona], [...prevBlocked])
      toast.error(err instanceof Error ? err.message : 'Failed to remove connector')
    } finally {
      setSavingSlug(null)
    }
  }, [repoId, versionId, personaSlugs, blockedSlugs, linked, personaName])

  // Filter by search query
  const matchesSearch = useCallback((c: ConnectorCatalogEntry) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const enabledForPersona  = linked.filter(c => personaSlugs.has(c.slug) && matchesSearch(c))
  const disabledForPersona = linked.filter(c => !personaSlugs.has(c.slug) && matchesSearch(c))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', paddingTop: 3 }}>

      {/* ── Confirm-remove dialog ───────────────────────────────────────── */}
      {confirmSlug && (() => {
        const entry = linked.find(c => c.slug === confirmSlug)
        const displayName = entry?.display_name ?? confirmSlug
        return (
          <>
            {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop */}
            <div
              onClick={() => setConfirmSlug(null)}
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
                  Remove {displayName}?
                </p>
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
                  This will disable <strong>{displayName}</strong> for this agent. Are you sure you want to remove this connector access?.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant="outline" size="sm" onClick={() => setConfirmSlug(null)}>Cancel</Button>
                <Button variant="danger" size="sm" onClick={() => void doDisable(confirmSlug)}>
                  Remove
                </Button>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Manage-in-settings navigation modal ────────────────────────── */}
      {showNavModal && (
        <>
          {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop */}
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
          // eslint-disable-next-line react-doctor/no-outline-none -- focus-visible handled globally
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
            <div style={{ height: 22, width: 220, borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
            <div style={{ backgroundColor: 'var(--neutral-50)', borderRadius: 10 }}>
              {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 22, width: 160, borderRadius: 4, backgroundColor: 'var(--neutral-100)' }} />
            <div style={{ backgroundColor: 'var(--neutral-50)', borderRadius: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
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
      ) : (
        <>
          {/* ── Section 1: Connectors enabled for this agent ──────────────── */}
          <section data-help-id="help-connectors-enabled" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={SECTION_LABEL}>Connectors enabled for this agent</p>
            {linked.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 12px' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
                  No connectors have been connected yet. Activate connectors in Settings to use them in this persona.
                </p>
                <button
                  onClick={() => push('/settings/connectors')}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--neutral-200)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)' }}
                >
                  Go to Settings
                </button>
              </div>
            ) : enabledForPersona.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0, padding: '16px 12px' }}>
                {searchQuery
                  ? `No enabled connectors match "${searchQuery}".`
                  : 'All connected connectors have been disabled for this persona.'}
              </p>
            ) : (
              <div style={{ backgroundColor: 'var(--neutral-50, #f7f2ed)', borderRadius: 10, overflow: 'hidden' }}>
                {enabledForPersona.map(c => (
                  <PersonaConnectorRow
                    key={c.slug}
                    entry={c}
                    enabled
                    saving={savingSlug === c.slug}
                    onToggle={() => void handleToggle(c.slug)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Connectors disabled for this agent ─────────────── */}
          {disabledForPersona.length > 0 && (
            <section data-help-id="help-connectors-disabled" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={SECTION_LABEL}>Connectors disabled for this agent</p>
              {disabledForPersona.length === 0 && searchQuery ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0, padding: '16px 12px' }}>
                  No disabled connectors match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <div style={{ backgroundColor: 'var(--neutral-50, #f7f2ed)', borderRadius: 10, overflow: 'hidden' }}>
                  {disabledForPersona.map(c => (
                    <PersonaConnectorRow
                      key={c.slug}
                      entry={c}
                      enabled={false}
                      saving={savingSlug === c.slug}
                      onToggle={() => void handleToggle(c.slug)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
