'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusSignIcon, SettingsOneIcon } from '@strange-huge/icons'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { Badge, type BadgeColor } from '@/components/Badge'
import { InputField } from '@/components/InputField'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import { createTeam, listTeamConnectors } from '@/lib/api/teams'
import { listOrgCatalog } from '@/lib/api/connectors'
import { fetchTeamAccessSnapshot } from '@/lib/team-access'
import type { Team } from '@/types/teams'
import { ORG_TEAM_ROUTE } from '@/lib/routes'

const SLIDE = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const }

function CreateTeamForm({
  onCancel,
  onCreate,
  borderPosition = 'top',
}: {
  onCancel: () => void
  onCreate: (name: string, desc: string) => void
  borderPosition?: 'top' | 'bottom'
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto', transition: { ...SLIDE, opacity: { duration: 0.15 } } }}
      exit={{ opacity: 0, height: 0, transition: { ...SLIDE, opacity: { duration: 0.1 } } }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        padding:         '20px 24px',
        borderTop:       borderPosition === 'top' ? '1px solid var(--neutral-100)' : undefined,
        borderBottom:    borderPosition === 'bottom' ? '1px solid var(--neutral-100)' : undefined,
        backgroundColor: 'var(--neutral-white)',
        display:         'flex',
        flexDirection:   'column',
        gap:             12,
      }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>New team</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-600)' }}>Team name</label>
            <InputField value={name} onChange={setName} placeholder="e.g. Marketing" />
          </div>
          <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-600)' }}>
              Description <span style={{ color: 'var(--neutral-400)', fontWeight: 400 }}>(optional)</span>
            </label>
            <InputField value={desc} onChange={setDesc} placeholder="What does this team work on?" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            variant="default"
            size="sm"
            disabled={!name.trim()}
            onClick={() => { onCreate(name.trim(), desc.trim()); setName(''); setDesc('') }}
          >
            Create team
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

const TEAM_COLUMNS = '177px 178px 178px 177px 178px 178px'
const TEAM_COLUMN_GAP = 0

// Deterministic gradient palette — kept in sync with TeamSwitcher/index.tsx's
// getTeamGradient/TeamAvatar so a team keeps the same color/icon everywhere.
const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
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
        position:     'relative',
        display:      'inline-flex',
        width:        size,
        height:       size,
        borderRadius: 4,
        background:   getTeamGradient(teamId),
        flexShrink:   0,
        overflow:     'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          borderRadius:  4,
          pointerEvents: 'none',
          boxShadow:     'inset 0px 4px 4px 0px rgba(0,0,0,0.25), inset 0px -1px 0.4px 0px rgba(18,60,95,0.65)',
        }}
      />
      <span
        style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontFamily:     'var(--font-title)',
          fontWeight:     500,
          fontSize:       Math.round(size * 0.55),
          lineHeight:     1,
          color:          'var(--neutral-white)',
          userSelect:     'none',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function TeamNameCell({ team }: { team: Team }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <TeamAvatar teamId={team.id} name={team.name} size={36} />
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   500,
          fontSize:     14,
          lineHeight:   '22px',
          color:        'var(--neutral-900)',
          margin:       0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {team.name}
        </p>
        {team.description && (
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     11,
            lineHeight:   '16px',
            color:        'var(--neutral-500)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {team.description}
          </p>
        )}
      </div>
    </div>
  )
}

function TextPill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '5px 8px',
      borderRadius:   8,
      fontFamily:     'var(--font-body)',
      fontWeight:     500,
      fontSize:       14,
      lineHeight:     '22px',
      color:          'var(--neutral-700)',
      whiteSpace:     'nowrap',
    }}>
      {children}
    </span>
  )
}

// Editors/Members count cell: a "—" pill while loading, a "None" badge at
// zero, else the count in a colored badge — same Blue/Purple family RoleBadge
// uses for editor/member elsewhere, so the color language stays consistent.
function CountCell({ loading, count, noun, color }: { loading: boolean; count: number; noun: string; color: BadgeColor }) {
  if (loading) return <TextPill>—</TextPill>
  if (count === 0) return <Badge color="Neutral" label="None" />
  return <Badge color={color} label={`${count} ${noun}${count === 1 ? '' : 's'}`} />
}

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'teamsSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function TeamsPageSkeleton() {
  return (
    <>
      <style>{`@keyframes teamsSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1162, padding: '0 24px', boxSizing: 'border-box' }}>

        {/* Page header */}
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={80} height={24} radius={6} />
            <SkeletonBlock width={300} height={14} radius={4} />
          </div>
          <SkeletonBlock width={130} height={32} radius={8} />
        </div>

        {/* Table card */}
        <section style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12)', background: 'var(--neutral-50)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={110} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={60} height={13} radius={4} />
          </div>

          {/* Column header row */}
          <div style={{ display: 'grid', gridTemplateColumns: TEAM_COLUMNS, columnGap: TEAM_COLUMN_GAP, alignItems: 'center', padding: '6px 24px 16px', borderBottom: '1px solid var(--neutral-100)', minHeight: 44 }}>
            <SkeletonBlock width={40} height={13} radius={4} />
            <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={55} height={13} radius={4} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={50} height={13} radius={4} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={60} height={13} radius={4} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={70} height={13} radius={4} /></div>
            <div />
          </div>

          {/* Skeleton rows */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: TEAM_COLUMNS, columnGap: TEAM_COLUMN_GAP, alignItems: 'center', minHeight: 72, padding: '0 24px', borderBottom: '1px solid var(--neutral-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SkeletonBlock width={36} height={36} radius={4} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonBlock width={120} height={14} radius={4} />
                  <SkeletonBlock width={80} height={11} radius={4} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={28} radius={8} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={110} height={32} radius={8} /></div>
            </div>
          ))}
        </section>

      </div>
    </>
  )
}

export default function OrgTeamsPage() {
  const router = useRouter()
  const { orgId, teams, teamsLoading, refreshTeams, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editorCounts, setEditorCounts] = useState<Record<string, number>>({})
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [countsLoading, setCountsLoading] = useState(true)
  const [connectorCounts, setConnectorCounts] = useState<Record<string, number>>({})
  const [connectorCountsLoading, setConnectorCountsLoading] = useState(true)

  const activeTeams = teams.filter(t => !t.archived)

  // Team list/editor endpoints don't return member/editor counts, so they're
  // derived the same way the members page builds per-team rosters: editors +
  // project members, deduped per user per team. A membership's isTeamOwner
  // flag is what distinguishes an editor from a plain member.
  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      if (!orgId || activeTeams.length === 0) {
        if (!cancelled) { setEditorCounts({}); setMemberCounts({}); setCountsLoading(false) }
        return
      }
      setCountsLoading(true)
      const { membershipsByUser } = await fetchTeamAccessSnapshot(orgId, activeTeams)
      const editors: Record<string, number> = {}
      const members: Record<string, number> = {}
      for (const memberships of membershipsByUser.values()) {
        for (const membership of memberships) {
          const bucket = membership.isTeamOwner ? editors : members
          bucket[membership.teamId] = (bucket[membership.teamId] ?? 0) + 1
        }
      }
      if (!cancelled) { setEditorCounts(editors); setMemberCounts(members); setCountsLoading(false) }
    }

    void loadCounts()
    return () => { cancelled = true }
  }, [orgId, teams])

  // A connector counts as "on" for a team the same way the backend computes
  // it (list_team_connections: approved = org_enabled | team_grant) — explicit
  // team approve/deny wins, otherwise it inherits the org-wide switch. Kept in
  // sync with /org/connectors' Team access tab and /org/team/[teamId], which
  // use this identical formula.
  useEffect(() => {
    let cancelled = false

    async function loadConnectorCounts() {
      if (!orgId || !isAdmin || activeTeams.length === 0) {
        if (!cancelled) { setConnectorCounts({}); setConnectorCountsLoading(false) }
        return
      }
      setConnectorCountsLoading(true)
      try {
        const [catalog, statusRows] = await Promise.all([
          listOrgCatalog(orgId),
          Promise.all(activeTeams.map(team => listTeamConnectors(orgId, team.id))),
        ])
        const orgEnabledSlugs = new Set(catalog.filter(c => c.org_enabled === true).map(c => c.slug))
        const counts: Record<string, number> = {}
        activeTeams.forEach((team, i) => {
          const statusBySlug = new Map(statusRows[i].map(row => [row.connectorSlug, row.status]))
          let count = 0
          for (const connector of catalog) {
            const status = statusBySlug.get(connector.slug)
            const on = status === 'approved' ? true : status === 'denied' ? false : orgEnabledSlugs.has(connector.slug)
            if (on) count++
          }
          counts[team.id] = count
        })
        if (!cancelled) setConnectorCounts(counts)
      } catch {
        if (!cancelled) setConnectorCounts({})
      } finally {
        if (!cancelled) setConnectorCountsLoading(false)
      }
    }

    void loadConnectorCounts()
    return () => { cancelled = true }
  }, [orgId, isAdmin, teams])

  if (teamsLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
        <TeamsPageSkeleton />
      </div>
    )
  }

  const handleCreateTeam = async (name: string, desc: string) => {
    if (!orgId) return
    setSaving(true)
    try {
      await createTeam(orgId, name, desc)
      refreshTeams()
      setCreating(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        paddingTop:     64,
        paddingBottom:  48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1162, padding: '0 24px', boxSizing: 'border-box' }}>
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Teams
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Manage teams, membership, and projects within your workspace.
            </p>
          </div>
          {isAdmin && (
            <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => setCreating(o => !o)}>
              Create new team
            </Button>
          )}
        </div>

        <SettingsTable>
          <SettingsTableToolbar title="Team Members">
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
              {teamsLoading ? 'Loading…' : `${activeTeams.length} teams`}
            </p>
          </SettingsTableToolbar>

          <AnimatePresence initial={false}>
            {creating && (
              <CreateTeamForm
                borderPosition="bottom"
                onCancel={() => setCreating(false)}
                onCreate={handleCreateTeam}
              />
            )}
          </AnimatePresence>

          <SettingsTableHeader
            columns={TEAM_COLUMNS}
            columnGap={TEAM_COLUMN_GAP}
            style={{ minHeight: 44, padding: '6px 24px 16px' }}
          >
            <SettingsTableHeaderCell>Team</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Created</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Editors</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Members</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Connectors</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {!teamsLoading && activeTeams.length === 0 && !creating && (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No teams yet. Create your first team.
              </p>
            </div>
          )}

          {activeTeams.map((team) => (
            <SettingsTableRow
              key={team.id}
              columns={TEAM_COLUMNS}
              columnGap={TEAM_COLUMN_GAP}
              minHeight={72}
              divider
            >
              <SettingsTableCell>
                <TeamNameCell team={team} />
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <TextPill>{new Date(team.createdAt).toLocaleDateString()}</TextPill>
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <CountCell loading={countsLoading} count={editorCounts[team.id] ?? 0} noun="editor" color="Blue" />
              </SettingsTableCell>
              <SettingsTableCell align="center">
                <CountCell loading={countsLoading} count={memberCounts[team.id] ?? 0} noun="member" color="Purple" />
              </SettingsTableCell>
              <SettingsTableCell align="center">
                {isAdmin ? (
                  <CountCell loading={connectorCountsLoading} count={connectorCounts[team.id] ?? 0} noun="connector" color="Green" />
                ) : (
                  <TextPill>—</TextPill>
                )}
              </SettingsTableCell>
              <SettingsTableCell align="end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<SettingsOneIcon animated />}
                  onClick={() => router.push(ORG_TEAM_ROUTE(team.id))}
                >
                  Team settings
                </Button>
              </SettingsTableCell>
            </SettingsTableRow>
          ))}

        </SettingsTable>
      </div>
    </div>
  )
}
