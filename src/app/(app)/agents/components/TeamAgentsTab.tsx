'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableViewport,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
} from '@/components/SettingsTable'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { Dropdown } from '@/components/Dropdown'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { listTeamPersonaShares, resolveViewerUserId } from '@/lib/api/teams'
import {
  fetchPersonas,
  usePersonaRepoDeduped,
  updatePersonaCopyToLatest,
  getTeamAgentCopyStatus,
  getExistingCopyId,
  type Persona,
  type TeamAgentCopyStatus,
} from '@/lib/api/personas'
import { AGENT_CHAT_ROUTE } from '@/lib/routes'

// Section header for a team block — same visual weight as SettingsTableToolbar,
// but with the team's icon leading the name ("(icon) Frontend"), which
// SettingsTableToolbar can't express since its `title` is a plain string.
function TeamSectionHeader({ teamId, teamName }: { teamId: string; teamName: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
      <TeamAvatar teamId={teamId} name={teamName} size={24} />
      <h2 style={{ flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
        {teamName}
      </h2>
    </div>
  )
}

// ── Team identity tile — same gradient-initial convention used on
// org/members and org/teams, kept visually consistent across the app rather
// than introducing a generic icon for "a team". ──────────────────────────────

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',
]

function getTeamGradient(teamId: string): string {
  let hash = 0
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i)
    hash |= 0
  }
  return TEAM_GRADIENTS[Math.abs(hash) % TEAM_GRADIENTS.length]!
}

function TeamAvatar({ teamId, name, size = 20 }: { teamId: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative', display: 'inline-flex', width: size, height: size,
        borderRadius: 4, background: getTeamGradient(teamId), flexShrink: 0, overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 4, pointerEvents: 'none',
          boxShadow: 'inset 0px 4px 4px 0px rgba(0,0,0,0.25), inset 0px -1px 0.4px 0px rgba(18,60,95,0.65)',
        }}
      />
      <span
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: size <= 20 ? 11 : 13, lineHeight: 1,
          color: 'var(--neutral-white)', userSelect: 'none',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

// ── Data model ────────────────────────────────────────────────────────────────

interface TeamAgentRow {
  persona: Persona
  ownerUserId: string
  ownerName: string | null
  teams: Array<{ id: string; name: string }>
}

// Version label — "vNNN" derived from the repo's total version count.
// NOTE: this deliberately avoids listVersions()/GET /persona/{repo_id}/versions,
// which 403s for anyone who isn't the repo's owner (a backend-only fix, out of
// scope here) — versionCount comes from the team-aware GET /persona list
// instead, so it works for every viewer regardless of ownership. It's an
// approximation (the published version isn't always the most recently created
// one, e.g. after restoring an older version) but is the best signal available
// without the owner-gated endpoint.
function versionLabel(persona: Persona): string | null {
  if (!persona.activeVersionId || persona.versionCount <= 0) return null
  return `v${String(persona.versionCount).padStart(3, '0')}`
}

// ── Shared per-row action logic (used by both the admin flat table and the
// member/editor sectioned view) ──────────────────────────────────────────────

interface RowActionState {
  versionLabel: string | null
  status: TeamAgentCopyStatus
  busy: boolean
}

function useTeamAgentRowActions(rows: TeamAgentRow[]) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [statusTick, setStatusTick] = useState(0)
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const statuses = useMemo(() => {
    void statusTick
    const map: Record<string, TeamAgentCopyStatus> = {}
    for (const { persona } of rows) map[persona.id] = getTeamAgentCopyStatus(persona.id, persona.activeVersionId)
    return map
  }, [rows, statusTick])

  const updatableCount = useMemo(
    () => rows.filter(({ persona }) => statuses[persona.id] === 'update_available').length,
    [rows, statuses],
  )

  function setBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev)
      busy ? next.add(id) : next.delete(id)
      return next
    })
  }

  const { push } = useRouter()

  async function handleCopy(persona: Persona) {
    setBusy(persona.id, true)
    const toastId = toast.loading(`Copying "${persona.name}"…`)
    try {
      const copy = await usePersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.dismiss(toastId)
      toast.success(`"${persona.name}" copied to your agents`)
      setStatusTick(t => t + 1)
      push(AGENT_CHAT_ROUTE(copy.id))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to copy agent. Please try again.')
    } finally {
      setBusy(persona.id, false)
    }
  }

  // Shared by the single-row update and the bulk "Update all" action — no
  // toast here, callers own their own loading/result messaging so a bulk run
  // doesn't spam one toast per agent.
  async function updateOne(persona: Persona): Promise<boolean> {
    setBusy(persona.id, true)
    try {
      await updatePersonaCopyToLatest(persona.id)
      return true
    } catch {
      return false
    } finally {
      setBusy(persona.id, false)
    }
  }

  async function handleUpdate(persona: Persona) {
    const toastId = toast.loading(`Updating "${persona.name}"…`)
    const ok = await updateOne(persona)
    toast.dismiss(toastId)
    if (ok) {
      toast.success(`"${persona.name}" updated to the latest version`)
      setStatusTick(t => t + 1)
    } else {
      toast.error('Failed to update agent. Please try again.')
    }
  }

  async function handleUpdateAll() {
    const stale = rows.filter(({ persona }) => statuses[persona.id] === 'update_available')
    if (stale.length === 0) return
    setBulkUpdating(true)
    const toastId = toast.loading(`Updating ${stale.length} agent${stale.length === 1 ? '' : 's'}…`)
    const results = await Promise.all(stale.map(({ persona }) => updateOne(persona)))
    toast.dismiss(toastId)
    const succeeded = results.filter(Boolean).length
    const failed = results.length - succeeded
    if (failed === 0) {
      toast.success(`Updated ${succeeded} agent${succeeded === 1 ? '' : 's'} to the latest version`)
    } else if (succeeded === 0) {
      toast.error(`Failed to update ${failed} agent${failed === 1 ? '' : 's'}. Please try again.`)
    } else {
      toast.info(`Updated ${succeeded} agent${succeeded === 1 ? '' : 's'} — ${failed} failed, please try again.`)
    }
    setStatusTick(t => t + 1)
    setBulkUpdating(false)
  }

  function handleOpen(persona: Persona, isOwner: boolean) {
    // Owners chat on their own repo directly — no copy involved.
    if (isOwner) { push(AGENT_CHAT_ROUTE(persona.id)); return }
    const copyId = getExistingCopyId(persona.id)
    if (copyId) push(AGENT_CHAT_ROUTE(copyId))
  }

  function getRowState(persona: Persona): RowActionState {
    return {
      versionLabel: versionLabel(persona),
      status: statuses[persona.id] ?? 'not_copied',
      busy: busyIds.has(persona.id),
    }
  }

  return { getRowState, handleCopy, handleUpdate, handleOpen, handleUpdateAll, updatableCount, bulkUpdating }
}

// ── Status + Action cells — shared between both views ────────────────────────
// Split into two columns: Status is purely informational (what state is this
// agent's copy in), Action is the one thing you can actually do about it.

function AgentStatusCell({ isOwner, status }: { isOwner: boolean; status: TeamAgentCopyStatus }) {
  if (isOwner || status === 'not_copied') {
    return <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-300)' }}>—</span>
  }
  if (status === 'update_available') {
    return <Badge color="Yellow" label="Update found" />
  }
  return <Badge color="Green" label="Up to date" />
}

function AgentActionCell({
  isOwner,
  state,
  onCopy,
  onUpdate,
  onOpen,
}: {
  isOwner: boolean
  state: RowActionState
  onCopy: () => void
  onUpdate: () => void
  onOpen: () => void
}) {
  if (isOwner) {
    return (
      <Button size="sm" variant="secondary" onClick={onOpen}>
        Use in chat
      </Button>
    )
  }
  if (state.status === 'not_copied') {
    return (
      <Button size="sm" variant="default" loading={state.busy} disabled={state.busy} onClick={onCopy}>
        Copy agent for use
      </Button>
    )
  }
  if (state.status === 'update_available') {
    return (
      <Button size="sm" variant="default" loading={state.busy} disabled={state.busy} onClick={onUpdate}>
        Update to latest
      </Button>
    )
  }
  return (
    <Button size="sm" variant="secondary" onClick={onOpen}>
      Use this agent
    </Button>
  )
}

function SharedByCell({ isOwner, ownerName }: { isOwner: boolean; ownerName: string | null }) {
  return (
    <p style={{
      fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px',
      color: isOwner ? 'var(--neutral-700)' : 'var(--neutral-500)', margin: 0,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {isOwner ? 'You' : (ownerName ?? 'Unknown')}
    </p>
  )
}

// Name (large) stacked over handle (small), avatar vertically centered on the
// left — combines what used to be separate Agent/Handle columns into one.
function AgentIdentityCell({ persona }: { persona: Persona }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {persona.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote/user-supplied avatar URL
        <img src={persona.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <Avatar name={persona.name} size="md" />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px',
          color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {persona.name}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px',
          color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {persona.handle}
        </p>
      </div>
    </div>
  )
}

// Bulk action — refreshes every not-owned agent currently flagged
// "Update found" in one go. Hidden entirely when nothing needs it.
function UpdateAllButton({ count, busy, onClick }: { count: number; busy: boolean; onClick: () => void }) {
  if (count === 0) return null
  return (
    <Button size="sm" variant="secondary" loading={busy} disabled={busy} onClick={onClick}>
      Update all ({count})
    </Button>
  )
}

// ── Empty / loading states ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 24px' }}>
      <p style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0, textAlign: 'center' }}>
        No agents shared with your teams yet
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: '22px', color: 'var(--neutral-500)', textAlign: 'center', maxWidth: 420, margin: 0 }}>
        When an agent is set to team visibility, it shows up here.
      </p>
    </div>
  )
}

function TableSkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {[0, 1, 2].map(i => (
        <SettingsTableRow key={i} minHeight={64}>
          <SettingsTableCell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.25 }}>
              <div className="kaya-skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              <div className="kaya-skeleton" style={{ width: 140, height: 14, borderRadius: 4 }} />
            </div>
          </SettingsTableCell>
          {Array.from({ length: columns - 2 }).map((_, ci) => (
            <SettingsTableCell key={ci}><div className="kaya-skeleton" style={{ width: 80, height: 14, borderRadius: 4, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
          ))}
          <SettingsTableCell align="end"><div className="kaya-skeleton" style={{ width: 140, height: 32, borderRadius: 8, opacity: 1 - i * 0.25 }} /></SettingsTableCell>
        </SettingsTableRow>
      ))}
    </>
  )
}

// "N teams" secondary-button trigger + floating dropdown listing each team
// (avatar + name) the agent is shared to — the arrow rotates on toggle, same
// convention as the Sharing tab's own team picker.
//
// Placement flips between left-start (opens downward, top-aligned to the
// button) and left-end (opens upward, bottom-aligned to the button) based on
// how much viewport space is actually below the trigger at open time — rows
// near the bottom of the table would otherwise have the panel clipped by the
// viewport edge.
function TeamsCounterDropdown({ teams }: { teams: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'left-start' | 'left-end'>('left-start')
  const anchorRef = React.useRef<HTMLSpanElement | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (next && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      const estimatedHeight = teams.length * 40 + 16 // row height + panel padding
      const spaceBelow = document.documentElement.clientHeight - rect.top
      setPlacement(spaceBelow < estimatedHeight ? 'left-end' : 'left-start')
    }
    setOpen(next)
  }

  return (
    <span ref={anchorRef} style={{ display: 'inline-flex' }}>
    <Dropdown.Float
      open={open}
      onOpenChange={handleOpenChange}
      placement={placement}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          rightIcon={
            <span style={{ display: 'inline-flex', lineHeight: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>
              <ArrowDownOneIcon size={14} />
            </span>
          }
        >
          {teams.length} team{teams.length === 1 ? '' : 's'}
        </Button>
      }
    >
      <Dropdown style={{ minWidth: 200 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
          {teams.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px' }}>
              <TeamAvatar teamId={t.id} name={t.name} />
              <span style={{
                fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </Dropdown>
    </Dropdown.Float>
    </span>
  )
}

// ── Admin/Owner view — flat table, every team-shared agent across the org,
// with a Teams column since one admin oversees potentially many teams. ──────

const ADMIN_COLUMNS = 'minmax(190px, 1.4fr) 70px minmax(120px, 1fr) minmax(110px, 0.8fr) 100px 180px'

function AdminAgentsTable({ rows, isLoading, viewerId }: { rows: TeamAgentRow[]; isLoading: boolean; viewerId: string | number | null | undefined }) {
  const { getRowState, handleCopy, handleUpdate, handleOpen, handleUpdateAll, updatableCount, bulkUpdating } = useTeamAgentRowActions(rows)

  if (!isLoading && rows.length === 0) return <EmptyState />

  return (
    <SettingsTable columns={ADMIN_COLUMNS} columnGap={10}>
      <SettingsTableToolbar title="Shared with your teams">
        <UpdateAllButton count={updatableCount} busy={bulkUpdating} onClick={() => void handleUpdateAll()} />
      </SettingsTableToolbar>
      <SettingsTableViewport minWidth={860} ariaLabel="Agents shared with your teams">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Version</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Shared by</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Teams</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">Action</SettingsTableHeaderCell>
        </SettingsTableHeader>

        {isLoading && rows.length === 0 && <TableSkeletonRows columns={6} />}

        {rows.map(({ persona, ownerUserId, ownerName, teams }) => {
          const state = getRowState(persona)
          const isOwner = String(ownerUserId) === String(viewerId)
          return (
            <SettingsTableRow key={persona.id} minHeight={64}>
              <SettingsTableCell><AgentIdentityCell persona={persona} /></SettingsTableCell>
              <SettingsTableCell>
                <p style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-code)', color: 'var(--neutral-500)', margin: 0 }}>
                  {state.versionLabel ?? '—'}
                </p>
              </SettingsTableCell>
              <SettingsTableCell>
                <SharedByCell isOwner={isOwner} ownerName={ownerName} />
              </SettingsTableCell>
              <SettingsTableCell>
                <TeamsCounterDropdown teams={teams} />
              </SettingsTableCell>
              <SettingsTableCell>
                <AgentStatusCell isOwner={isOwner} status={state.status} />
              </SettingsTableCell>
              <SettingsTableCell align="end">
                <AgentActionCell
                  isOwner={isOwner}
                  state={state}
                  onCopy={() => void handleCopy(persona)}
                  onUpdate={() => void handleUpdate(persona)}
                  onOpen={() => handleOpen(persona, isOwner)}
                />
              </SettingsTableCell>
            </SettingsTableRow>
          )
        })}
      </SettingsTableViewport>
    </SettingsTable>
  )
}

// ── Member/Editor view — sectioned by team, one block per team the viewer
// actually belongs to (no Teams column — the section itself is the team). ───

const MEMBER_COLUMNS = 'minmax(190px, 1.4fr) 70px minmax(120px, 1fr) 100px 180px'

function MemberAgentsSections({ rows, isLoading, viewerId }: { rows: TeamAgentRow[]; isLoading: boolean; viewerId: string | number | null | undefined }) {
  const { getRowState, handleCopy, handleUpdate, handleOpen, handleUpdateAll, updatableCount, bulkUpdating } = useTeamAgentRowActions(rows)

  const sections = useMemo(() => {
    const byTeam = new Map<string, { name: string; rows: TeamAgentRow[] }>()
    for (const row of rows) {
      for (const t of row.teams) {
        if (!byTeam.has(t.id)) byTeam.set(t.id, { name: t.name, rows: [] })
        byTeam.get(t.id)!.rows.push(row)
      }
    }
    return Array.from(byTeam.entries()).map(([id, v]) => ({ id, ...v }))
  }, [rows])

  if (!isLoading && sections.length === 0) return <EmptyState />

  if (isLoading && sections.length === 0) {
    return (
      <SettingsTable columns={MEMBER_COLUMNS} columnGap={10}>
        <SettingsTableToolbar title="Shared with your teams" />
        <SettingsTableViewport minWidth={730} ariaLabel="Agents shared with your teams">
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Version</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Shared by</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Action</SettingsTableHeaderCell>
          </SettingsTableHeader>
          <TableSkeletonRows columns={5} />
        </SettingsTableViewport>
      </SettingsTable>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {updatableCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <UpdateAllButton count={updatableCount} busy={bulkUpdating} onClick={() => void handleUpdateAll()} />
        </div>
      )}
      {sections.map(section => (
        <SettingsTable key={section.id} columns={MEMBER_COLUMNS} columnGap={10}>
          <TeamSectionHeader teamId={section.id} teamName={section.name} />
          <SettingsTableViewport minWidth={730} ariaLabel={`Agents shared to ${section.name}`}>
            <SettingsTableHeader>
              <SettingsTableHeaderCell>Agent</SettingsTableHeaderCell>
              <SettingsTableHeaderCell>Version</SettingsTableHeaderCell>
              <SettingsTableHeaderCell>Shared by</SettingsTableHeaderCell>
              <SettingsTableHeaderCell>Status</SettingsTableHeaderCell>
              <SettingsTableHeaderCell align="end">Action</SettingsTableHeaderCell>
            </SettingsTableHeader>
            {section.rows.map(({ persona, ownerUserId, ownerName }) => {
              const state = getRowState(persona)
              const isOwner = String(ownerUserId) === String(viewerId)
              return (
                <SettingsTableRow key={persona.id} minHeight={64}>
                  <SettingsTableCell><AgentIdentityCell persona={persona} /></SettingsTableCell>
                  <SettingsTableCell>
                    <p style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-code)', color: 'var(--neutral-500)', margin: 0 }}>
                      {state.versionLabel ?? '—'}
                    </p>
                  </SettingsTableCell>
                  <SettingsTableCell>
                    <SharedByCell isOwner={isOwner} ownerName={ownerName} />
                  </SettingsTableCell>
                  <SettingsTableCell>
                    <AgentStatusCell isOwner={isOwner} status={state.status} />
                  </SettingsTableCell>
                  <SettingsTableCell align="end">
                    <AgentActionCell
                      isOwner={isOwner}
                      state={state}
                      onCopy={() => void handleCopy(persona)}
                      onUpdate={() => void handleUpdate(persona)}
                      onOpen={() => handleOpen(persona, isOwner)}
                    />
                  </SettingsTableCell>
                </SettingsTableRow>
              )
            })}
          </SettingsTableViewport>
        </SettingsTable>
      ))}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function TeamAgentsTab() {
  const { orgId, teams, currentUserRole, members } = useOrg()
  const { user } = useAuth()
  // `user?.id` is never populated by the backend's /users/me — resolve the
  // viewer's internal id via the org member list instead (see resolveViewerUserId).
  const viewerId = resolveViewerUserId(members, user?.email)
  const [rows, setRows] = useState<TeamAgentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!orgId || teams.length === 0) {
      setRows([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      fetchPersonas(),
      Promise.all(teams.map(t => listTeamPersonaShares(orgId, t.id).catch(() => []))),
    ]).then(([personas, shareLists]) => {
      if (cancelled) return
      const personaById = new Map(personas.map(p => [p.id, p]))
      const rowMap = new Map<string, TeamAgentRow>()
      for (const shares of shareLists) {
        for (const share of shares) {
          const persona = personaById.get(share.personaRepoId)
          if (!persona) continue
          // Drafts (never published) have nothing usable to copy/update, and
          // shouldn't clutter this list for any role — owner included.
          if (persona.status === 'draft') continue
          const existing = rowMap.get(share.personaRepoId)
          if (existing) {
            if (!existing.teams.some(t => t.id === share.teamId)) {
              existing.teams.push({ id: share.teamId, name: share.teamName })
            }
          } else {
            rowMap.set(share.personaRepoId, {
              persona,
              ownerUserId: share.sharedByUserId,
              ownerName: share.sharedByName,
              teams: [{ id: share.teamId, name: share.teamName }],
            })
          }
        }
      }
      setRows(Array.from(rowMap.values()))
    }).finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [orgId, teams])

  // Org owners/admins can act on every team (see organizations/roles.py
  // can_act_in_team), so `teams` already contains the whole org's teams for
  // them — a flat, org-wide table with a Teams column is the useful view.
  // A plain editor/member's `teams` list is already scoped to just their own
  // memberships, so grouping those into per-team sections reads naturally.
  const isOrgAdmin = currentUserRole === 'admin'

  return isOrgAdmin
    ? <AdminAgentsTable rows={rows} isLoading={isLoading} viewerId={viewerId} />
    : <MemberAgentsSections rows={rows} isLoading={isLoading} viewerId={viewerId} />
}

export default TeamAgentsTab
