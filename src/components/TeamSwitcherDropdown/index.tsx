'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import {
  ArrowDownOneIcon,
  SettingsOneIcon,
  TokenCircleIcon,
  UserAddOneIcon,
  AuditTwoIcon,
  DashboardSquareOneIcon,
  LinkSixIcon,
  FolderOneIcon,
} from '@strange-huge/icons'
import { Dropdown } from '@/components/Dropdown'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole, RoleBadgeMode } from '@/components/RoleBadge'

// ── Team gradient (same algorithm as TeamChip / TeamSwitcher) ─────────────────

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',
]

function getGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i)
    h |= 0
  }
  return TEAM_GRADIENTS[Math.abs(h) % TEAM_GRADIENTS.length]!
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Team {
  id:           string
  name:         string
  projectCount: number
  /** This user's role **in this team**. Owner/Admin are org-level (uniform
   *  across every team); editor/member vary per team. Drives the row's
   *  RoleBadge and its action flyout (member → no flyout). */
  userRole:     WorkspaceRole
}

export interface TeamSwitcherDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  teams:            Team[]
  activeTeamId?:    string
  /** Org-level role. Gates the chrome only: `owner`/`admin` see the "All Teams"
   *  label + the "Manage Teams" row. Each team's own `userRole` drives its
   *  badge + action flyout. */
  currentUserRole:  WorkspaceRole
  roleMode?:        RoleBadgeMode
  onSelectTeam?:    (teamId: string) => void
  onSelectPersonal?: () => void
  onManageTeams?:   () => void
  onActionSelect?:  (teamId: string, action: string) => void
  asChild?:         boolean
}

// ── Per-team action sets (flyout contents, keyed on the team's role) ──────────
// Icons passed bare — DropdownMenuItem injects the canonical slot size.

type ActionItem = { id: string; label: string; icon: React.ReactElement }

const OWNER_ADMIN_ACTIONS: ActionItem[] = [
  { id: 'manage',   label: 'Manage',   icon: <SettingsOneIcon /> },
  { id: 'usage',    label: 'Usage',    icon: <TokenCircleIcon /> },
  { id: 'request',  label: 'Request',  icon: <UserAddOneIcon /> },
  { id: 'activity', label: 'Activity', icon: <AuditTwoIcon /> },
]

const EDITOR_ACTIONS: ActionItem[] = [
  { id: 'projects',   label: 'Projects',   icon: <DashboardSquareOneIcon /> },
  { id: 'connectors', label: 'Connectors', icon: <LinkSixIcon /> },
  { id: 'request',    label: 'Request',    icon: <UserAddOneIcon /> },
  { id: 'activity',   label: 'Activity',   icon: <AuditTwoIcon /> },
]

// A **member** team has no action flyout — "just a member" of that team.
function getActions(role: WorkspaceRole): ActionItem[] {
  if (role === 'owner' || role === 'admin') return OWNER_ADMIN_ACTIONS
  if (role === 'editor') return EDITOR_ACTIONS
  return [] // member → no flyout
}

// ── Gradient team avatar (passed into DropdownMenuItem's avatar slot) ──────────

function TeamAvatar({ name }: { name: string }) {
  return (
    <span
      style={{
        width:          '100%',
        height:         '100%',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:      getGradient(name),
        fontFamily:     'var(--font-title)',
        fontWeight:     500,
        fontSize:       '20px',
        lineHeight:     1,
        color:          'var(--neutral-white)',
        boxShadow:      'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// ── Action flyout panel (the floating side card) ──────────────────────────────

function ActionPanel({
  teamId,
  actions,
  onActionSelect,
}: {
  teamId: string
  actions: ActionItem[]
  onActionSelect?: (teamId: string, action: string) => void
}) {
  const [activeId, setActiveId] = useState<string>('')
  return (
    <Dropdown style={{ width: '160px' }}>
      <Dropdown.Section fluid>
        {actions.map((action) => (
          <Dropdown.Item
            key={action.id}
            fluid
            icon={action.icon}
            label={action.label}
            selected={action.id === activeId}
            onClick={() => { setActiveId(action.id); onActionSelect?.(teamId, action.id) }}
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TeamSwitcherDropdown = React.forwardRef<HTMLDivElement, TeamSwitcherDropdownProps>(
  function TeamSwitcherDropdown(
    {
      teams,
      activeTeamId: _activeTeamId,
      currentUserRole,
      roleMode = 'solar',
      onSelectTeam,
      onSelectPersonal,
      onManageTeams,
      onActionSelect,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    // Which team's action flyout is open (driven by Dropdown.Submenu). Also
    // drives that row's badge-label + chevron transform. The flyout is a
    // floating popover — it never affects the left card's layout.
    const [openTeamId, setOpenTeamId] = useState<string | null>(null)

    const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'
    const teamsLabel     = isOwnerOrAdmin ? 'All Teams' : 'Teams'

    return (
      <Comp ref={ref} className={className} style={style} {...props}>
        <Dropdown style={{ width: '283px' }}>
          {/* Personal projects — fill-only hover, no flyout */}
          <Dropdown.Section fluid>
            <Dropdown.Item
              fluid
              icon={<FolderOneIcon />}
              label="Personal projects"
              subLabel="View all your personal projects"
              onClick={onSelectPersonal}
            />
          </Dropdown.Section>

          {/* Teams list */}
          <Dropdown.Section label={teamsLabel} divider fluid>
            {teams.map((team) => {
              const actions    = getActions(team.userRole)
              const hasActions  = actions.length > 0
              const isOpen      = team.id === openTeamId

              const row = (
                <Dropdown.Item
                  fluid
                  selected={isOpen}
                  avatar={<TeamAvatar name={team.name} />}
                  label={team.name}
                  subLabel={`${team.projectCount} ${team.projectCount === 1 ? 'Project' : 'Projects'}`}
                  // Role badge + chevron grouped with a 4px gap (Figma 6419:83526).
                  badge={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RoleBadge role={team.userRole} showLabel={isOpen} mode={roleMode} />
                      {hasActions && isOpen && (
                        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--neutral-500)' }}>
                          <ArrowDownOneIcon size={16} style={{ transform: 'rotate(-90deg)' }} />
                        </span>
                      )}
                    </div>
                  }
                  onClick={() => onSelectTeam?.(team.id)}
                />
              )

              // Member rows: no action flyout — render the row directly.
              if (!hasActions) return <React.Fragment key={team.id}>{row}</React.Fragment>

              // Owner / admin / editor rows: the row is a Dropdown.Submenu
              // trigger; its actions fly out to the right as a floating popover.
              return (
                <Dropdown.Submenu
                  key={team.id}
                  open={isOpen}
                  onOpenChange={(o) => setOpenTeamId((prev) => (o ? team.id : prev === team.id ? null : prev))}
                  trigger={row}
                >
                  <ActionPanel teamId={team.id} actions={actions} onActionSelect={onActionSelect} />
                </Dropdown.Submenu>
              )
            })}
          </Dropdown.Section>

          {/* Manage Teams — owner/admin only */}
          {isOwnerOrAdmin && (
            <Dropdown.Section divider fluid>
              <Dropdown.Item
                fluid
                label="Manage Teams"
                rightIcon={<DashboardSquareOneIcon />}
                onClick={onManageTeams}
              />
            </Dropdown.Section>
          )}
        </Dropdown>
      </Comp>
    )
  },
)

TeamSwitcherDropdown.displayName = 'TeamSwitcherDropdown'
export default TeamSwitcherDropdown
