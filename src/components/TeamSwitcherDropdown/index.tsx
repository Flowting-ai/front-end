'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import {
  ArrowDownOneIcon,
  SettingsOneIcon,
  PlusSignIcon,
  AuditTwoIcon,
  DashboardSquareOneIcon,
  LinkSixIcon,
  FolderOneIcon,
  WorkflowSquareTenIcon,
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
  teams:             Team[]
  activeTeamId?:     string
  /** Org-level role. Gates the "All Teams" / "Teams" section label. Each
   *  team's own `userRole` drives its badge + action flyout. */
  currentUserRole:   WorkspaceRole
  roleMode?:         RoleBadgeMode
  onSelectTeam?:     (teamId: string) => void
  onSelectPersonal?: () => void
  onActionSelect?:   (teamId: string, action: string) => void
  onManageTeams?:    () => void
  asChild?:          boolean
}

// ── Per-team action sets (flyout contents, keyed on the team's role) ──────────
// Icons passed bare — DropdownMenuItem injects the canonical slot size.

type ActionItem = { id: string; label: string; icon: React.ReactElement }

const OWNER_ADMIN_ACTIONS: ActionItem[] = [
  { id: 'manage', label: 'Team Settings', icon: <SettingsOneIcon /> },
]

const EDITOR_ACTIONS: ActionItem[] = [
  { id: 'projects',   label: 'Projects',   icon: <DashboardSquareOneIcon /> },
  { id: 'connectors', label: 'Connectors', icon: <LinkSixIcon /> },
  { id: 'request',    label: 'Request',    icon: <PlusSignIcon /> },
  { id: 'activity',   label: 'Activity',   icon: <AuditTwoIcon /> },
]

// A **member** team has no action flyout — "just a member" of that team.
function getActions(role: WorkspaceRole): ActionItem[] {
  if (role === 'owner' || role === 'admin') return OWNER_ADMIN_ACTIONS
  if (role === 'editor') return EDITOR_ACTIONS
  return [] // member → no flyout
}

// ── TeamRow — custom row with full-height gradient avatar ─────────────────────
// Dropdown.Item's avatar slot is clamped to 24×24. To get a gradient tile that
// spans the full item height we render a plain flex row with alignItems:stretch
// so the avatar div naturally grows to match the content column.

function TeamRow({
  team,
  isOpen,
  roleMode,
  hasActions,
  onSelect,
  ...props
}: {
  team:       Team
  isOpen:     boolean
  roleMode:   RoleBadgeMode
  hasActions: boolean
  onSelect?:  () => void
} & React.HTMLAttributes<HTMLDivElement>) {
  const [hovered, setHovered] = useState(false)
  const isActive = hovered || isOpen

  return (
    <div
      {...props}
      role="menuitem"
      tabIndex={0}
      style={{
        position:        'relative',
        display:         'flex',
        alignItems:      'stretch',
        overflow:        'hidden',
        borderRadius:    '6px',
        width:           '100%',
        paddingLeft:     '6px',
        paddingRight:    '6px',
        paddingTop:      '5px',
        paddingBottom:   '5px',
        gap:             '8px',
        backgroundColor: isActive ? 'var(--dropdown-menu-item-hover-bg)' : 'transparent',
        boxShadow:       isActive ? 'var(--shadow-dropdown-item-hover)' : undefined,
        cursor:          'pointer',
        userSelect:      'none',
        transition:      'background-color 150ms, box-shadow 150ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.() } }}
    >
      {/* Gradient avatar — 38×38 square (body + caption line-heights), 3px radius */}
      <div
        aria-hidden
        style={{
          width:          'calc(var(--line-height-body) + var(--line-height-caption))',
          height:         'calc(var(--line-height-body) + var(--line-height-caption))',
          flexShrink:     0,
          borderRadius:   '3px',
          background:     getGradient(team.name),
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontFamily:     'var(--font-title)',
          fontWeight:     500,
          fontSize:       '16px',
          lineHeight:     1,
          color:          'var(--neutral-white)',
          boxShadow:      'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)',
        }}
      >
        {team.name.charAt(0).toUpperCase()}
      </div>

      {/* Label + subLabel */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 0 0', minWidth: 1 }}>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-medium)',
          fontSize:     'var(--font-size-body)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--neutral-900)',
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          margin:       0,
        }}>
          {team.name}
        </p>
        <p style={{
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-regular)',
          fontSize:     'var(--font-size-caption)',
          lineHeight:   'var(--line-height-caption)',
          color:        'var(--dropdown-menu-item-sublabel)',
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          margin:       0,
        }}>
          {team.projectCount} {team.projectCount === 1 ? 'Project' : 'Projects'}
        </p>
      </div>

      {/* Role badge + submenu chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <RoleBadge role={team.userRole} showLabel={isOpen} mode={roleMode} />
        {hasActions && isOpen && (
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--neutral-500)' }}>
            <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}>
              <ArrowDownOneIcon size={16} />
            </span>
          </span>
        )}
      </div>
    </div>
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
      onActionSelect,
      onManageTeams,
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

    // Scroll-edge state for the progressive blur overlays.
    const [atTop,    setAtTop]    = useState(true)
    const [atBottom, setAtBottom] = useState(false)

    const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'
    const teamsLabel     = isOwnerOrAdmin ? 'All Teams' : 'Teams'

    // Max 4 rows visible (48px/row + 4px gap + 6px padding = 210px)
    const needsOverflow = teams.length > 4

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
            {(() => {
              const teamRows = teams.map((team) => {
                const actions    = getActions(team.userRole)
                const hasActions = actions.length > 0
                const isOpen     = team.id === openTeamId

                const row = (
                  <TeamRow
                    team={team}
                    isOpen={isOpen}
                    roleMode={roleMode}
                    hasActions={hasActions}
                    onSelect={() => onSelectTeam?.(team.id)}
                  />
                )

                if (!hasActions) return <React.Fragment key={team.id}>{row}</React.Fragment>

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
              })

              if (!needsOverflow) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {teamRows}
                  </div>
                )
              }

              return (
                <div style={{ position: 'relative' }}>
                  <div
                    className="kaya-scrollbar"
                    onScroll={(e) => {
                      const el = e.currentTarget
                      setAtTop(el.scrollTop < 8)
                      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
                    }}
                    style={{
                      overflowY:           'auto',
                      maxHeight:           '210px',
                      padding:             '3px',
                      display:             'flex',
                      flexDirection:       'column',
                      gap:                 '4px',
                      overscrollBehaviorY: 'contain',
                    }}
                  >
                    {teamRows}
                  </div>

                  {/* Top progressive blur */}
                  {([
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ] as const).map(({ height, blur }) => (
                    <div key={blur} aria-hidden style={{
                      position:             'absolute',
                      top: 0, left: 0, right: 0,
                      height:               `${height}px`,
                      backdropFilter:       `blur(${blur}px)`,
                      WebkitBackdropFilter: `blur(${blur}px)`,
                      maskImage:            'linear-gradient(to bottom, black 0%, transparent 100%)',
                      WebkitMaskImage:      'linear-gradient(to bottom, black 0%, transparent 100%)',
                      pointerEvents:        'none',
                      zIndex:               10,
                      opacity:              atTop ? 0 : 1,
                      transition:           'opacity 150ms ease',
                    }} />
                  ))}
                  <div aria-hidden style={{
                    position:      'absolute',
                    top: 0, left: 0, right: 0,
                    height:        '40px',
                    background:    'linear-gradient(to bottom, var(--popover-bg, #fff) 0%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex:        11,
                    opacity:       atTop ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }} />

                  {/* Bottom progressive blur */}
                  {([
                    { height: 40, blur: 2 },
                    { height: 28, blur: 3 },
                    { height: 18, blur: 5 },
                    { height: 10, blur: 6 },
                  ] as const).map(({ height, blur }) => (
                    <div key={blur} aria-hidden style={{
                      position:             'absolute',
                      bottom: 0, left: 0, right: 0,
                      height:               `${height}px`,
                      backdropFilter:       `blur(${blur}px)`,
                      WebkitBackdropFilter: `blur(${blur}px)`,
                      maskImage:            'linear-gradient(to top, black 0%, transparent 100%)',
                      WebkitMaskImage:      'linear-gradient(to top, black 0%, transparent 100%)',
                      pointerEvents:        'none',
                      zIndex:               10,
                      opacity:              atBottom ? 0 : 1,
                      transition:           'opacity 150ms ease',
                    }} />
                  ))}
                  <div aria-hidden style={{
                    position:      'absolute',
                    bottom: 0, left: 0, right: 0,
                    height:        '40px',
                    background:    'linear-gradient(to top, var(--popover-bg, #fff) 0%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex:        11,
                    opacity:       atBottom ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }} />
                </div>
              )
            })()}
          </Dropdown.Section>

          {/* Manage teams — shown to owners/admins */}
          {isOwnerOrAdmin && onManageTeams && (
            <Dropdown.Section divider fluid>
              <Dropdown.Item
                fluid
                label="Manage teams"
                rightIcon={<WorkflowSquareTenIcon animated />}
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
