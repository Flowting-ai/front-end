'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import {
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Popover } from '@/components/Popover'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import {
  getTeam,
  updateTeam,
  archiveTeam,
  deleteTeam,
  listTeamEditors,
  addTeamEditor,
  removeTeamEditor,
  inviteTeamMembers,
  listTeamConnectors,
  requestTeamConnector,
  setTeamConnectorStatus,
  deleteTeamConnector,
  listTeamConnections,
  attachSharedAccount,
  updateTeamConnectionPermissions,
  unlinkTeamConnection,
  type TeamConnectorRequest,
  type TeamConnectionEntry,
} from '@/lib/api/teams'
import { listMembers } from '@/lib/api/organization'
import { listConnectors, listOrgCatalog } from '@/lib/api/connectors'
import type { ConnectorCatalogEntry, ConnectorTool } from '@/lib/api/connectors'
import type { Team, TeamEditor, OrgMember } from '@/types/teams'
import { toast } from 'sonner'

const EDITOR_COLUMNS = '1fr 1fr 160px'
const EDITOR_COLUMN_GAP = 0

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <section style={{
      border:        `1px solid ${danger ? 'var(--red-400)' : 'var(--neutral-200)'}`,
      borderRadius:  16,
      boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
      gap:           12,
      padding:       '12px 0',
    }}>
      {children}
    </section>
  )
}

function CardHeader({ title, subtitle, danger = false, compact = false }: {
  title: string; subtitle?: string; danger?: boolean; compact?: boolean
}) {
  return (
    <div style={{ padding: compact ? '6px 24px 12px' : '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: danger ? 'var(--red-400)' : 'var(--neutral-900)', margin: 0 }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function MemberAvatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      backgroundColor: 'var(--blue-600)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0px 0px 0px 1px var(--blue-100)',
    }}>
      <UserIcon size={20} color="white" />
    </div>
  )
}

function Bone({ w, h = 14, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return (
    <div aria-hidden className="kaya-skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
  )
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function EditorCell({ editor }: { editor: TeamEditor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <MemberAvatar />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {editor.name ?? editor.userId}
        </p>
        {editor.email && (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editor.email}
          </p>
        )}
      </div>
    </div>
  )
}

function RedOutlineButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '5px 8px', borderRadius: 8, border: 'none', cursor: disabled ? 'default' : 'pointer',
        backgroundColor: 'white', opacity: disabled ? 0.5 : 1,
        boxShadow: '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
        fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
        color: 'var(--red-700)', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Invite modal (inline, simple) ─────────────────────────────────────────────

function InvitePanel({ onInvite, onClose }: {
  onInvite: (emails: string[]) => Promise<void>
  onClose: () => void
}) {
  const [raw, setRaw] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    if (!emails.length) return
    setSending(true)
    try {
      await onInvite(emails)
      setRaw('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
        Invite members
      </p>
      <InputField
        value={raw}
        onChange={setRaw}
        placeholder="email@example.com, another@example.com"
        fluid
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" disabled={!raw.trim() || sending} onClick={handleSend}>
          {sending ? 'Sending…' : 'Send invites'}
        </Button>
      </div>
    </div>
  )
}

// ── Add-editor panel ──────────────────────────────────────────────────────────

function AddEditorPanel({ orgId, existingEditorIds, onAdd, onClose }: {
  orgId: string
  existingEditorIds: Set<string>
  onAdd: (userId: string) => Promise<void>
  onClose: () => void
}) {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [selected, setSelected] = useState<OrgMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    listMembers(orgId)
      .then(all => setMembers(
        all.filter(m =>
          m.inviteStatus !== 'invite_sent' &&
          m.orgRole !== 'owner' &&
          m.orgRole !== 'admin' &&
          !existingEditorIds.has(m.id)
        )
      ))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId, existingEditorIds])

  useEffect(() => {
    if (dropOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [dropOpen])

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return
      setDropOpen(false)
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [dropOpen])

  const handleAdd = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await onAdd(selected.id)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add editor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
        Add existing member as editor
      </p>
      {loading ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>Loading members…</p>
      ) : members.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>Everyone eligible is already an editor of this team.</p>
      ) : (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropOpen(o => !o)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14,
              color: selected ? 'var(--neutral-900)' : 'var(--neutral-400)',
              border: '1px solid var(--neutral-200)', borderRadius: 8,
              padding: '8px 12px', backgroundColor: 'white', cursor: 'pointer',
              width: '100%', textAlign: 'left',
            }}
          >
            {selected ? (selected.name || selected.email) : 'Select a member…'}
          </button>
          {dropOpen && pos && createPortal(
            <AnimatePresence>
              <motion.div
                ref={panelRef}
                style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 300 }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.12 } }}
              >
                <Popover variant="dropdown" style={{ width: '100%' }}>
                  {members.map(m => (
                    <DropdownMenuItem
                      key={m.id}
                      fluid
                      label={m.name || m.email}
                      subLabel={m.name ? m.email : undefined}
                      selected={selected?.id === m.id}
                      onClick={() => { setSelected(m); setDropOpen(false) }}
                    />
                  ))}
                </Popover>
              </motion.div>
            </AnimatePresence>,
            document.body
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" disabled={!selected || saving || loading} onClick={handleAdd}>
          {saving ? 'Adding…' : 'Add editor'}
        </Button>
      </div>
    </div>
  )
}

// ── Team connectors card ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<TeamConnectorRequest['status'], string> = {
  pending:  'var(--yellow-600)',
  approved: 'var(--green-600)',
  denied:   'var(--red-600)',
}

function ConnectorStatusBadge({ status }: { status: TeamConnectorRequest['status'] }) {
  return (
    <span style={{
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11,
      color: STATUS_COLORS[status],
      padding: '2px 7px', borderRadius: 6,
      border: `1px solid ${STATUS_COLORS[status]}40`,
      backgroundColor: `${STATUS_COLORS[status]}10`,
      whiteSpace: 'nowrap',
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function TeamConnectorsCard({ orgId, teamId, isAdmin }: { orgId: string; teamId: string; isAdmin: boolean }) {
  const [connectors,   setConnectors]   = useState<TeamConnectorRequest[]>([])
  const [loading,      setLoading]      = useState(true)
  const [requestOpen,  setRequestOpen]  = useState(false)
  // Full visible catalog — loaded on mount for display_name lookup and picker filtering.
  const [catalog,      setCatalog]      = useState<ConnectorCatalogEntry[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [note,         setNote]         = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [conns, cat] = await Promise.all([
          listTeamConnectors(orgId, teamId),
          // Admins use the org catalog so they see all connectors with org_enabled status.
          // Non-admins use the personal catalog, which is already pre-filtered.
          isAdmin ? listOrgCatalog(orgId) : listConnectors(),
        ])
        if (cancelled) return
        setConnectors(conns)
        setCatalog(cat)
      } catch (err) {
        if (!cancelled) console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [orgId, teamId, isAdmin])

  // Resolve display name from catalog; falls back to slug if catalog not yet loaded.
  const displayName = (slug: string) =>
    catalog.find(c => c.slug === slug)?.display_name ?? slug

  // Connectors available to request:
  // - Exclude connectors already pending/approved (denied rows can be re-requested).
  const requestableCatalog = catalog
    .filter(c => !connectors.some(tc => tc.connectorSlug === c.slug && tc.status !== 'denied'))

  const handleOpenRequest = () => {
    setRequestOpen(true)
  }

  const handleRequest = async () => {
    if (!selectedSlug) return
    setSubmitting(true)
    try {
      const req = await requestTeamConnector(orgId, teamId, selectedSlug, note || undefined)
      setConnectors(prev => {
        // Replace if re-requesting a denied row, otherwise append.
        const idx = prev.findIndex(c => c.connectorSlug === req.connectorSlug)
        return idx >= 0 ? prev.map((c, i) => (i === idx ? req : c)) : [...prev, req]
      })
      setSelectedSlug('')
      setNote('')
      setRequestOpen(false)
      toast.success(isAdmin ? 'Connector approved for team' : 'Connector request sent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request connector')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetStatus = async (slug: string, status: TeamConnectorRequest['status']) => {
    try {
      const updated = await setTeamConnectorStatus(orgId, teamId, slug, status)
      setConnectors(prev => prev.map(c => c.connectorSlug === slug ? updated : c))
      toast.success(`Connector ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update connector')
    }
  }

  const handleDelete = async (slug: string) => {
    try {
      await deleteTeamConnector(orgId, teamId, slug)
      setConnectors(prev => prev.filter(c => c.connectorSlug !== slug))
      toast.success('Connector removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove connector')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Team Connectors"
        subtitle="Connectors approved for this team. Members can request access to connectors for team use."
      />
      <div style={{ padding: '6px 24px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={handleOpenRequest}>
            Request connector
          </Button>
        </div>

        {requestOpen && (
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
              {isAdmin ? 'Add connector (auto-approved)' : 'Request connector for team'}
            </p>
            {requestableCatalog.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: 0 }}>
                {loading
                  ? 'Loading…'
                  : isAdmin
                    ? 'All org-enabled connectors are already added to this team. Enable more connectors in Org → Connectors.'
                    : 'No connectors available to request. All org-enabled connectors are already pending or approved for this team.'}
              </p>
            ) : (
              <>
                <select
                  value={selectedSlug}
                  onChange={e => setSelectedSlug(e.target.value)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-900)', border: '1px solid var(--neutral-200)', borderRadius: 8, padding: '8px 12px', backgroundColor: 'white', width: '100%' }}
                >
                  <option value="">Select connector…</option>
                  {requestableCatalog.map(c => (
                    <option key={c.slug} value={c.slug}>{c.display_name}</option>
                  ))}
                </select>
                <InputField value={note} onChange={setNote} placeholder="Optional note for admin…" fluid />
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setRequestOpen(false)}>Cancel</Button>
              {requestableCatalog.length > 0 && (
                <Button variant="default" size="sm" disabled={!selectedSlug || submitting} onClick={handleRequest}>
                  {submitting ? 'Sending…' : isAdmin ? 'Add' : 'Request'}
                </Button>
              )}
            </div>
          </div>
        )}

        {loading && <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading…</p>}
        {!loading && connectors.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No connectors yet.</p>
        )}
        {connectors.map(c => (
          <div key={c.connectorSlug} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                {displayName(c.connectorSlug)}
              </p>
              {c.note && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0 }}>{c.note}</p>}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-400)', margin: 0 }}>
                Requested by {c.requestedByName ?? c.requestedByUserId}
              </p>
            </div>
            <ConnectorStatusBadge status={c.status} />
            {isAdmin && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {c.status !== 'approved' && (
                  <button type="button" onClick={() => handleSetStatus(c.connectorSlug, 'approved')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--green-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--green-700)', fontWeight: 500 }}>
                    Approve
                  </button>
                )}
                {c.status !== 'denied' && (
                  <button type="button" onClick={() => handleSetStatus(c.connectorSlug, 'denied')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--red-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red-700)', fontWeight: 500 }}>
                    Deny
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(c.connectorSlug)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)' }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Team connections (shared accounts per connector) ──────────────────────────

const POLICY_LABELS: Record<ConnectorTool['policy'], string> = {
  allow:      'Allow',
  ask:        'Ask',
  block:      'Block',
  allow_once: 'Allow once',
}

function TeamConnectionsCard({ orgId, teamId, canEdit }: { orgId: string; teamId: string; canEdit: boolean }) {
  const [connections,   setConnections]   = useState<TeamConnectionEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  // Which connector's attach form is open
  const [attachingSlug, setAttachingSlug] = useState<string | null>(null)
  const [selectedAcct,  setSelectedAcct]  = useState('')
  const [attaching,     setAttaching]     = useState(false)
  // Which connector's permissions panel is expanded
  const [expandedPerms, setExpandedPerms] = useState<string | null>(null)
  // Local permission edits keyed by connector slug — only present when user has made changes
  const [pendingPerms,  setPendingPerms]  = useState<Record<string, ConnectorTool[]>>({})
  const [savingPerms,   setSavingPerms]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadConnections() {
      setLoading(true)
      try {
        const rows = await listTeamConnections(orgId, teamId)
        if (!cancelled) setConnections(rows)
      } catch (err) {
        if (!cancelled) console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadConnections()
    return () => {
      cancelled = true
    }
  }, [orgId, teamId])

  const handleOpenAttach = (slug: string) => {
    setAttachingSlug(prev => prev === slug ? null : slug)
    setSelectedAcct('')
  }

  const handleAttach = async () => {
    if (!attachingSlug || !selectedAcct) return
    setAttaching(true)
    try {
      const updated = await attachSharedAccount(orgId, teamId, attachingSlug, selectedAcct)
      setConnections(prev => prev.map(c => c.slug === updated.slug ? updated : c))
      toast.success('Shared account attached')
      setAttachingSlug(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach account')
    } finally {
      setAttaching(false)
    }
  }

  const handleUnlink = async (slug: string) => {
    try {
      await unlinkTeamConnection(orgId, teamId, slug)
      setConnections(prev => prev.map(c =>
        c.slug === slug
          ? { ...c, workspaceLinked: false, sharedAccountId: null, accountLabel: null, accountIdentifier: null, workspaceLinkedBy: null }
          : c,
      ))
      toast.success('Connection unlinked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink connection')
    }
  }

  const handlePolicyChange = (connSlug: string, toolSlug: string, policy: ConnectorTool['policy']) => {
    setPendingPerms(prev => {
      const base = prev[connSlug] ?? connections.find(c => c.slug === connSlug)?.tools ?? []
      return {
        ...prev,
        [connSlug]: base.map(t => t.slug === toolSlug ? { ...t, policy } : t),
      }
    })
  }

  const handleSavePerms = async (slug: string) => {
    const perms = pendingPerms[slug]
    if (!perms) return
    setSavingPerms(slug)
    try {
      const updated = await updateTeamConnectionPermissions(orgId, teamId, slug, perms)
      setConnections(prev => prev.map(c => c.slug === updated.slug ? updated : c))
      setPendingPerms(prev => { const next = { ...prev }; delete next[slug]; return next })
      toast.success('Permissions saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save permissions')
    } finally {
      setSavingPerms(null)
    }
  }

  const handleCancelPerms = (slug: string) => {
    setPendingPerms(prev => { const next = { ...prev }; delete next[slug]; return next })
  }

  const approvedConnections = connections.filter(c => c.status === 'approved')

  return (
    <Card>
      <CardHeader
        title="Team Connections"
        subtitle="Shared accounts assigned to this team and tool permission policies per connector."
      />
      <div style={{ padding: '6px 24px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {loading && <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading…</p>}
        {!loading && approvedConnections.length === 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
            No approved connectors yet. Approve connectors above first.
          </p>
        )}

        {approvedConnections.map(c => {
          const isAttachOpen  = attachingSlug === c.slug
          const isPermsOpen   = expandedPerms === c.slug
          const currentPerms  = pendingPerms[c.slug] ?? c.tools
          const hasEdits      = pendingPerms[c.slug] !== undefined
          const attachableAccts = c.accounts.filter(a => a.connected && a.status === 'active')

          const accountLine = c.workspaceLinked
            ? [c.accountLabel, c.accountIdentifier].filter(Boolean).join(' · ') || c.sharedAccountId
            : 'No shared account attached'

          return (
            <div key={c.slug} style={{ borderBottom: '1px solid var(--neutral-100)', padding: '10px 0' }}>

              {/* ── Connection row ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: '1 0 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                    {c.displayName}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: c.workspaceLinked ? 'var(--neutral-600)' : 'var(--neutral-400)', margin: 0 }}>
                    {accountLine}
                  </p>
                </div>

                {c.workspaceLinked && (
                  <span style={{
                    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11,
                    color: 'var(--green-600)', padding: '2px 7px', borderRadius: 6,
                    border: '1px solid var(--green-200)', backgroundColor: 'var(--green-50)',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    Connected
                  </span>
                )}

                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenAttach(c.slug)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)', fontWeight: 500 }}
                    >
                      {c.workspaceLinked ? 'Change' : 'Attach account'}
                    </button>
                    {c.workspaceLinked && (
                      <button
                        type="button"
                        onClick={() => handleUnlink(c.slug)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--red-200)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red-700)', fontWeight: 500 }}
                      >
                        Unlink
                      </button>
                    )}
                    {c.tools.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedPerms(isPermsOpen ? null : c.slug)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)', background: isPermsOpen ? 'var(--neutral-100)' : 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)' }}
                      >
                        Permissions
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Attach shared account form ── */}
              {isAttachOpen && (
                <div style={{ marginTop: 8, border: '1px solid var(--neutral-200)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                    Attach shared account for <strong>{c.displayName}</strong>
                  </p>
                  {c.accounts.length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
                      No shared accounts found for this connector. Create one in Org → Connectors.
                    </p>
                  ) : (
                    <select
                      value={selectedAcct}
                      onChange={e => setSelectedAcct(e.target.value)}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-900)', border: '1px solid var(--neutral-200)', borderRadius: 8, padding: '8px 12px', backgroundColor: 'white', width: '100%' }}
                    >
                      <option value="">Select shared account…</option>
                      {c.accounts.map(a => {
                        const unavailable = !a.connected || a.status !== 'active'
                        const label = [a.accountLabel, a.accountIdentifier ? `(${a.accountIdentifier})` : ''].filter(Boolean).join(' ')
                        const suffix = !a.connected ? ' — Not connected' : a.status !== 'active' ? ` — ${a.status}` : ''
                        return (
                          <option key={a.id} value={a.id} disabled={unavailable}>
                            {label}{suffix}
                          </option>
                        )
                      })}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button variant="outline" size="sm" onClick={() => setAttachingSlug(null)}>Cancel</Button>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={!selectedAcct || attaching || attachableAccts.length === 0}
                      onClick={() => void handleAttach()}
                    >
                      {attaching ? 'Attaching…' : 'Attach'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Permissions editor ── */}
              {isPermsOpen && c.tools.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid var(--neutral-200)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-700)', margin: 0 }}>
                    Tool permissions
                  </p>
                  {currentPerms.map(t => (
                    <div key={t.slug} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <p style={{ flex: '1 0 0', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--neutral-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.slug}
                      </p>
                      <select
                        value={t.policy}
                        onChange={e => handlePolicyChange(c.slug, t.slug, e.target.value as ConnectorTool['policy'])}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-900)', border: '1px solid var(--neutral-200)', borderRadius: 6, padding: '4px 8px', backgroundColor: 'white', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {(Object.keys(POLICY_LABELS) as ConnectorTool['policy'][]).map(p => (
                          <option key={p} value={p}>{POLICY_LABELS[p]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {hasEdits && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <Button variant="outline" size="sm" onClick={() => handleCancelPerms(c.slug)}>Cancel</Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={savingPerms === c.slug}
                        onClick={() => void handleSavePerms(c.slug)}
                      >
                        {savingPerms === c.slug ? 'Saving…' : 'Save permissions'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamSettingsPage() {
  const params = useParams<{ teamId: string }>()
  const router = useRouter()
  const { orgId, refreshTeams, orgRole } = useOrg()
  const { user } = useAuth()
  const isAdmin = orgRole === 'owner' || orgRole === 'admin'

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [editors, setEditors] = useState<TeamEditor[]>([])
  const [editorsLoading, setEditorsLoading] = useState(true)

  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [addEditorOpen, setAddEditorOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    const routeTeamId = params.teamId
    if (!orgId || !routeTeamId) return
    const currentOrgId: string = orgId
    const teamId: string = routeTeamId
    let cancelled = false

    async function loadTeam() {
      setLoading(true)
      try {
        const t = await getTeam(currentOrgId, teamId)
        if (cancelled) return
        setTeam(t)
        setTeamName(t.name)
        setTeamDesc(t.description)
      } catch {
        if (!cancelled) setTeam(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTeam()
    return () => {
      cancelled = true
    }
  }, [orgId, params.teamId])

  useEffect(() => {
    const routeTeamId = params.teamId
    if (!orgId || !routeTeamId) return
    const currentOrgId: string = orgId
    const teamId: string = routeTeamId
    let cancelled = false

    async function loadEditors() {
      setEditorsLoading(true)
      try {
        const rows = await listTeamEditors(currentOrgId, teamId)
        if (!cancelled) setEditors(rows)
      } catch (err) {
        if (!cancelled) console.error(err)
      } finally {
        if (!cancelled) setEditorsLoading(false)
      }
    }

    void loadEditors()
    return () => {
      cancelled = true
    }
  }, [orgId, params.teamId])

  const handleSave = async () => {
    if (!orgId || !team) return
    setSaving(true)
    try {
      const updated = await updateTeam(orgId, team.id, { name: teamName, description: teamDesc })
      setTeam(updated)
      refreshTeams()
      toast.success('Team updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update team')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!orgId || !team) return
    try {
      await archiveTeam(orgId, team.id)
      refreshTeams()
      router.push('/org/teams')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive team')
    }
  }

  const handleDelete = async () => {
    if (!orgId || !team || deleteInput !== team.name) return
    try {
      await deleteTeam(orgId, team.id)
      refreshTeams()
      router.push('/org/teams')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete team')
    }
  }

  const handleRemoveEditor = async (memberId: string) => {
    if (!orgId || !team) return
    try {
      await removeTeamEditor(orgId, team.id, memberId)
      setEditors(prev => prev.filter(e => e.userId !== memberId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleInvite = async (emails: string[]) => {
    if (!orgId || !team) return
    await inviteTeamMembers(orgId, team.id, emails)
    toast.success(`Invite sent to ${emails.length} email${emails.length > 1 ? 's' : ''}`)
  }

  const handleAddEditor = async (userId: string) => {
    if (!orgId || !team) return
    const editor = await addTeamEditor(orgId, team.id, userId)
    setEditors(prev => [...prev, editor])
    toast.success('Editor added')
  }

  const canManageConnections =
    isAdmin ||
    (!!user?.email && editors.some(e => e.email?.toLowerCase() === user.email!.toLowerCase()))

  if (loading) {
    return (
      <div
        className="kaya-scrollbar"
        style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}
        aria-busy="true"
      >
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1114 }}>

          {/* Page header */}
          <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone w={80} h={11} r={4} />
            <Bone w={220} h={28} r={8} />
            <Bone w="55%" h={14} />
          </div>

          {/* Team identity card */}
          <SkeletonCard>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
              <Bone w={120} h={16} />
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {[0, 1].map(i => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Bone w={80} h={12} />
                    <Bone w="100%" h={36} r={8} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Bone w={110} h={34} r={8} />
              </div>
            </div>
          </SkeletonCard>

          {/* Team members table */}
          <SkeletonCard>
            {/* Toolbar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Bone w={140} h={16} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Bone w={32} h={32} r={8} />
                <Bone w={32} h={32} r={8} />
                <Bone w={110} h={32} r={8} />
                <Bone w={130} h={32} r={8} />
              </div>
            </div>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', padding: '8px 16px', borderBottom: '1px solid var(--neutral-100)' }}>
              <Bone w={60} h={12} />
              <Bone w={50} h={12} />
              <Bone w={50} h={12} style={{ marginLeft: 'auto', marginRight: 'auto' }} />
            </div>
            {/* Rows */}
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', alignItems: 'center', padding: '12px 16px', borderBottom: i < 2 ? '1px solid var(--neutral-100)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bone w={36} h={36} r={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Bone w={100} h={13} />
                    <Bone w={140} h={11} />
                  </div>
                </div>
                <Bone w={160} h={13} />
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Bone w={70} h={28} r={8} />
                </div>
              </div>
            ))}
          </SkeletonCard>

          {/* Team connectors card */}
          <SkeletonCard>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Bone w={150} h={16} />
                <Bone w="60%" h={12} />
              </div>
              <Bone w={150} h={34} r={8} />
            </div>
            <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: i < 1 ? '1px solid var(--neutral-100)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bone w={32} h={32} r={6} />
                    <Bone w={120} h={14} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Bone w={60} h={22} r={6} />
                    <Bone w={80} h={28} r={8} />
                    <Bone w={70} h={28} r={8} />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonCard>

          {/* Team connections card */}
          <SkeletonCard>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
              <Bone w={160} h={16} />
              <Bone w="50%" h={12} style={{ marginTop: 6 }} />
            </div>
            <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: i < 1 ? '1px solid var(--neutral-100)' : undefined }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <Bone w={130} h={14} />
                    <Bone w={180} h={12} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Bone w={90} h={22} r={6} />
                    <Bone w={110} h={28} r={8} />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonCard>

          {/* Danger zone card */}
          <SkeletonCard>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
              <Bone w={110} h={16} />
              <Bone w="45%" h={12} style={{ marginTop: 6 }} />
            </div>
            {[0, 1].map(i => (
              <div key={i} style={{ padding: '16px 24px', borderBottom: i < 1 ? '1px solid var(--neutral-100)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Bone w={100} h={14} />
                  <Bone w={280} h={12} />
                </div>
                <Bone w={90} h={32} r={8} />
              </div>
            ))}
          </SkeletonCard>

        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Team not found.</p>
      </div>
    )
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '64px 24px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1114 }}>
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => router.push('/org/teams')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: 0, marginBottom: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 400,
              fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)',
            }}
          >
            ← All teams
          </button>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            {team.name}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage this team name, members, and settings.
          </p>
        </div>

        <Card>
          <CardHeader title="Team identity" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '6px 24px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <InputField label="Team name" value={teamName} onChange={setTeamName} fluid />
              <InputField label="Description" value={teamDesc} onChange={setTeamDesc} fluid />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="default" size="sm" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </Card>

        <SettingsTable>
          <SettingsTableToolbar title="Team Members">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconButton variant="ghost" size="sm" aria-label="Search members" icon={<SearchOneIcon size={20} />} />
                <IconButton variant="ghost" size="sm" aria-label="Filter members" icon={<FilterMailIcon size={20} />} />
              </div>
              <Button variant="outline" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => { setAddEditorOpen(o => !o); setInviteOpen(false) }}>
                Add editor
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => { setInviteOpen(o => !o); setAddEditorOpen(false) }}>
                Invite members
              </Button>
            </div>
          </SettingsTableToolbar>

          <SettingsTableHeader columns={EDITOR_COLUMNS} columnGap={EDITOR_COLUMN_GAP}>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Email</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {editorsLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading members…</p>
            </div>
          )}

          {!editorsLoading && editors.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No members yet.</p>
            </div>
          )}

          {editors.map((editor, index) => (
            <SettingsTableRow
              key={editor.userId}
              columns={EDITOR_COLUMNS}
              columnGap={EDITOR_COLUMN_GAP}
              divider={index < editors.length - 1}
            >
              <SettingsTableCell>
                <EditorCell editor={editor} />
              </SettingsTableCell>
              <SettingsTableCell>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
                  {editor.email ?? '—'}
                </span>
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <RedOutlineButton onClick={() => handleRemoveEditor(editor.userId)}>Remove</RedOutlineButton>
              </SettingsTableCell>
            </SettingsTableRow>
          ))}

          {addEditorOpen && orgId && (
            <AddEditorPanel
              orgId={orgId}
              existingEditorIds={new Set(editors.map(e => e.userId))}
              onAdd={handleAddEditor}
              onClose={() => setAddEditorOpen(false)}
            />
          )}
          {inviteOpen && (
            <InvitePanel
              onInvite={handleInvite}
              onClose={() => setInviteOpen(false)}
            />
          )}
        </SettingsTable>

        {orgId && (
          <TeamConnectorsCard
            orgId={orgId}
            teamId={team.id}
            isAdmin={isAdmin}
          />
        )}

        {orgId && (
          <TeamConnectionsCard
            orgId={orgId}
            teamId={team.id}
            canEdit={canManageConnections}
          />
        )}

        <Card danger>
          <CardHeader title="Danger Zone" subtitle="Actions here are permanent and cannot be undone." danger compact />

          <div style={{ padding: '6px 24px 12px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Archive team
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                  This will archive the team and all its projects. Members can no longer access team content.
                </p>
              </div>
              <RedOutlineButton onClick={handleArchive}>Archive</RedOutlineButton>
            </div>
          </div>

          <div style={{ padding: '6px 24px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                  Delete team
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, maxWidth: 395 }}>
                  Permanently delete this team and all its data. This cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <InputField
                  value={deleteInput}
                  onChange={setDeleteInput}
                  placeholder={`Type "${team.name}" to confirm`}
                />
                <RedOutlineButton disabled={deleteInput !== team.name} onClick={handleDelete}>
                  Delete team
                </RedOutlineButton>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
