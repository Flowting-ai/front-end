'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import {
  ExchangeOneIcon,
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Popover } from '@/components/Popover'
import { SettingsPageShell } from '@/components/SettingsPageShell'
import { Switch } from '@/components/Switch'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useConnectorBrowse, CategoryFilter, Pagination } from '@/components/ConnectorBrowse'
import { connectorCategory } from '@/lib/connectorCategories'
import { useOrg } from '@/context/org-context'
import {
  getTeam,
  updateTeam,
  archiveTeam,
  deleteTeam,
  addTeamEditor,
  removeTeamEditor,
  inviteTeamMembers,
  listTeamConnectorCatalog,
  listTeamConnectors,
  requestTeamConnector,
  setTeamConnectorStatus,
} from '@/lib/api/teams'
import type { ConnectorRequestStatus } from '@/lib/api/teams'
import type { ConnectorCatalogEntry } from '@/lib/api/connectors'
import { connectorLogoSrc } from '@/lib/connectorLogos'
import type { ApiProjectSummary } from '@/lib/api/projects'
import { listMembers } from '@/lib/api/organization'
import { fetchPersonas, personasForTeamContext, type Persona } from '@/lib/api/personas'
import { fetchTeamAccessSnapshot } from '@/lib/team-access'
import type { Team, TeamEditor, OrgMember, OrgRole, WorkspaceRole } from '@/types/teams'
import { toast } from 'sonner'

const EDITOR_COLUMNS = '1fr 1fr 160px'
const EDITOR_COLUMN_GAP = 0

/** A row in the Team Members table built from backend-backed team access grants. */
interface RosterMember {
  userId:   string
  name:     string
  email:    string | null
  orgRole?: OrgRole
  isEditor: boolean
  pending:  boolean
}

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

function useDropdownAnchorPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) {
        setPos(null)
        return
      }
      const rect = trigger.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, triggerRef])

  return pos
}

/** Role/status chip shown beside a member's name in the roster. */
function RoleBadge({ member }: { member: RosterMember }) {
  if (member.pending)            return <Badge color="Neutral" label="Invite sent" />
  if (member.orgRole === 'owner') return <Badge color="Purple"  label="Owner" />
  if (member.orgRole === 'admin') return <Badge color="Blue"    label="Admin" />
  if (member.isEditor)           return <Badge color="Green"   label="Editor" />
  return <Badge color="Neutral" label="Member" />
}

function MemberCell({ member }: { member: RosterMember }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <MemberAvatar />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </p>
          <RoleBadge member={member} />
        </div>
        {member.email && (
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.email}
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

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

function InvitePanel({ availableRoles, orgMembers, rosterIds, projects, onInvite, onClose }: {
  availableRoles: WorkspaceRole[]
  orgMembers: OrgMember[]
  rosterIds: Set<string>
  projects: ApiProjectSummary[]
  onInvite: (emails: string[], role: WorkspaceRole, projectId?: string) => Promise<void>
  onClose: () => void
}) {
  const [raw,      setRaw]      = useState('')
  const [role,     setRole]     = useState<WorkspaceRole>(availableRoles[availableRoles.length - 1] ?? 'member')
  const [projectId, setProjectId] = useState('')
  const [sending,  setSending]  = useState(false)
  const [selected, setSelected] = useState<OrgMember[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const dropPanelRef = useRef<HTMLDivElement>(null)
  const pos = useDropdownAnchorPosition(dropOpen, triggerRef)

  const eligible = useMemo(() =>
    orgMembers.filter(m => m.inviteStatus !== 'invite_sent' && !rosterIds.has(m.id)),
    [orgMembers, rosterIds]
  )

  useEffect(() => {
    if (!dropOpen) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropPanelRef.current?.contains(e.target as Node)) return
      setDropOpen(false)
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [dropOpen])

  useEffect(() => {
    if (role !== 'member' && projectId) setProjectId('')
  }, [projectId, role])

  const toggleMember = (m: OrgMember) =>
    setSelected(prev => prev.some(s => s.id === m.id) ? prev.filter(s => s.id !== m.id) : [...prev, m])

  const handleSend = async () => {
    const typedEmails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    const pickedEmails = selected.map(m => m.email).filter((e): e is string => !!e)
    const all = [...new Set([...typedEmails, ...pickedEmails])]
    if (!all.length) return
    setSending(true)
    try {
      await onInvite(all, role, role === 'member' && projectId ? projectId : undefined)
      setRaw('')
      setSelected([])
      setProjectId('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites')
    } finally {
      setSending(false)
    }
  }

  const canSend = (raw.trim().length > 0 || selected.length > 0) && !sending

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

      {eligible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }}>
            Or add from workspace
          </p>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropOpen(o => !o)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 14,
              color: selected.length > 0 ? 'var(--neutral-900)' : 'var(--neutral-400)',
              border: '1px solid var(--neutral-200)', borderRadius: 8,
              padding: '8px 12px', backgroundColor: 'white', cursor: 'pointer',
              width: '100%', textAlign: 'left',
            }}
          >
            {selected.length > 0
              ? `${selected.length} member${selected.length > 1 ? 's' : ''} selected`
              : 'Select workspace members…'}
          </button>
          {dropOpen && pos && createPortal(
            <AnimatePresence>
              <motion.div
                ref={dropPanelRef}
                style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 300 }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.12 } }}
              >
                <Popover variant="dropdown" style={{ width: '100%', maxHeight: 220, overflowY: 'auto' }}>
                  {eligible.map(m => (
                    <DropdownMenuItem
                      key={m.id}
                      fluid
                      label={m.name || m.email}
                      subLabel={m.name ? (m.email ?? undefined) : undefined}
                      selected={selected.some(s => s.id === m.id)}
                      onClick={() => toggleMember(m)}
                    />
                  ))}
                </Popover>
              </motion.div>
            </AnimatePresence>,
            document.body
          )}
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.map(m => (
                <span
                  key={m.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6,
                    backgroundColor: 'var(--neutral-100)',
                    fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)',
                  }}
                >
                  {m.name || m.email}
                  <button
                    type="button"
                    onClick={() => toggleMember(m)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--neutral-400)', fontSize: 16, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }}>
          Role
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {availableRoles.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                padding:         '5px 12px',
                borderRadius:    8,
                border:          'none',
                cursor:          'pointer',
                fontFamily:      'var(--font-body)',
                fontWeight:      500,
                fontSize:        13,
                lineHeight:      '20px',
                backgroundColor: role === r ? 'var(--neutral-900)' : 'var(--neutral-100)',
                color:           role === r ? 'var(--neutral-white)' : 'var(--neutral-500)',
                transition:      'background-color 120ms, color 120ms',
              }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {role === 'member' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }}>
            Project access (optional)
          </p>
          <select
            aria-label="Project access"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--neutral-200)',
              borderRadius: 8,
              backgroundColor: 'white',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: projectId ? 'var(--neutral-900)' : 'var(--neutral-500)',
              outline: 'none',
            }}
          >
            <option value="">No project access</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="default" size="sm" disabled={!canSend} onClick={handleSend}>
          {sending ? 'Sending…' : 'Send invites'}
        </Button>
      </div>
    </div>
  )
}

// ── Add-editor panel ──────────────────────────────────────────────────────────

function AddEditorPanel({ rosterMembers, onAdd, onClose }: {
  rosterMembers: RosterMember[]
  onAdd: (userId: string) => Promise<void>
  onClose: () => void
}) {
  // Only team members who are regular members (not editors, not pending, not owner/admin)
  const eligible = rosterMembers.filter(m => !m.isEditor && !m.pending && m.orgRole === 'member')
  const [selected, setSelected] = useState<RosterMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pos = useDropdownAnchorPosition(dropOpen, triggerRef)

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
      await onAdd(selected.userId)
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
        Promote team member to editor
      </p>
      {eligible.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
          All team members are already editors.
        </p>
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
            {selected ? (selected.name || selected.email) : 'Select a team member…'}
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
                  {eligible.map(m => (
                    <DropdownMenuItem
                      key={m.userId}
                      fluid
                      label={m.name || m.email || undefined}
                      subLabel={m.name ? (m.email ?? undefined) : undefined}
                      selected={selected?.userId === m.userId}
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
        <Button variant="default" size="sm" disabled={!selected || saving || eligible.length === 0} onClick={handleAdd}>
          {saving ? 'Adding…' : 'Add editor'}
        </Button>
      </div>
    </div>
  )
}

function TeamConnectorRow({
  entry,
  teamStatus,
  isAdmin,
  busy,
  divider,
  onToggle,
}: {
  entry: ConnectorCatalogEntry
  teamStatus: ConnectorRequestStatus | undefined
  isAdmin: boolean
  busy: boolean
  divider: boolean
  onToggle: (checked: boolean) => void
}) {
  const src = connectorLogoSrc(entry.slug)
  const initials = entry.display_name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()

  // org_enabled=false means the org admin disabled this connector globally; teams cannot override.
  const isOrgLocked = entry.org_enabled === false

  // Effective state: explicit team override → org default → off.
  const effectivelyOn = teamStatus === 'approved'
    ? true
    : teamStatus === 'denied'
    ? false
    : entry.org_enabled === true

  const cat = connectorCategory(entry.slug)
  const sublabel = isOrgLocked
    ? `${cat} · Disabled by org`
    : entry.org_enabled && teamStatus === 'denied'
    ? `${cat} · Org-wide · Off for team`
    : entry.org_enabled
    ? `${cat} · Org-wide`
    : cat

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
      transition: 'opacity 150ms',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'white', boxShadow: '0px 0px 0px 1px var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, color: 'var(--neutral-700)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled brand asset with runtime slug path
          <img src={src} alt="" width={23} height={23} style={{ objectFit: 'contain' }} />
        ) : (initials || '?')}
      </div>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.display_name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: isOrgLocked ? 'var(--neutral-400)' : 'var(--neutral-500)', margin: 0 }}>
          {sublabel}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px',
          color: busy ? 'var(--neutral-400)' : effectivelyOn ? 'var(--neutral-900)' : 'var(--neutral-400)',
          margin: 0, minWidth: 20, textAlign: 'right',
          transition: 'color 150ms',
        }}>
          {busy ? '…' : effectivelyOn ? 'ON' : 'OFF'}
        </p>
        <Switch
          checked={effectivelyOn}
          disabled={!isAdmin || busy}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  )
}

const teamEntrySlug = (entry: ConnectorCatalogEntry): string => entry.slug

function TeamConnectorsCard({ orgId, teamId }: { orgId: string; teamId: string }) {
  const { currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [entries, setEntries] = useState<ConnectorCatalogEntry[]>([])
  const [statusBySlug, setStatusBySlug] = useState<Record<string, ConnectorRequestStatus>>({})
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => e.display_name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q))
  }, [entries, search])
  const browse = useConnectorBrowse(searched, teamEntrySlug, { resetKey: search })

  const loadStatuses = useCallback(async () => {
    const rows = await listTeamConnectors(orgId, teamId)
    setStatusBySlug(Object.fromEntries(rows.map(row => [row.connectorSlug, row.status])))
  }, [orgId, teamId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [catalog, rows] = await Promise.all([
          listTeamConnectorCatalog(orgId, teamId),
          listTeamConnectors(orgId, teamId),
        ])
        if (cancelled) return
        setEntries(catalog)
        setStatusBySlug(Object.fromEntries(rows.map(row => [row.connectorSlug, row.status])))
      } catch (err) {
        if (!cancelled) console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [orgId, teamId])

  async function handleToggle(entry: ConnectorCatalogEntry, checked: boolean) {
    if (!isAdmin) return
    setBusySlug(entry.slug)
    try {
      const current = statusBySlug[entry.slug] as ConnectorRequestStatus | undefined
      if (checked) {
        // Create a request record first if none exists (required before PATCH).
        if (!current) await requestTeamConnector(orgId, teamId, entry.slug)
        await setTeamConnectorStatus(orgId, teamId, entry.slug, 'approved')
        toast.success(`${entry.display_name} enabled for this team`)
      } else {
        // Need a record to deny; create one if this connector has never been requested.
        if (!current) await requestTeamConnector(orgId, teamId, entry.slug)
        await setTeamConnectorStatus(orgId, teamId, entry.slug, 'denied')
        toast.success(`${entry.display_name} disabled for this team`)
      }
      await loadStatuses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update connector access')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Connectors"
        subtitle={isAdmin
          ? 'Enable or disable connectors for this team. Org-wide connectors are on by default; you can override them per team.'
          : 'Connectors available to this team. Contact an admin to change access.'
        }
        compact
      />
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading connectors…</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No connectors available.</p>
        </div>
      ) : (
        <>
          <div style={{ padding: '6px 24px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 240, maxWidth: '100%' }}>
              <InputField
                label="Search connectors"
                showLabel={false}
                showSubtitle={false}
                size="small"
                fluid
                leftIcon={<SearchOneIcon size={16} />}
                placeholder="Search connectors"
                value={search}
                onChange={setSearch}
              />
            </div>
            <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
          </div>

          {browse.pageItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No connectors match your filters.</p>
            </div>
          ) : browse.pageItems.map((entry, index) => (
            <TeamConnectorRow
              key={entry.slug}
              entry={entry}
              teamStatus={statusBySlug[entry.slug] as ConnectorRequestStatus | undefined}
              isAdmin={isAdmin}
              busy={busySlug === entry.slug}
              divider={index < browse.pageItems.length - 1}
              onToggle={checked => void handleToggle(entry, checked)}
            />
          ))}

          <div style={{ padding: '14px 24px 6px' }}>
            <Pagination page={browse.page} pageCount={browse.pageCount} onChange={browse.setPage} />
          </div>
        </>
      )}
    </Card>
  )
}

export default function TeamSettingsPage() {
  const params = useParams<{ teamId: string }>()
  const router = useRouter()
  const { orgId, refreshTeams, removeTeam, currentUserRole, orgRole, caps, activeTeamId, setActiveTeamId } = useOrg()
  // Team CRUD (archive/delete) is org admin+ only — members can never do it.
  const canManageTeam = caps.canManageOrg

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [editors, setEditors] = useState<TeamEditor[]>([])
  const [editorsLoading, setEditorsLoading] = useState(true)
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membershipsByUser, setMembershipsByUser] = useState<Map<string, OrgMember['teamMemberships']>>(new Map())
  const [identityByUser, setIdentityByUser] = useState<Map<string, { name: string | null; email: string | null }>>(new Map())
  const [teamProjects, setTeamProjects] = useState<ApiProjectSummary[]>([])

  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [inviteOpen,    setInviteOpen]    = useState(false)
  const [addEditorOpen, setAddEditorOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const availableRoles: WorkspaceRole[] = orgRole === 'owner'
    ? ['admin', 'editor', 'member']
    : ['editor', 'member']

  const [teamAgents, setTeamAgents] = useState<Persona[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)

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

  const refreshRoster = useCallback(async (showRefreshing = true) => {
    if (!orgId || !team) return

    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setEditorsLoading(true)
      setMembersLoading(true)
    }

    try {
      const [rows, snapshot] = await Promise.all([
        listMembers(orgId),
        fetchTeamAccessSnapshot(orgId, [{ id: team.id, name: team.name }]),
      ])
      setOrgMembers(rows)
      setEditors(snapshot.editorsByTeamId.get(team.id) ?? [])
      setMembershipsByUser(snapshot.membershipsByUser)
      setIdentityByUser(snapshot.identitiesByUser)
      setTeamProjects(snapshot.projectsByTeamId.get(team.id) ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      if (showRefreshing) {
        setRefreshing(false)
      } else {
        setEditorsLoading(false)
        setMembersLoading(false)
      }
    }
  }, [orgId, team])

  useEffect(() => {
    if (!team) return
    void refreshRoster(false)
  }, [team, refreshRoster])

  useEffect(() => {
    if (!params.teamId) return
    const teamId = params.teamId
    setAgentsLoading(true)
    fetchPersonas()
      .then(list => setTeamAgents(personasForTeamContext(list, teamId)))
      .catch(() => setTeamAgents([]))
      .finally(() => setAgentsLoading(false))
  }, [params.teamId])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshRoster() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshRoster])

  const editorIds = useMemo(() => new Set(editors.map(e => e.userId)), [editors])

  // Full team roster: active access comes from team editor and project-member
  // grants; pending invites still come from the org members response.
  const roster = useMemo<RosterMember[]>(() => {
    const teamId = team?.id
    if (!teamId) return []
    const byId = new Map<string, RosterMember>()
    for (const m of orgMembers) {
      const hasActiveAccess = membershipsByUser.get(m.id)?.some(teamMembership => teamMembership.teamId === teamId) ?? false
      const hasPendingInvite = m.inviteStatus === 'invite_sent' && m.teamMemberships.some(t => t.teamId === teamId)
      if (hasActiveAccess || hasPendingInvite) {
        const identity = identityByUser.get(m.id)
        byId.set(m.id, {
          userId:   m.id,
          name:     m.name || identity?.name || m.email || identity?.email || m.id,
          email:    m.email || identity?.email || null,
          orgRole:  m.orgRole,
          isEditor: editorIds.has(m.id),
          pending:  hasPendingInvite,
        })
      }
    }
    for (const e of editors) {
      const existing = byId.get(e.userId)
      if (existing) { existing.isEditor = true; continue }
      byId.set(e.userId, {
        userId:   e.userId,
        name:     e.name || e.email || e.userId,
        email:    e.email || null,
        isEditor: true,
        pending:  false,
      })
    }
    return [...byId.values()].sort((a, b) =>
      Number(b.isEditor) - Number(a.isEditor) || a.name.localeCompare(b.name))
  }, [orgMembers, editors, editorIds, membershipsByUser, identityByUser, team?.id])

  const rosterIds = useMemo(() => new Set(roster.map(m => m.userId)), [roster])

  const rosterLoading = editorsLoading || membersLoading

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
    }
    setSaving(false)
  }

  const handleArchive = async () => {
    if (!orgId || !team) return
    if (!canManageTeam) { toast.error('Only an admin or owner can archive a team.'); return }
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
    if (!canManageTeam) { toast.error('Only an admin or owner can delete a team.'); return }
    try {
      await deleteTeam(orgId, team.id)
      toast.success(`"${team.name}" was deleted successfully`)
      if (activeTeamId === team.id) setActiveTeamId(null)
      removeTeam(team.id)
      router.push('/org/teams')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete team')
    }
  }

  const handleRemoveEditor = async (memberId: string) => {
    if (!orgId || !team) return
    try {
      await removeTeamEditor(orgId, team.id, memberId)
      await refreshRoster(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleInvite = async (emails: string[], role: WorkspaceRole, projectId?: string) => {
    if (!orgId || !team) return
    await inviteTeamMembers(orgId, team.id, emails, role, undefined, projectId)
    toast.success(`Invite sent to ${emails.length} email${emails.length > 1 ? 's' : ''}`)
    setInviteOpen(false)
    void refreshRoster()
  }

  const handleAddEditor = async (userId: string) => {
    if (!orgId || !team) return
    const editor = await addTeamEditor(orgId, team.id, userId)
    setEditors(prev => [...prev, editor])
    toast.success('Editor added')
  }

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
    <SettingsPageShell
      title={team.name}
      description="Manage this team name, members, and settings."
      backLabel="All teams"
      onBack={() => router.push('/org/teams')}
    >
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
              <Button variant="ghost" size="sm" leftIcon={<ExchangeOneIcon animated={refreshing} size={16} />} disabled={refreshing} onClick={() => void refreshRoster()}>
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setAddEditorOpen(o => !o); setInviteOpen(false) }}>
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

          {rosterLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading members…</p>
            </div>
          )}

          {!rosterLoading && roster.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>No members yet.</p>
            </div>
          )}

          {!rosterLoading && roster.map((member, index) => (
            <SettingsTableRow
              key={member.userId}
              columns={EDITOR_COLUMNS}
              columnGap={EDITOR_COLUMN_GAP}
              divider={index < roster.length - 1}
            >
              <SettingsTableCell>
                <MemberCell member={member} />
              </SettingsTableCell>
              <SettingsTableCell>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>
                  {member.email ?? '—'}
                </span>
              </SettingsTableCell>
              <SettingsTableCell align="center">
                {member.isEditor ? (
                  // Re-read the backend-backed roster after editor removal because
                  // some members still have project access while others lose team access entirely.
                  <RedOutlineButton onClick={() => handleRemoveEditor(member.userId)}>Remove editor</RedOutlineButton>
                ) : !member.pending && member.orgRole === 'member' ? (
                  <Button variant="secondary" size="sm" onClick={() => void handleAddEditor(member.userId)}>Make editor</Button>
                ) : (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-300)' }}>—</span>
                )}
              </SettingsTableCell>
            </SettingsTableRow>
          ))}

          {inviteOpen && (
            <InvitePanel
              availableRoles={availableRoles}
              orgMembers={orgMembers}
              rosterIds={rosterIds}
              projects={teamProjects}
              onInvite={handleInvite}
              onClose={() => setInviteOpen(false)}
            />
          )}
          {addEditorOpen && (
            <AddEditorPanel
              rosterMembers={roster}
              onAdd={handleAddEditor}
              onClose={() => setAddEditorOpen(false)}
            />
          )}
        </SettingsTable>

        {orgId && <TeamConnectorsCard orgId={orgId} teamId={team.id} />}

        <Card>
          <CardHeader
            title="Shared agents"
            subtitle="Agents published to this team. Manage sharing from the agent's configure page."
            compact
          />
          <div style={{ padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agentsLoading && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>Loading…</p>
            )}
            {!agentsLoading && teamAgents.length === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No agents shared to this team yet.
              </p>
            )}
            {!agentsLoading && teamAgents.map(agent => (
              <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 10, backgroundColor: 'var(--neutral-50)', boxShadow: '0px 0px 0px 1px var(--neutral-100)' }}>
                <div style={{ flex: '1 1 0', minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px',
                    color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.name}
                  </p>
                  {agent.description && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.description}
                    </p>
                  )}
                </div>
                <Badge
                  color={agent.status === 'active' ? 'Green' : agent.status === 'paused' ? 'Yellow' : 'Neutral'}
                  label={agent.status === 'active' ? 'Live' : agent.status === 'paused' ? 'Paused' : 'Draft'}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Team archive/delete is org admin+ only — hidden entirely from members. */}
        {canManageTeam && (
        <Card danger>
          <CardHeader title="Danger Zone" subtitle="Actions here are permanent and cannot be undone." danger compact />

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
        )}
    </SettingsPageShell>
  )
}
