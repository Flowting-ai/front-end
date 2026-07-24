'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PlusSignIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { ConnectorStatusBadge } from '@/components/ConnectorStatusBadge'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
  SettingsTableFooter,
  SettingsTableViewport,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import {
  getTeam,
  listTeamEditors,
  listTeamConnectors,
  listTeamConnectorCatalog,
  requestTeamConnector,
  listTeamConnections,
  attachSharedAccount,
  unlinkTeamConnection,
  resolveViewerUserId,
  type TeamConnectorRequest,
  type TeamConnectionEntry,
} from '@/lib/api/teams'
import { fetchProjects, createProjectApi, type ApiProjectSummary } from '@/lib/api/projects'
import { listAudit } from '@/lib/api/organization'
import { toConnector } from '@/lib/connector'
import { CHAT_ROUTE } from '@/lib/routes'
import type { Team, AuditLogEntry } from '@/types/teams'

type TeamTab = 'projects' | 'connectors' | 'requests' | 'activity'

// ── Shared chrome ─────────────────────────────────────────────────────────────

// Connector logo in the design-system icon-box chrome (white box, rounded, hairline
// ring); falls back to initials when no logo resolves.
function ConnectorIcon({ slug, name }: { slug: string; name: string }) {
  const src = toConnector(slug).logo
  const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--neutral-white)',
      boxShadow: '0px 0px 0px 1px var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, color: 'var(--neutral-600)',
      overflow: 'hidden',
    }}>
      {src ? <Image src={src} alt="" width={20} height={20} unoptimized style={{ display: 'block' }} /> : (initials || '?')}
    </div>
  )
}

const cellTitle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const cellSub: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-500)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

function EmptyRow({ text }: { text: string }) {
  return (
    <SettingsTableRow divider={false} columns="1fr">
      <SettingsTableCell>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)' }}>{text}</span>
      </SettingsTableCell>
    </SettingsTableRow>
  )
}

// ── Members ───────────────────────────────────────────────────────────────────

// ── Projects ──────────────────────────────────────────────────────────────────

const PROJECT_COLS = 'minmax(280px,1fr) 100px 150px 160px'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

function ProjectsTab({ teamId, userId }: { teamId: string; userId: string }) {
  const [projects, setProjects] = useState<ApiProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchProjects()
      .then(all => { if (!cancelled) setProjects(all.filter(p => p.teamId === teamId)) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId])

  const handleCreate = async () => {
    const name = title.trim()
    if (!name) return
    setSaving(true)
    try {
      const created = await createProjectApi({ title: name, teamId })
      setProjects(prev => [{
        id: created.id, ownerUserId: created.ownerUserId ?? userId, teamId: created.teamId,
        visibility: created.visibility, canEdit: created.canEdit, canManageVisibility: created.canManageVisibility,
        title: created.title, description: created.description, updatedAt: created.updatedAt, chatCount: 0,
      } as ApiProjectSummary, ...prev])
      setTitle('')
      setCreating(false)
      toast.success('Project created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsTable columns={PROJECT_COLS}>
      <SettingsTableToolbar title="Team projects">
        <Button variant="secondary" size="sm" leftIcon={<PlusSignIcon size={14} />} onClick={() => setCreating(v => !v)}>
          New project
        </Button>
      </SettingsTableToolbar>

      {creating && (
        <SettingsTableRow columns="1fr auto" minHeight={64} divider>
          <InputField label="" value={title} onChange={setTitle} placeholder="e.g. Q3 Campaign" />
          <Button size="sm" disabled={!title.trim() || saving} onClick={handleCreate}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </SettingsTableRow>
      )}

      <SettingsTableViewport minWidth={760} ariaLabel="Team projects">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Project</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="center">Chats</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Last updated</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">Project members</SettingsTableHeaderCell>
        </SettingsTableHeader>

        {loading && <EmptyRow text="Loading…" />}
        {!loading && projects.length === 0 && <EmptyRow text="No projects in this team yet." />}
        {projects.map((p, index) => (
          <React.Fragment key={p.id}>
            <SettingsTableRow minHeight={64} divider={open !== p.id && index < projects.length - 1}>
              <SettingsTableCell>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...cellTitle, fontSize: 14, lineHeight: '22px' }}>{p.title}</p>
                  <p style={{ ...cellSub, lineHeight: '16px' }}>{p.description || 'No description'}</p>
                </div>
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <span style={{ ...cellTitle, fontSize: 14, lineHeight: '22px' }}>{p.chatCount.toLocaleString()}</span>
              </SettingsTableCell>
              <SettingsTableCell>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>{formatDate(p.updatedAt)}</span>
              </SettingsTableCell>
              <SettingsTableCell align="end">
                <Button variant="outline" size="sm" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  {open === p.id ? 'Hide members' : 'Manage members'}
                </Button>
              </SettingsTableCell>
            </SettingsTableRow>
            {open === p.id && (
              <div style={{ background: 'var(--neutral-50)', borderBottom: index < projects.length - 1 ? '1px solid var(--neutral-100)' : undefined }}>
                <ProjectMembersPanel teamId={teamId} projectId={p.id} ownerUserId={p.ownerUserId} />
              </div>
            )}
          </React.Fragment>
        ))}
      </SettingsTableViewport>
    </SettingsTable>
  )
}

// ── Shared-account connections ──────────────────────────────────────────────────

const CONN_COLS = 'minmax(220px,1fr) minmax(180px,.8fr) 120px 170px'

function ConnectorsTab({ orgId, teamId, canLink }: { orgId: string; teamId: string; canLink: boolean }) {
  const [connections, setConnections] = useState<TeamConnectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const reload = useCallback(() => {
    listTeamConnections(orgId, teamId)
      .then(setConnections)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId, teamId])
  useEffect(() => { reload() }, [reload])

  const handleAttach = async (slug: string) => {
    if (!selectedAccount) return
    setBusy(slug)
    try {
      await attachSharedAccount(orgId, teamId, slug, selectedAccount)
      toast.success('Shared account linked')
      setPicking(null)
      setSelectedAccount('')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link account')
    } finally {
      setBusy(null)
    }
  }

  const handleUnlink = async (slug: string) => {
    setBusy(slug)
    try {
      await unlinkTeamConnection(orgId, teamId, slug)
      toast.success('Shared account disabled for this team')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable account')
    } finally {
      setBusy(null)
    }
  }

  return (
    <SettingsTable columns={CONN_COLS} columnGap={24}>
      <SettingsTableToolbar
        title="Shared connector accounts"
        style={{ borderBottom: 'none', paddingBottom: 4, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
      >
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
          {canLink
            ? 'Link an org shared account to this team, or disable one.'
            : 'You can disable shared accounts. Ask an admin for permission to link new ones.'}
        </span>
      </SettingsTableToolbar>

      <SettingsTableViewport minWidth={860} ariaLabel="Team connector accounts">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Connector</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Shared account</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="center">Status</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">Action</SettingsTableHeaderCell>
        </SettingsTableHeader>

        {loading && <EmptyRow text="Loading…" />}
        {!loading && connections.length === 0 && <EmptyRow text="No connectors available for this team yet." />}
        {connections.map((c, index) => {
          const attachable = c.accounts.filter(a => a.connected && a.status === 'active')
          return (
            <React.Fragment key={c.slug}>
              <SettingsTableRow divider={picking !== c.slug && index < connections.length - 1}>
                <SettingsTableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <ConnectorIcon slug={c.slug} name={c.displayName} />
                    <div style={{ minWidth: 0 }}>
                      <p style={cellTitle}>{c.displayName}</p>
                      <p style={cellSub}>{c.authMode === 'oauth2' ? 'OAuth' : 'API key'}</p>
                    </div>
                  </div>
                </SettingsTableCell>
                <SettingsTableCell>
                  <div style={{ minWidth: 0 }}>
                    <p style={cellTitle}>{c.workspaceLinked ? (c.accountLabel || 'Shared account') : 'Not linked'}</p>
                    {c.accountIdentifier && <p style={cellSub}>{c.accountIdentifier}</p>}
                  </div>
                </SettingsTableCell>
                <SettingsTableCell align="center">
                  <ConnectorStatusBadge status={c.workspaceLinked ? 'connected' : 'not-connected'} />
                </SettingsTableCell>
                <SettingsTableCell align="end">
                  {c.workspaceLinked ? (
                    <Button variant="secondary" size="sm" disabled={busy === c.slug} onClick={() => handleUnlink(c.slug)}>
                      {busy === c.slug ? 'Working…' : 'Disable'}
                    </Button>
                  ) : canLink ? (
                    <Button variant="secondary" size="sm" disabled={attachable.length === 0} onClick={() => { setPicking(picking === c.slug ? null : c.slug); setSelectedAccount(''); setAccountMenuOpen(false) }}>
                      {attachable.length === 0 ? 'No accounts' : 'Link account'}
                    </Button>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
                      Admin permission required
                    </span>
                  )}
                </SettingsTableCell>
              </SettingsTableRow>
              {canLink && picking === c.slug && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 24px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Dropdown.Float
                      open={accountMenuOpen}
                      onOpenChange={setAccountMenuOpen}
                      placement="bottom-start"
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          fluid
                          rightIcon={<ArrowDownOneIcon size={14} />}
                          style={{ justifyContent: 'space-between', minWidth: 220 }}
                        >
                          {selectedAccount
                            ? (() => {
                                const a = attachable.find(x => x.id === selectedAccount)
                                return a ? `${a.accountLabel}${a.accountIdentifier ? ` (${a.accountIdentifier})` : ''}` : 'Select shared account…'
                              })()
                            : 'Select shared account…'}
                        </Button>
                      }
                    >
                      <Dropdown>
                        <Dropdown.Section>
                          {attachable.map(a => (
                            <Dropdown.Item
                              key={a.id}
                              label={`${a.accountLabel}${a.accountIdentifier ? ` (${a.accountIdentifier})` : ''}`}
                              selected={selectedAccount === a.id}
                              onClick={() => { setSelectedAccount(a.id); setAccountMenuOpen(false) }}
                              fluid
                            />
                          ))}
                        </Dropdown.Section>
                      </Dropdown>
                    </Dropdown.Float>
                  </div>
                  <Button size="sm" disabled={!selectedAccount || busy === c.slug} onClick={() => handleAttach(c.slug)}>
                    {busy === c.slug ? 'Linking…' : 'Link'}
                  </Button>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </SettingsTableViewport>
    </SettingsTable>
  )
}

// ── Connector requests ──────────────────────────────────────────────────────────

const REQ_COLS = 'minmax(220px,1fr) minmax(190px,.8fr) minmax(220px,1fr) 120px'

function RequestsTab({ orgId, teamId }: { orgId: string; teamId: string }) {
  const [requests, setRequests] = useState<TeamConnectorRequest[]>([])
  const [catalog, setCatalog] = useState<{ slug: string; displayName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [connectorMenuOpen, setConnectorMenuOpen] = useState(false)

  const reload = useCallback(() => {
    Promise.all([listTeamConnectors(orgId, teamId), listTeamConnectorCatalog(orgId, teamId)])
      .then(([reqs, cat]) => {
        setRequests(reqs)
        setCatalog(cat.map(c => ({ slug: c.slug, displayName: c.display_name ?? c.slug })))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId, teamId])
  useEffect(() => { reload() }, [reload])

  const handleRequest = async () => {
    if (!slug) return
    setSaving(true)
    try {
      await requestTeamConnector(orgId, teamId, slug, note.trim() || undefined)
      toast.success('Request sent to your admins')
      setSlug('')
      setNote('')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = (s: TeamConnectorRequest['status']) =>
    s === 'approved' ? 'connected' : s === 'denied' ? 'not-available' : 'pending'

  return (
    <SettingsTable columns={REQ_COLS} columnGap={24}>
      <SettingsTableToolbar title="Connector requests" />
      <SettingsTableFooter style={{ paddingTop: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <Dropdown.Float
              open={connectorMenuOpen}
              onOpenChange={setConnectorMenuOpen}
              placement="bottom-start"
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  fluid
                  rightIcon={<ArrowDownOneIcon size={14} />}
                  style={{ justifyContent: 'space-between', minWidth: 220 }}
                >
                  {slug ? (catalog.find(c => c.slug === slug)?.displayName ?? 'Select a connector…') : 'Select a connector…'}
                </Button>
              }
            >
              <Dropdown>
                <Dropdown.Section>
                  <div
                    className="kaya-scrollbar"
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 362, overflowY: 'auto', padding: 3 }}
                  >
                    {catalog.map(c => (
                      <Dropdown.Item
                        key={c.slug}
                        label={c.displayName}
                        selected={slug === c.slug}
                        onClick={() => { setSlug(c.slug); setConnectorMenuOpen(false) }}
                        fluid
                      />
                    ))}
                  </div>
                </Dropdown.Section>
              </Dropdown>
            </Dropdown.Float>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <InputField label="" value={note} onChange={setNote} placeholder="Optional note for admins" />
          </div>
          <Button size="sm" disabled={!slug || saving} onClick={handleRequest}>
            {saving ? 'Sending…' : 'Request'}
          </Button>
        </div>
      </SettingsTableFooter>

      <SettingsTableViewport minWidth={900} ariaLabel="Team connector requests">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Connector</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Requested by</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Note</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="center">Status</SettingsTableHeaderCell>
        </SettingsTableHeader>

        {loading && <EmptyRow text="Loading…" />}
        {!loading && requests.length === 0 && <EmptyRow text="No requests yet." />}
        {requests.map((r, index) => (
          <SettingsTableRow key={r.connectorSlug} divider={index < requests.length - 1}>
            <SettingsTableCell>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <ConnectorIcon slug={r.connectorSlug} name={toConnector(r.connectorSlug).name} />
                <p style={cellTitle}>{toConnector(r.connectorSlug).name}</p>
              </div>
            </SettingsTableCell>
            <SettingsTableCell>
              <div style={{ minWidth: 0 }}>
                <p style={cellTitle}>{r.requestedByName || 'Team member'}</p>
                <p style={cellSub}>{r.requestedByEmail || formatDate(r.createdAt)}</p>
              </div>
            </SettingsTableCell>
            <SettingsTableCell>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.note || 'No note'}
              </span>
            </SettingsTableCell>
            <SettingsTableCell align="center">
              <ConnectorStatusBadge status={statusBadge(r.status)} />
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </SettingsTableViewport>
    </SettingsTable>
  )
}

// ── Activity ─────────────────────────────────────────────────────────────────

const ACT_COLS = 'minmax(240px,1fr) 150px minmax(220px,.8fr) 120px'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  return `${Math.round(secs / 86400)}d ago`
}

function localDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function humanizeAction(a: string): string {
  return a.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

function belongsToTeam(entry: AuditLogEntry, teamId: string): boolean {
  if (entry.targetType === 'team' && entry.targetId === teamId) return true
  const extraTeamId = entry.extra?.teamId ?? entry.extra?.team_id
  return extraTeamId === teamId
}

function ActivityTab({ orgId, teamId }: { orgId: string; teamId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listAudit(orgId, { limit: 50 })
      .then(rows => { if (!cancelled) setEntries(rows.filter(entry => belongsToTeam(entry, teamId))) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, teamId])

  return (
    <SettingsTable columns={ACT_COLS}>
      <SettingsTableToolbar title="Activity" />
      <SettingsTableViewport minWidth={820} ariaLabel="Team activity">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Action</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Target</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Details</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">When</SettingsTableHeaderCell>
        </SettingsTableHeader>
        {loading && <EmptyRow text="Loading…" />}
        {!loading && entries.length === 0 && <EmptyRow text="No activity yet." />}
        {entries.map((e, index) => (
          <SettingsTableRow key={e.id} minHeight={52} divider={index < entries.length - 1}>
            <SettingsTableCell>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-800)' }}>
                {humanizeAction(e.action)}
              </span>
            </SettingsTableCell>
            <SettingsTableCell>
              <span style={{ ...cellSub, margin: 0 }}>{e.targetType ? humanizeAction(e.targetType) : 'Workspace'}</span>
            </SettingsTableCell>
            <SettingsTableCell>
              <span style={{ ...cellSub, margin: 0 }}>
                {e.extra?.slug ? String(e.extra.slug) : e.targetId || 'No additional details'}
              </span>
            </SettingsTableCell>
            <SettingsTableCell align="end">
              <span
                title={localDateTime(e.createdAt)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', cursor: 'default' }}
              >
                {relativeTime(e.createdAt)}
              </span>
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </SettingsTableViewport>
    </SettingsTable>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function TeamEditorPageContent() {
  const params = useParams()
  const teamId = String(params.teamId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { orgId, orgReady, currentUserRole, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated by the backend's /users/me — resolve the
  // viewer's internal id via the org member list instead (see resolveViewerUserId).
  const viewerUserId = resolveViewerUserId(members, user?.email)

  const [team, setTeam] = useState<Team | null>(null)
  const [canLink, setCanLink] = useState(false)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const requestedSection = searchParams.get('section')
  const section: TeamTab = requestedSection === 'connectors'
    || requestedSection === 'requests'
    || requestedSection === 'activity'
    ? requestedSection
    : 'projects'

  useEffect(() => {
    if (!orgReady) return
    if (!orgId) { router.replace(CHAT_ROUTE); return }
    let cancelled = false
    getTeam(orgId, teamId)
      .then(async t => {
        if (cancelled) return
        if (!t.canEdit) { setDenied(true); router.replace(CHAT_ROUTE); return }
        setTeam(t)
        const isAdmin = currentUserRole === 'admin'
        if (isAdmin) {
          setCanLink(true)
        } else {
          const editors = await listTeamEditors(orgId, teamId)
          const mine = editors.find(e => e.email && user?.email && e.email === user.email)
          setCanLink(Boolean(mine?.canLinkAccounts))
        }
      })
      .catch(() => { if (!cancelled) { setDenied(true); router.replace(CHAT_ROUTE) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, orgReady, teamId, currentUserRole, user?.email, router])

  if (!orgReady || loading) return null
  if (denied || !team || !orgId) return null

  return (
    <SettingsPageShell
      title={team.name}
      description={team.description || "Manage this team's projects, connectors, requests, and activity."}
      backLabel="Back to chat"
      onBack={() => router.push(CHAT_ROUTE)}
    >
      {section === 'projects' && (
        <ProjectsTab teamId={teamId} userId={viewerUserId ?? ''} />
      )}

      {section === 'connectors' && (
        <ConnectorsTab orgId={orgId} teamId={teamId} canLink={canLink} />
      )}
      {section === 'requests' && (
        <RequestsTab orgId={orgId} teamId={teamId} />
      )}
      {section === 'activity' && (
        <ActivityTab orgId={orgId} teamId={teamId} />
      )}
    </SettingsPageShell>
  )
}

export default function TeamEditorPage() {
  return (
    <Suspense fallback={null}>
      <TeamEditorPageContent />
    </Suspense>
  )
}
