'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusSignIcon, SearchOneIcon, CancelCircleIcon, ExchangeOneIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { RoleBadge }        from '@/components/RoleBadge'
import { CREDIT_CAP_COLUMNS, CreditCapRow } from '@/components/CreditCapRow'
import { Button }           from '@/components/Button'
import { Avatar }           from '@/components/Avatar'
import { InputField }       from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { AppInviteModal }   from '@/components/InviteModal'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableFooter,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { toast }           from 'sonner'
import { useOrg }           from '@/context/org-context'
import { useAuth }          from '@/context/auth-context'
import { setMemberRole, removeMember, revokeTeamInvite, getOrgSettings, setMemberCap } from '@/lib/api/organization'
import { inviteTeamMembers, addTeamEditor, removeTeamEditor, addProjectMember, removeProjectMember } from '@/lib/api/teams'
import { fetchProjects, type ApiProjectSummary } from '@/lib/api/projects'
import { fetchTeamAccessSnapshot } from '@/lib/team-access'
import { updateUser } from '@/lib/api/user'
import { ORG_TEAM_ROUTE } from '@/lib/routes'
import type { OrgMember, WorkspaceRole } from '@/types/teams'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_CARD      = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_REMOVE    = '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100)'
const SHADOW_REMOVE_INNER = 'inset 0px -2.182px 0.364px 0px var(--red-100)'

// ── Remove button (blur-swap animation) ───────────────────────────────────────

const REVEAL = { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const }

function RemoveButton({
  memberName,
  onConfirm,
  label = 'Remove',
  confirmLabel = 'Confirm remove',
  icon,
}: {
  memberName:    string
  onConfirm:     () => void
  /** Idle button text (e.g. "Remove" or "Revoke"). */
  label?:        string
  /** Confirmation button text (e.g. "Confirm remove" or "Revoke invite"). */
  confirmLabel?: string
  /** Leading icon for the idle button. Defaults to the remove-user glyph. */
  icon?:         React.ReactNode
}) {
  const [hov,        setHov]        = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!confirming ? (
        <motion.button
          key="remove"
          type="button"
          aria-label={`${label} ${memberName}`}
          onClick={() => setConfirming(true)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{
            display:         'inline-flex', alignItems: 'center', gap: 4,
            padding:         '5px 8px', borderRadius: 8, border: 'none',
            cursor:          'pointer', position: 'relative', overflow: 'hidden',
            backgroundColor: hov ? 'var(--red-50)' : 'var(--neutral-white)',
            boxShadow:       SHADOW_REMOVE,
            fontFamily:      'var(--font-body)', fontWeight: 500,
            fontSize:        'var(--font-size-body)', color: 'var(--red-500)',
            whiteSpace:      'nowrap', outline: 'none', transition: 'background-color 120ms ease',
          }}
        >
          {icon ?? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 7.875a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM1.75 12.25c0-2.071 2.351-3.5 5.25-3.5M10.5 10.5l1.75 1.75M12.25 10.5L10.5 12.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {label}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_REMOVE_INNER }} />
        </motion.button>
      ) : (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} style={{ flexShrink: 0 }}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setConfirming(false); onConfirm() }}
            style={{ color: 'var(--red-500)', flexShrink: 0 }}
          >
            {confirmLabel}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Role / Teams columns ──────────────────────────────────────────────────────
// Styled to match the TeamSwitcher dropdown (src/components/TeamSwitcher):
// same deterministic gradient team-avatar tile + the same RoleBadge component.
// Role and Teams are separate columns, but each is built from the same ordered
// `memberRoleTeamRows` list, one entry per team membership, and both columns
// render that list with identical row height/gap — so row i in the Role
// column always lines up horizontally with row i in the Teams column.

// Deterministic gradient palette, one row per team — kept in sync with
// TeamSwitcher/index.tsx's getTeamGradient so a team keeps the same color here.
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
          fontSize:       11,
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

// Row role spans the full RoleBadge role set (owner/admin/editor/member),
// which is wider than the org-editable `WorkspaceRole` (admin/editor/member).
type RoleTeamRoleValue = 'owner' | 'admin' | 'editor' | 'member'

interface RoleTeamRow {
  key:      string
  role:     RoleTeamRoleValue
  teamId:   string | null
  teamName: string
}

function memberRoleTeamRows(member: OrgMember): RoleTeamRow[] {
  if (member.orgRole === 'owner') {
    return [{ key: 'owner', role: 'owner', teamId: null, teamName: 'All teams' }]
  }
  if (member.orgRole === 'admin') {
    return [{ key: 'admin', role: 'admin', teamId: null, teamName: 'All teams' }]
  }
  if (member.teamMemberships.length === 0) {
    return [{ key: 'none', role: 'member', teamId: null, teamName: 'No team assigned' }]
  }
  return member.teamMemberships.map(t => ({
    key:      t.teamId,
    role:     t.isTeamOwner ? 'editor' : 'member',
    teamId:   t.teamId,
    teamName: t.teamName,
  }))
}

// Role and Team are shown together in one column: each team+role pair gets its
// own line, with a hairline divider between consecutive teams so a member on
// several teams reads as clearly separated entries. No card/background — just
// consistent row height and generous spacing, so it stays clean rather than
// looking like a boxed-in nested table.
//
// Each row is a 2-column grid (not flex) with a fixed-width role track, so
// every role badge starts flush left and every team entry starts flush left
// at the same x — regardless of how much shorter "Member" is than "Editor".
const ROLE_TEAM_DIVIDER     = '1px solid var(--neutral-100)'
const ROLE_TEAM_ROW_HEIGHT  = 36
const ROLE_TEAM_ROLE_COLUMN = 112

function roleTeamRowStyle(index: number, total: number): React.CSSProperties {
  const isLast = index === total - 1
  return {
    display:             'grid',
    gridTemplateColumns: `${ROLE_TEAM_ROLE_COLUMN}px 1fr`,
    alignItems:          'center',
    columnGap:           10,
    width:               '100%',
    minWidth:            0,
    height:              ROLE_TEAM_ROW_HEIGHT,
    boxSizing:           'border-box',
    borderBottom:        isLast ? 'none' : ROLE_TEAM_DIVIDER,
  }
}

// Pure display — role management now lives entirely in the "Manage role"
// modal (opened from the Actions column), not in these badges.
function RoleTeamCells({ rows }: { rows: RoleTeamRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
      {rows.map((r, i) => (
        <div key={r.key} style={roleTeamRowStyle(i, rows.length)}>
          <RoleBadge role={r.role} showLabel mode="solar" style={{ justifySelf: 'start' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {r.teamId ? (
              <>
                <TeamAvatar teamId={r.teamId} name={r.teamName} size={20} />
                <span
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontWeight:   'var(--font-weight-medium)',
                    fontSize:     'var(--font-size-body)',
                    lineHeight:   'var(--line-height-body)',
                    color:        'var(--neutral-900)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {r.teamName}
                </span>
              </>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize:   'var(--font-size-body)',
                  lineHeight: 'var(--line-height-body)',
                  color:      'var(--neutral-500)',
                }}
              >
                {r.teamName}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Manage-role modal ─────────────────────────────────────────────────────────
// One modal replaces the old badge dropdowns entirely: it covers both the
// org-level Admin/Member choice and, for a plain Member, a per-team
// None/Member/Editor choice — matching the actual data model (Admin is a
// blanket grant; Editor/Member are per-team grants layered on top of Member).
// Permission is enforced by the caller (only Owners/Admins ever get a "Manage
// role" button; only Owners can reach the Admin option here).

type TeamRoleValue = 'none' | 'member' | 'editor'
type TeamFilterValue = 'all' | 'assigned' | 'unassigned'

// Team list caps at 5 visible rows before scrolling (design-system scrollbar,
// same "kaya-scrollbar" class used elsewhere in this file) — the row height
// here matches a team row's actual rendered height (name + small Tabs pill).
const MANAGE_ROLE_TEAM_ROW_HEIGHT  = 46
const MANAGE_ROLE_TEAM_ROW_GAP     = 8
const MANAGE_ROLE_VISIBLE_TEAMS    = 5
const MANAGE_ROLE_TEAM_LIST_MAX_HEIGHT =
  MANAGE_ROLE_VISIBLE_TEAMS * MANAGE_ROLE_TEAM_ROW_HEIGHT + (MANAGE_ROLE_VISIBLE_TEAMS - 1) * MANAGE_ROLE_TEAM_ROW_GAP

// Shared column template — used by both the column header and every team row
// (independent DOM elements, kept pixel-aligned by using the same template
// string, the same approach SettingsTable/SettingsTableRow use elsewhere).
const MANAGE_ROLE_TEAM_GRID_COLUMNS = 'minmax(0, 1fr) 150px 170px'

const manageRoleColumnHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize:   12,
  color:      'var(--neutral-600)',
  margin:     0,
}

const manageRoleSectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize:   11,
  color:      'var(--neutral-400)',
  margin:     0,
}

function buildTeamRolesMap(member: OrgMember, teams: { id: string; name: string }[]): Record<string, TeamRoleValue> {
  const map: Record<string, TeamRoleValue> = {}
  for (const team of teams) {
    const tm = member.teamMemberships.find(t => t.teamId === team.id)
    map[team.id] = tm ? (tm.isTeamOwner ? 'editor' : 'member') : 'none'
  }
  return map
}

// Overrides the CSS custom properties TabsList/TabItem read for their selected
// pill (background, text, shadows) so a Tabs instance wrapped in this style
// renders its selected tab in black instead of the usual white — a visual
// "you changed this" flag. Scoped to just the wrapping element via inline
// style, so it never affects any other Tabs on the page.
const CHANGED_TAB_VARS = {
  '--tab-item-bg-selected':          '#000',
  '--tab-item-text-selected':        'var(--neutral-white)',
  '--shadow-tab-item-selected':      'none',
  '--shadow-tab-item-selected-inner': 'none',
} as React.CSSProperties

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily:      'var(--font-body)',
      fontWeight:      400,
      fontSize:        12,
      lineHeight:      '18px',
      color:           'var(--neutral-500)',
      margin:          0,
      padding:         '8px 10px',
      backgroundColor: 'var(--neutral-50)',
      borderRadius:    8,
    }}>
      {children}
    </p>
  )
}

// Small confirmation dialog stacked above ManageRoleModal (higher z-index) —
// used for both destructive removal actions inside it: removing the member
// from the workspace entirely, and removing them from a single team.
function ConfirmModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title:        string
  description:  React.ReactNode
  confirmLabel: string
  onCancel:     () => void
  onConfirm:    () => void
}) {
  // Same mousedown+click double-check as ManageRoleModal's own backdrop — a
  // layout shift between press and release shouldn't be able to misfire this.
  const backdropMouseDown = useRef(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          400,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onCancel()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           400,
          maxWidth:        'calc(100vw - 32px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '20px 24px 24px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

function ManageRoleModal({
  member,
  canPromoteToAdmin,
  teams,
  onCancel,
  onSave,
  onRemove,
}: {
  member:            OrgMember
  /** Only Owners can hand out Admin — a plain Admin can only move editor <-> member. */
  canPromoteToAdmin: boolean
  teams:             { id: string; name: string }[]
  onCancel:          () => void
  onSave:            (desiredOrgRole: 'admin' | 'member', teamRoles: Record<string, TeamRoleValue>) => void
  /** Removes the member from the workspace entirely — distinct from "Remove from team" below. */
  onRemove:          () => void
}) {
  const router = useRouter()
  const memberName = member.name || member.email
  const [roleMode, setRoleMode] = useState<'admin' | 'member'>(
    member.orgRole === 'admin' || member.orgRole === 'owner' ? 'admin' : 'member',
  )
  const [teamRoles, setTeamRoles] = useState<Record<string, TeamRoleValue>>(() => buildTeamRolesMap(member, teams))
  // Frozen at mount — never updated — so a team's Tabs can tell "edited this
  // session" apart from "already was this way." Comparing against `member`
  // directly wouldn't work since `member` itself doesn't change while the
  // modal is open, but this keeps the intent explicit at the call site.
  const [initialTeamRoles] = useState<Record<string, TeamRoleValue>>(() => buildTeamRolesMap(member, teams))
  const [teamSearch, setTeamSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>('all')
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(false)
  const [confirmRemoveTeamId, setConfirmRemoveTeamId] = useState<string | null>(null)
  const confirmRemoveTeam = teams.find(t => t.id === confirmRemoveTeamId) ?? null

  // Backdrop click-to-dismiss needs both the mousedown AND the click to have
  // landed directly on the backdrop. A plain `e.target === e.currentTarget`
  // check on click alone misfires here: switching to the Admin tab collapses
  // the team-access section, the flex-centered card shrinks, and if that
  // layout shift happens between this click's mousedown/mouseup the browser
  // can resolve the click's target to the (now-repositioned) backdrop instead
  // of the tab button that was actually pressed.
  const backdropMouseDown = useRef(false)

  const goToTeamSettings = (teamId: string) => {
    onCancel()
    router.push(ORG_TEAM_ROUTE(teamId))
  }

  const normalizedTeamSearch = teamSearch.trim().toLowerCase()
  const searchedTeams = normalizedTeamSearch
    ? teams.filter(team => team.name.toLowerCase().includes(normalizedTeamSearch))
    : teams
  const isJoined = (teamId: string) => (teamRoles[teamId] ?? 'none') !== 'none'
  const assignedTeams   = searchedTeams.filter(team => isJoined(team.id))
  const unassignedTeams = searchedTeams.filter(team => !isJoined(team.id))
  const showAssigned    = teamFilter !== 'unassigned' && assignedTeams.length > 0
  const showUnassigned  = teamFilter !== 'assigned' && unassignedTeams.length > 0
  const nothingToShow   = !showAssigned && !showUnassigned

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage User"
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onCancel()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           640,
          maxWidth:        'calc(100vw - 32px)',
          maxHeight:       'calc(100vh - 64px)',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 8px 32px rgba(0,0,0,0.12)',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            Manage User
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            Choose access for <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong>.
          </p>
        </div>

        <div className="kaya-scrollbar" style={{ padding: '3px 27px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Admin/Member tab on the left (Owners only); the workspace-removal
                action always sits at the right end of this same row, regardless
                of whether the tab itself is shown. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {canPromoteToAdmin ? (
                <Tabs value={roleMode} onValueChange={(value) => setRoleMode(value as 'admin' | 'member')}>
                  <TabsList size="small">
                    <TabsTrigger value="admin">Admin</TabsTrigger>
                    <TabsTrigger value="member">Member</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <div />
              )}
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemoveMember(true)}>
                Remove
              </Button>
            </div>
            {canPromoteToAdmin && (
              <InfoNote>
                {roleMode === 'admin'
                  ? 'They will get access to all teams when assigned as Admin.'
                  : 'They will only have access to the teams you assign them to below.'}
              </InfoNote>
            )}
          </div>

          {roleMode === 'member' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, color: 'var(--neutral-600)', margin: 0 }}>
                Team access
              </p>
              {!canPromoteToAdmin && (
                <InfoNote>They will only have access to the teams you assign them to below.</InfoNote>
              )}
              {teams.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>
                  No teams yet.
                </p>
              ) : (
                <>
                  {/* Search + assigned/unassigned filter, side by side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: '1 0 0', minWidth: 0 }}>
                      <InputField
                        label="Search teams"
                        showLabel={false}
                        showSubtitle={false}
                        size="small"
                        fluid
                        leftIcon={<SearchOneIcon size={16} />}
                        placeholder="Search teams"
                        value={teamSearch}
                        onChange={setTeamSearch}
                      />
                    </div>
                    <Tabs value={teamFilter} onValueChange={(value) => setTeamFilter(value as TeamFilterValue)}>
                      <TabsList size="small">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="assigned">Assigned</TabsTrigger>
                        <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Column header — shares the same grid template as every row below,
                      so "Team"/"Role"/"Actions" line up with their columns exactly. */}
                  <div style={{ display: 'grid', gridTemplateColumns: MANAGE_ROLE_TEAM_GRID_COLUMNS, gap: 12, padding: '0 10px' }}>
                    <p style={manageRoleColumnHeaderStyle}>Team</p>
                    <p style={manageRoleColumnHeaderStyle}>Role</p>
                    <p style={{ ...manageRoleColumnHeaderStyle, textAlign: 'right' }}>Actions</p>
                  </div>

                  <div
                    className="kaya-scrollbar"
                    style={{
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           MANAGE_ROLE_TEAM_ROW_GAP,
                      maxHeight:     MANAGE_ROLE_TEAM_LIST_MAX_HEIGHT,
                      overflowY:     'auto',
                      padding:       3,
                    }}
                  >
                    {nothingToShow ? (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)', margin: 0, padding: '8px 2px' }}>
                        {teamSearch.trim() ? `No teams match “${teamSearch}”.` : 'No teams to show.'}
                      </p>
                    ) : (
                      <>
                        {showAssigned && (
                          <>
                            <p style={manageRoleSectionLabelStyle}>Assigned teams ({assignedTeams.length})</p>
                            {assignedTeams.map(team => (
                              <div
                                key={team.id}
                                style={{
                                  display:             'grid',
                                  gridTemplateColumns: MANAGE_ROLE_TEAM_GRID_COLUMNS,
                                  alignItems:          'center',
                                  gap:                 12,
                                  minHeight:           MANAGE_ROLE_TEAM_ROW_HEIGHT,
                                  padding:             '8px 10px',
                                  borderRadius:        10,
                                  border:              '1px solid var(--neutral-200)',
                                  boxSizing:           'border-box',
                                  flexShrink:          0,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  <TeamAvatar teamId={team.id} name={team.name} size={36} />
                                  <span style={{
                                    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-800)',
                                    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {team.name}
                                  </span>
                                </div>
                                <div style={
                                  (teamRoles[team.id] ?? 'none') !== (initialTeamRoles[team.id] ?? 'none')
                                    ? CHANGED_TAB_VARS
                                    : undefined
                                }>
                                  <Tabs
                                    value={teamRoles[team.id] ?? 'member'}
                                    onValueChange={(value) => setTeamRoles(prev => ({ ...prev, [team.id]: value as TeamRoleValue }))}
                                  >
                                    <TabsList size="small">
                                      <TabsTrigger value="member">Member</TabsTrigger>
                                      <TabsTrigger value="editor">Editor</TabsTrigger>
                                    </TabsList>
                                  </Tabs>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setConfirmRemoveTeamId(team.id)}
                                  >
                                    Remove from team
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {showAssigned && showUnassigned && (
                          <div style={{ height: 1, backgroundColor: 'var(--neutral-200)', margin: '4px 0' }} />
                        )}

                        {showUnassigned && (
                          <>
                            <p style={manageRoleSectionLabelStyle}>Unassigned teams ({unassignedTeams.length})</p>
                            {unassignedTeams.map(team => (
                              <div
                                key={team.id}
                                style={{
                                  display:             'grid',
                                  gridTemplateColumns: MANAGE_ROLE_TEAM_GRID_COLUMNS,
                                  alignItems:          'center',
                                  gap:                 12,
                                  minHeight:           MANAGE_ROLE_TEAM_ROW_HEIGHT,
                                  padding:             '8px 10px',
                                  borderRadius:        10,
                                  border:              '1px solid var(--neutral-200)',
                                  boxSizing:           'border-box',
                                  flexShrink:          0,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  <TeamAvatar teamId={team.id} name={team.name} size={36} />
                                  <span style={{
                                    fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--neutral-800)',
                                    minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {team.name}
                                  </span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)' }}>—</span>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    leftIcon={<PlusSignIcon size={16} />}
                                    onClick={() => goToTeamSettings(team.id)}
                                  >
                                    Invite to team
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '20px 24px 24px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="default" size="sm" onClick={() => onSave(roleMode, teamRoles)}>Save</Button>
        </div>
      </div>
    </div>

    {confirmRemoveMember && (
      <ConfirmModal
        title="Remove member?"
        description={
          <>This will remove <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong> from the workspace entirely.</>
        }
        confirmLabel="Remove member"
        onCancel={() => setConfirmRemoveMember(false)}
        onConfirm={() => {
          setConfirmRemoveMember(false)
          onRemove()
        }}
      />
    )}

    {confirmRemoveTeam && (
      <ConfirmModal
        title="Remove from team?"
        description={
          <>This will remove <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong> from{' '}
          <strong style={{ color: 'var(--neutral-700)' }}>{confirmRemoveTeam.name}</strong>.</>
        }
        confirmLabel="Remove from team"
        onCancel={() => setConfirmRemoveTeamId(null)}
        onConfirm={() => {
          setTeamRoles(prev => ({ ...prev, [confirmRemoveTeam.id]: 'none' }))
          setConfirmRemoveTeamId(null)
        }}
      />
    )}
    </>
  )
}

// ── Members table ─────────────────────────────────────────────────────────────

const WORKSPACE_MEMBER_COLUMNS = 'minmax(260px, 1.25fr) minmax(320px, 1.5fr) 150px'

function MembersTable({
  members,
  ownerMemberId,
  isAdmin,
  isCurrentUserOwner = false,
  loading,
  teams,
  onManageRole,
  onRemove,
  onRevokeInvite,
  onInviteClick,
  onRefresh,
}: {
  members:              OrgMember[]
  ownerMemberId:        string
  isAdmin:              boolean
  isCurrentUserOwner?:  boolean
  loading?:             boolean
  /** Active teams offered in the Manage-role modal's per-team list. */
  teams:                { id: string; name: string }[]
  onManageRole:         (id: string, desiredOrgRole: 'admin' | 'member', teamRoles: Record<string, TeamRoleValue>) => void
  onRemove:             (id: string) => void
  onRevokeInvite:       (id: string) => void
  onInviteClick:        () => void
  onRefresh:            () => void
}) {
  const [searchQuery,   setSearchQuery]   = useState('')
  // Which member's "Manage role" modal is open, if any.
  const [manageRoleTarget, setManageRoleTarget] = useState<OrgMember | null>(null)

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredMembers = normalizedQuery
    ? members.filter(member => (
        member.name.toLowerCase().includes(normalizedQuery)
        || member.email.toLowerCase().includes(normalizedQuery)
        || member.role.toLowerCase().includes(normalizedQuery)
        || member.orgRole.toLowerCase().includes(normalizedQuery)
        || member.teamMemberships.some(team => team.teamName.toLowerCase().includes(normalizedQuery))
      ))
    : members

  return (
    <SettingsTable columns={WORKSPACE_MEMBER_COLUMNS} columnGap={0}>
      <SettingsTableToolbar title="Workspace Members" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, maxWidth: '100%' }}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ExchangeOneIcon animated size={16} />}
            aria-label="Refresh members"
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <div style={{ width: 220, maxWidth: '100%', flexShrink: 1 }}>
            <InputField
              label="Search members"
              showLabel={false}
              showSubtitle={false}
              size="small"
              fluid
              leftIcon={<SearchOneIcon size={16} />}
              placeholder="Search members"
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PlusSignIcon size={16} />}
              onClick={onInviteClick}
            >
              Invite members
            </Button>
          )}
        </div>
      </SettingsTableToolbar>

      <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Workspace members" style={{ minWidth: 900 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>
              {/* Split into two labels on the same grid template as roleTeamRowStyle,
                  so "Role" sits directly above the role badges and "Team" sits
                  directly above the team avatar/name below it. */}
              <span style={{ display: 'grid', gridTemplateColumns: `${ROLE_TEAM_ROLE_COLUMN}px 1fr`, columnGap: 10, width: '100%' }}>
                <span>Role</span>
                <span>Team</span>
              </span>
            </SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Actions</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {loading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                Loading members…
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                {members.length === 0 ? 'No members yet' : 'No members match your search'}
              </p>
            </div>
          ) : filteredMembers.map(member => {
            const isOwner = member.id === ownerMemberId
            // Owners can manage anyone except the owner. A plain admin can only
            // manage members whose orgRole is already 'member' (covers both the
            // "Editor" and "Member" UI labels) — never another admin.
            const canManageRole = isAdmin && !isOwner && member.inviteStatus !== 'invite_sent' && (isCurrentUserOwner || member.orgRole === 'member')
            const roleTeamRows = memberRoleTeamRows(member)

            return (
              <SettingsTableRow
                key={member.id}
                minHeight={72}
              >
                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar name={member.name || member.email} size="md" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name || member.email}
                        </span>
                        {member.inviteStatus === 'invite_sent' && (
                          <Badge color="Neutral" label="Invite sent" />
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.email}
                      </span>
                    </div>
                  </div>
                </SettingsTableCell>

                <SettingsTableCell style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <RoleTeamCells rows={roleTeamRows} />
                </SettingsTableCell>

                <SettingsTableCell align="end" style={{ alignSelf: 'flex-start', paddingTop: 16, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {canManageRole && (
                      <Button variant="secondary" size="sm" onClick={() => setManageRoleTarget(member)}>
                        Manage User
                      </Button>
                    )}
                    {isAdmin && !isOwner && member.inviteStatus === 'invite_sent' && (
                      <RemoveButton
                        memberName={member.name || member.email}
                        label="Revoke"
                        confirmLabel="Revoke invite"
                        icon={<CancelCircleIcon size={14} />}
                        onConfirm={() => onRevokeInvite(member.id)}
                      />
                    )}
                  </div>
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}

          <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>
              {normalizedQuery
                ? `${filteredMembers.length} of ${members.length} members`
                : `${members.length} member${members.length === 1 ? '' : 's'}`}
            </span>
          </SettingsTableFooter>
        </div>
      </div>

      {manageRoleTarget && (
        <ManageRoleModal
          member={manageRoleTarget}
          canPromoteToAdmin={isCurrentUserOwner}
          teams={teams}
          onCancel={() => setManageRoleTarget(null)}
          onSave={(desiredOrgRole, teamRoles) => {
            onManageRole(manageRoleTarget.id, desiredOrgRole, teamRoles)
            setManageRoleTarget(null)
          }}
          onRemove={() => {
            onRemove(manageRoleTarget.id)
            setManageRoleTarget(null)
          }}
        />
      )}
    </SettingsTable>
  )
}

// ── Roles & Permissions section (collapsible) ────────────────────────────────

const ROLES_INFO = [
  { role: 'owner'  as const, description: 'Full organization control, including billing, payment methods, invoices, subscriptions, topup credit purchases, and ownership transfer.' },
  { role: 'admin'  as const, description: 'Everything a owner can do. But cannot manage billing or payments.' },
  { role: 'editor' as const, description: 'Inherits Member access and can edit content in assigned teams, without organization settings or member administration.' },
  { role: 'member' as const, description: 'Baseline access through assigned projects. Cannot change organization settings, manage other members, or edit teams.' },
]

function RolesPermissionsSection() {
  const [open, setOpen] = React.useState(true)

  return (
    <div style={{
      borderRadius:    16,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: '#f9f5f1',
      overflow:        'hidden',
      width:           '100%',
      boxShadow:       SHADOW_CARD,
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, padding: '12px 24px 16px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--neutral-100)' : 'none', textAlign: 'left',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--neutral-900)', margin: 0 }}>
            Roles &amp; Permissions
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)', margin: '3px 0 0' }}>
            Default behavior for new projects and chats across the workspace.
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
          style={{ flexShrink: 0, marginTop: 4, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease', color: 'var(--neutral-400)' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && ROLES_INFO.map((item, index) => (
        <React.Fragment key={item.role}>
          {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: '0 24px' }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px' }}>
            <Badge
              label={item.role.charAt(0).toUpperCase() + item.role.slice(1)}
              color={item.role === 'owner' ? 'Purple' : item.role === 'admin' ? 'Blue' : item.role === 'editor' ? 'Green' : 'Neutral'}
              style={{ flexShrink: 0 }}
            />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-body)', color: 'var(--neutral-700)', lineHeight: 'var(--line-height-body)' }}>
              {item.description}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'membersSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function MembersPageSkeleton() {
  return (
    <>
      <style>{`@keyframes membersSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={120} height={28} radius={6} />
          <SkeletonBlock width={320} height={14} radius={4} />
        </div>

        {/* Stats row */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: SHADOW_CARD, padding: 12, display: 'flex', gap: 9 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: '1 0 0', minWidth: 0, backgroundColor: i === 0 ? 'var(--neutral-50)' : 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: i === 0 ? 'none' : '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
              <SkeletonBlock width={90} height={13} radius={4} />
              <SkeletonBlock width={40} height={28} radius={6} />
              <SkeletonBlock width={100} height={12} radius={4} />
            </div>
          ))}
        </div>

        {/* Members table skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', boxShadow: SHADOW_CARD, overflow: 'hidden', width: '100%' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={120} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={110} height={32} radius={8} />
          </div>
          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 24px 8px' }}>
            <div style={{ flex: '1 0 0', minWidth: 200 }}><SkeletonBlock width={60} height={13} radius={4} /></div>
            <div style={{ width: 110 }}><SkeletonBlock width={40} height={13} radius={4} /></div>
            <div style={{ width: 200 }}><SkeletonBlock width={50} height={13} radius={4} /></div>
            <div style={{ minWidth: 180, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={60} height={13} radius={4} /></div>
          </div>
          {/* Member rows */}
          {[0, 1, 2, 3].map((i, idx) => (
            <React.Fragment key={i}>
              {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <div style={{ flex: '1 0 0', minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={32} height={32} radius={16} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={120} height={13} radius={4} />
                    <SkeletonBlock width={160} height={11} radius={4} />
                  </div>
                </div>
                <div style={{ width: 110 }}><SkeletonBlock width={70} height={28} radius={8} /></div>
                <div style={{ width: 200 }}><SkeletonBlock width={80} height={20} radius={6} /></div>
                <div style={{ minWidth: 180, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={72} height={28} radius={8} /></div>
              </div>
            </React.Fragment>
          ))}
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={160} height={13} radius={4} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={32} height={32} radius={8} />
              <SkeletonBlock width={32} height={32} radius={8} />
              <SkeletonBlock width={32} height={32} radius={8} />
            </div>
          </div>
        </div>

        {/* Roles & Permissions skeleton */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', overflow: 'hidden', width: '100%', boxShadow: SHADOW_CARD }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={150} height={15} radius={4} />
              <SkeletonBlock width={280} height={13} radius={4} />
            </div>
            <SkeletonBlock width={16} height={16} radius={4} />
          </div>
        </div>

      </div>
    </>
  )
}

function displayRoleFor(member: OrgMember): WorkspaceRole {
  if (member.orgRole === 'owner' || member.orgRole === 'admin') return 'admin'
  return member.teamMemberships.some(team => team.isTeamOwner) ? 'editor' : 'member'
}

function mergeTeamMemberships(
  baseMemberships: OrgMember['teamMemberships'],
  editorMemberships: OrgMember['teamMemberships'],
): OrgMember['teamMemberships'] {
  const merged = new Map<string, OrgMember['teamMemberships'][number]>()

  for (const membership of baseMemberships) {
    merged.set(membership.teamId, membership)
  }
  for (const membership of editorMemberships) {
    const existing = merged.get(membership.teamId)
    merged.set(
      membership.teamId,
      existing
        ? { ...existing, isTeamOwner: existing.isTeamOwner || membership.isTeamOwner }
        : membership,
    )
  }

  return [...merged.values()]
}

// ── Credit caps section ───────────────────────────────────────────────────────
// Per-member credit-cap editing (may-day CreditCapRow). Pending invitees are
// omitted — the backend cap endpoint is keyed by user_id, which they lack until
// they accept (the invite's own cap is applied on accept instead).

function CreditCapsSection({ members, isAdmin, onAssignCredits }: {
  members:     OrgMember[]
  isAdmin:     boolean
  onAssignCredits: (memberId: string, amount: number) => void | Promise<void>
}) {
  const active = members.filter(m => m.inviteStatus === 'signed_up')
  if (active.length === 0) return null

  return (
    <SettingsTable columns={CREDIT_CAP_COLUMNS} columnGap={0}>
      <SettingsTableToolbar title="Per-member credit caps" />
      <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Per-member credit caps" style={{ minWidth: 810 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Allocation used</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Current cap</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Remaining</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="center">Assign credits</SettingsTableHeaderCell>
          </SettingsTableHeader>
          {active.map(m => (
            <CreditCapRow
              key={m.id}
              memberName={m.name || m.email}
              email={m.email}
              creditUsed={m.creditUsed}
              allocationUsed={m.allocationUsed}
              creditCap={m.creditCap}
              isAdmin={isAdmin}
              canAssign={m.orgRole === 'member'}
              onAssignCredits={(amount) => onAssignCredits(m.id, amount)}
            />
          ))}
        </div>
      </div>
    </SettingsTable>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgMembersPage() {
  const { orgId, org, members: orgMembers, membersLoading, currentUserRole, teams, refreshMembers } = useOrg()
  const { user } = useAuth()
  const isAdmin = currentUserRole === 'admin'
  const currentUserIsOwner = orgMembers.find(m => m.email === user?.email)?.orgRole === 'owner'

  const [members,        setMembers]        = useState<OrgMember[]>(orgMembers)
  // Bumped by every optimistic local edit (role change, remove, invite, ...).
  // syncMembers below does a slow background fetch (fetchTeamAccessSnapshot
  // fans out per-team/per-project calls) — if a user acts while that fetch is
  // still in flight, its eventually-stale result must not clobber the fresher
  // optimistic state. Without this guard that's exactly what happened: a role
  // change would show a success toast but silently revert once the in-flight
  // resync landed, only "sticking" on a second attempt once no resync was
  // still pending.
  const membersVersionRef = useRef(0)

  // Sync context members into local state when the API response arrives.
  // useState only uses its initial value once, so without this effect the table
  // stays empty until the component is remounted.
  useEffect(() => {
    let cancelled = false

    async function syncMembers() {
      const requestVersion = membersVersionRef.current
      let next = orgMembers.map(member => ({ ...member, role: displayRoleFor(member) }))

      const activeTeams = teams.filter(t => !t.archived)
      if (orgId && activeTeams.length > 0) {
        const { membershipsByUser } = await fetchTeamAccessSnapshot(orgId, activeTeams)
        next = next.map(member => {
          const accessMemberships = membershipsByUser.get(member.id) ?? []
          const teamMemberships = member.orgRole === 'owner' || member.orgRole === 'admin'
            ? []
            : member.inviteStatus === 'invite_sent'
            ? member.teamMemberships
            : mergeTeamMemberships(member.teamMemberships, accessMemberships)
          return { ...member, teamMemberships, role: displayRoleFor({ ...member, teamMemberships }) }
        })
      }

      // An optimistic edit landed while this fetch was in flight — drop this
      // now-stale result instead of overwriting the fresher local state.
      if (membersVersionRef.current !== requestVersion) return

      if (!cancelled) setMembers(next)
    }

    void syncMembers()
    return () => { cancelled = true }
  }, [orgId, orgMembers, teams])

  // Every optimistic local edit goes through this instead of setMembers
  // directly, so any in-flight background resync (see syncMembers above)
  // knows to discard its result rather than clobber the edit.
  const bumpMembers = (updater: React.SetStateAction<OrgMember[]>) => {
    membersVersionRef.current += 1
    setMembers(updater)
  }

  const [inviteOpen,     setInviteOpen]     = useState(false)
  const [inviteLoading,  setInviteLoading]  = useState(false)
  const [projects,       setProjects]       = useState<ApiProjectSummary[]>([])
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshMembers() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshMembers])

  useEffect(() => {
    if (!orgId) return
    getOrgSettings(orgId)
      .then(s => setAllowedDomains(s.allowedEmailDomains ?? []))
      .catch(() => { /* non-fatal — open invite if settings unavailable */ })
  }, [orgId])

  useEffect(() => {
    if (!inviteOpen) return
    let cancelled = false
    fetchProjects()
      .then(items => {
        if (!cancelled) setProjects(items.filter(project => project.teamId))
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
    return () => { cancelled = true }
  }, [inviteOpen])

  // Sync the current user's name to the backend when it appears stale
  // ("Someone" or empty) — mirrors how the individual plan syncs via
  // updateUser() during onboarding/settings.
  const currentUserName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    (user?.name && !user.name.includes('@') ? user.name : '')

  useEffect(() => {
    if (!user?.email || !currentUserName) return
    const self = members.find(m => m.email === user.email)
    if (!self) return
    const nameIsStale = !self.name || self.name.toLowerCase() === 'someone'
    if (!nameIsStale) return
    const [first, ...rest] = currentUserName.split(' ')
    updateUser({ first_name: first ?? '', last_name: rest.join(' ') || null })
      .then(() => {
        bumpMembers(prev => prev.map(m =>
          m.email === user.email ? { ...m, name: currentUserName } : m,
        ))
      })
      .catch(() => { /* non-fatal — UI already shows the correct name via displayMembers */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, currentUserName, members.length])

  const displayMembers = members.map(m =>
    user?.email && m.email === user.email && currentUserName
      ? { ...m, name: currentUserName }
      : m
  )

  // The workspace owner (cannot be removed). Use the real backend role; fall
  // back to the first admin only if no member is flagged as owner.
  const ownerMemberId =
    members.find(m => m.orgRole === 'owner')?.id ??
    members.find(m => m.role === 'admin')?.id ??
    ''

  const totalMembers   = members.length
  const adminCount     = members.filter(m => m.orgRole === 'owner' || m.orgRole === 'admin').length
  const pendingInvites = members.filter(m => m.inviteStatus === 'invite_sent').length

  // Applies the Manage-role modal's result: an org-level Admin/Member choice,
  // plus — when staying/moving to Member — a per-team None/Member/Editor
  // choice for every active team. Diffs against the member's current state so
  // only the teams that actually changed trigger API calls.
  //
  // Editor status (TeamEditor) is a team-wide grant; plain "member" status
  // only exists as project-level grants (ProjectMember) on that team's
  // projects — there's no such thing as a bare "team membership" row. So
  // granting "Member" for a team means adding them to that team's projects,
  // and demoting Editor -> Member must add that project access *before*
  // dropping the editor grant, or they're left with no relationship to the
  // team at all.
  //
  // fetchProjects() is scoped to what's visible to the ADMIN performing this
  // (their own projects, plus "team"-visibility projects in teams they run) —
  // it can't see a "private"-visibility project owned by someone else, even
  // for an org admin (there's no team-scoped "list every project" endpoint to
  // fall back on). So a team's projects can legitimately come back empty even
  // when it does have one. When that happens we skip that team's change
  // rather than silently stripping access, and report it.
  const handleManageRole = async (
    memberId: string,
    desiredOrgRole: 'admin' | 'member',
    desiredTeamRoles: Record<string, TeamRoleValue>,
  ) => {
    const member = members.find(m => m.id === memberId)
    if (!member || !orgId) return
    const memberName = member.name || member.email
    const prev = members

    try {
      if (desiredOrgRole === 'admin') {
        if (member.orgRole !== 'admin') {
          await setMemberRole(orgId, memberId, 'admin')
        }
        // Admin has blanket access regardless of per-team grants — drop any
        // lingering ones so a later demotion doesn't resurrect stale access.
        const currentEditorTeamIds = member.teamMemberships.filter(tm => tm.isTeamOwner).map(tm => tm.teamId)
        await Promise.all(currentEditorTeamIds.map(tid => removeTeamEditor(orgId, tid, memberId).catch(() => {})))
        bumpMembers(ms => ms.map(m => m.id === memberId ? { ...m, role: 'admin', orgRole: 'admin', teamMemberships: [] } : m))
        toast.success(`${memberName} is now an Admin`)
        refreshMembers()
        return
      }

      if (member.orgRole === 'admin') {
        await setMemberRole(orgId, memberId, 'member')
      }

      const currentByTeam = new Map<string, TeamRoleValue>(
        member.teamMemberships.map(tm => [tm.teamId, tm.isTeamOwner ? 'editor' : 'member']),
      )
      const diffs = Object.entries(desiredTeamRoles).filter(
        ([teamId, desired]) => (currentByTeam.get(teamId) ?? 'none') !== desired,
      )

      if (diffs.length === 0) {
        toast.success(`Updated ${memberName}'s role`)
        refreshMembers()
        return
      }

      // Only fetch projects if some diff actually needs project-level grants
      // (granting "member" going forward, or removing "member" going back).
      const needsProjects = diffs.some(([teamId, desired]) => desired === 'member' || currentByTeam.get(teamId) === 'member')
      const allProjects = needsProjects ? await fetchProjects() : []
      const projectsByTeam = new Map<string, ApiProjectSummary[]>()
      for (const p of allProjects) {
        if (!p.teamId) continue
        projectsByTeam.set(p.teamId, [...(projectsByTeam.get(p.teamId) ?? []), p])
      }

      const failures: string[] = []

      for (const [teamId, desired] of diffs) {
        const current = currentByTeam.get(teamId) ?? 'none'
        const teamName = teams.find(t => t.id === teamId)?.name ?? 'team'
        const teamProjects = projectsByTeam.get(teamId) ?? []

        if (desired === 'editor') {
          await addTeamEditor(orgId, teamId, memberId)
        } else if (desired === 'member') {
          if (teamProjects.length === 0) {
            failures.push(`${teamName} (no visible project to grant membership through)`)
            continue
          }
          const granted = await Promise.allSettled(teamProjects.map(p => addProjectMember(orgId, teamId, p.id, memberId)))
          if (!granted.some(g => g.status === 'fulfilled')) {
            failures.push(`${teamName} (couldn't grant project membership)`)
            continue
          }
          if (current === 'editor') await removeTeamEditor(orgId, teamId, memberId)
        } else {
          if (current === 'editor') await removeTeamEditor(orgId, teamId, memberId)
          await Promise.all(teamProjects.map(p => removeProjectMember(orgId, teamId, p.id, memberId).catch(() => {})))
        }
      }

      if (failures.length > 0) {
        toast.error(`Some changes couldn't be applied: ${failures.join(', ')}`)
      } else {
        toast.success(`Updated ${memberName}'s role`)
      }
      refreshMembers()
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleRemove = async (id: string) => {
    const prev = members
    const removed = prev.find(m => m.id === id)
    bumpMembers(ms => ms.filter(m => m.id !== id))
    if (!orgId) return
    try {
      await removeMember(orgId, id)
      toast.success(`Removed ${removed?.name || removed?.email || 'member'}`)
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handleRevokeInvite = async (id: string) => {
    const prev = members
    const invited = prev.find(m => m.id === id)
    bumpMembers(ms => ms.filter(m => m.id !== id))
    if (!orgId) return
    try {
      // Pending invites live in the team invite table, not the member table.
      // Use the invite-specific DELETE endpoint; fall back to removeMember only
      // if invite metadata is missing (e.g. optimistic row before BE refresh).
      if (invited?.inviteId && invited.inviteTeamId) {
        await revokeTeamInvite(orgId, invited.inviteTeamId, invited.inviteId)
      } else {
        await removeMember(orgId, id)
      }
      toast.success(`Invite to ${invited?.email || 'member'} revoked`)
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite')
    }
  }

  const handleInvite = async (
    email: string,
    role: WorkspaceRole,
    creditCap?: number,
    selectedTeamId?: string,
    projectId?: string,
  ) => {
    if (!orgId) return

    const normalizedEmail = email.trim().toLowerCase()
    const alreadyMember = members.some(m => m.email?.toLowerCase() === normalizedEmail)
    if (alreadyMember) {
      toast.error(`${email} is already a member of this workspace`)
      return
    }

    if (allowedDomains.length > 0) {
      const domain = email.trim().split('@')[1]?.toLowerCase() ?? ''
      if (!allowedDomains.includes(domain)) {
        toast.error('Email domain not allowed', {
          description: `Invites are restricted to: ${allowedDomains.join(', ')}`,
        })
        return
      }
    }

    const teamId = selectedTeamId ?? teams.find(t => !t.archived)?.id
    if (!teamId) {
      toast.error('Create a team first before inviting members')
      return
    }
    setInviteLoading(true)
    try {
      // The backend now grants TeamEditor (for editor invites) and applies the
      // credit cap on accept — no fragile post-invite second calls needed.
      // Caps are entered in display credits; the API takes raw (÷1000).
      await inviteTeamMembers(
        orgId,
        teamId,
        [email],
        role,
        creditCap && creditCap > 0 ? creditCap / 1000 : undefined,
        projectId,
      )

      // Optimistic pending row. The cap and team-editor grant only take effect
      // once the invite is accepted, so they're not shown on the pending row.
      bumpMembers(prev => [...prev, {
        id:              `invite_${Date.now()}`,
        name:            email.split('@')[0] ?? email,
        email,
        role,
        orgRole:         role === 'admin' ? 'admin' : 'member',
        inviteStatus:    'invite_sent',
        teamMemberships: [{
          teamId,
          teamName: teams.find(t => t.id === teamId)?.name ?? 'Team',
          isTeamOwner: role === 'editor',
        }],
        creditUsed:      0,
        allocationUsed:  0,
      }])
      setInviteOpen(false)
      toast.success('Invite sent')
      // Reconcile the optimistic (synthetic-id) row with the real backend
      // invite record so its user_id is available for revoking.
      refreshMembers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  // Assign additional display credits. The API accepts the resulting total cap
  // in raw credits (÷1000) and deducts only the added delta from the owner pool.
  const handleAssignCredits = async (memberId: string, amount: number) => {
    if (!orgId) return
    const member = members.find(m => m.id === memberId)
    if (!member || member.orgRole !== 'member' || amount <= 0) return
    const newCap = (member.creditCap ?? 0) + amount
    const prev = members
    bumpMembers(ms => ms.map(m => (m.id === memberId ? { ...m, creditCap: newCap } : m)))
    try {
      await setMemberCap(orgId, memberId, newCap / 1000)
      toast.success(`${amount.toLocaleString()} credits assigned`)
      refreshMembers()
    } catch (err) {
      bumpMembers(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to assign credits')
    }
  }

  if (membersLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <MembersPageSkeleton />
      </div>
    )
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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
            Members
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            Manage who has access to your workspace and what they can do.
          </p>
        </div>

        {/* Stats row */}
        <div style={{
          border:       '1px solid var(--neutral-200)',
          borderRadius: 16,
          boxShadow:    SHADOW_CARD,
          padding:      12,
          display:      'flex',
          gap:          9,
        }}>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-50)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Total members</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{totalMembers}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>unlimited seats</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Admins</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{adminCount}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>in this workspace</p>
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0 }}>Pending invites</p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>{pendingInvites}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: 0 }}>awaiting acceptance</p>
          </div>
        </div>

        {/* Members table */}
        <MembersTable
          members={displayMembers}
          ownerMemberId={ownerMemberId}
          isAdmin={isAdmin}
          isCurrentUserOwner={currentUserIsOwner}
          loading={membersLoading}
          teams={teams.filter(t => !t.archived).map(team => ({ id: team.id, name: team.name }))}
          onManageRole={(id, desiredOrgRole, teamRoles) => void handleManageRole(id, desiredOrgRole, teamRoles)}
          onRemove={handleRemove}
          onRevokeInvite={handleRevokeInvite}
          onInviteClick={() => setInviteOpen(true)}
          onRefresh={refreshMembers}
        />

        {/* Credit caps */}
        <CreditCapsSection members={members} isAdmin={isAdmin} onAssignCredits={handleAssignCredits} />

        {/* Roles & Permissions */}
        <RolesPermissionsSection />

      </div>

      {/* Invite modal */}
      <AppInviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        workspaceName={org.name}
        loading={inviteLoading}
        teams={teams.filter(t => !t.archived).map(team => ({ id: team.id, name: team.name }))}
        projects={projects.flatMap(project => (
          project.teamId
            ? [{ id: project.id, title: project.title, teamId: project.teamId }]
            : []
        ))}
      />
    </div>
  )
}
