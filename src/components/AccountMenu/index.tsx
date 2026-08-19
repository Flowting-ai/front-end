'use client'

import React, { useState } from 'react'
import {
  UserIcon,
  ArrowUpRightOneIcon,
  SettingsOneIcon,
  LogoIcon,
  InformationCircleIcon,
  ArrowRightOneIcon,
  CourtHouseIcon,
  AlertCircleIcon,
  FolderAddIcon,
  LoginOneIcon,
  LinkSixIcon,
} from '@strange-huge/icons'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { Badge } from '@/components/Badge'
import { TeamSwitcherRow } from '@/components/TeamSwitcherRow'
import { getGradient } from '@/lib/team-gradients'
import { Tooltip } from '@/components/Tooltip'
import type { WorkspaceRole } from '@/components/RoleBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Optional team-switcher block rendered near the top of the panel — the same
 * TeamSwitcherRow trigger the Sidebar's WorkspaceSwitcher uses, nested here as
 * a `Dropdown.Submenu` so it opens as a side flyout instead of a page-level
 * float. The flyout itself lists every team as a flat row (avatar + name),
 * with "Create new team" above and per-row manage/open actions surfaced on
 * hover — a simpler variant than the Sidebar's own TeamSwitcherDropdown (no
 * role badges, no "Teams you're part of" header). Omit entirely for viewers
 * with no org (individuals).
 */
export interface AccountMenuTeamSwitcher {
  /** Every non-archived team the viewer belongs to. */
  teams: { id: string; name: string }[]
  /** Currently selected team id — undefined falls back to the first team. */
  activeTeamId?: string
  /** The team shown on the trigger row itself (active team, or the first team as fallback). */
  triggerTeam: { id: string; name: string; role: WorkspaceRole; projectCount: number }
  onSelectTeam: (teamId: string) => void
  /** Fires when the row's settings/gear action is clicked — e.g. navigate to that team's management page. */
  onManageTeam?: (teamId: string) => void
  /** Fires when "Create new team" is clicked. */
  onCreateTeam?: () => void
}

export interface AccountMenuProps {
  /** Display name shown in both trigger and identity header. */
  name: string
  /** Plan label — "Pro", "Free Trial", "Teams", etc. */
  plan?: string
  /** When true the plan label renders in amber warning colour (e.g. "No Plan Selected"). */
  planWarning?: boolean
  /** Credit count shown in the identity header badge. */
  credits?: number
  /** Avatar image URL. Falls back to initials if absent. */
  avatarSrc?: string
  /** Controlled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Popup placement relative to the trigger. Defaults to top-start. */
  placement?: DropdownPlacement
  /** Width of the dropdown panel. Defaults to 283px (standalone spec). Pass 274 when inside the Sidebar. */
  panelWidth?: number | string
  /** Renders the trigger in icon-only collapsed mode. Pass through when used inside a collapsible Sidebar. */
  collapsed?: boolean
  /** Element rendered in the trigger row before the settings icon — pass the
   *  viewer's `<RoleBadge />` so the footer trigger matches the Sidebar. */
  roleBadge?: React.ReactNode
  /**
   * Override the trigger row's visual entirely while keeping this component's
   * dropdown panel/behavior unchanged — e.g. the flat sidebar's "Profile Row"
   * look instead of the default `account-item` SidebarMenuItem. Receives a
   * click handler that opens/closes the same dropdown the default trigger uses.
   */
  renderTrigger?: (props: { onOpenSettingsClick: () => void }) => React.ReactElement
  /** Team switcher block — TeamSwitcherRow trigger + TeamSwitcherDropdown flyout. Omit to hide (individuals). */
  teamSwitcher?: AccountMenuTeamSwitcher
  /** Show the "Upgrade Plan" item. @default true (gate to individuals in the Sidebar). */
  showUpgradePlan?: boolean
  /** Force-show the "Organization" item (owner/admin). Otherwise it shows whenever `onOrganization` is provided. @default false */
  showOrganization?: boolean
  onProfile?:      () => void
  onUpgradePlan?:  () => void
  onSettings?:     () => void
  /** When provided (or `showOrganization`), an "Organization" item is shown between Settings and What's new. */
  onOrganization?:     () => void
  onWhatsNew?:         () => void
  onHelp?:             () => void
  onManageConnectors?: () => void
  onReportBug?:        () => void
  onLogOut?:           () => void
}

// ── Shortcut pill (⌘ ,) ────────────────────────────────────────────────────────

const ShortcutPill = ({ label }: { label: string }) => (
  <div
    style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '20px',
      padding:        '2px 4px',
      borderRadius:   '4px',
      background:     'linear-gradient(to bottom, #ffffff, #f7f2ed)',
      boxShadow:      '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(182,172,164,0.4)',
      flexShrink:     0,
    }}
  >
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-regular)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-500)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  </div>
)

// ── Credits badge ──────────────────────────────────────────────────────────────

const CreditsBadge = ({ credits }: { credits: number }) => (
  <div
    style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '2px 4px',
      borderRadius:   '6px',
      background:     'var(--neutral-100)',
      boxShadow:      '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5), inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)',
      flexShrink:     0,
    }}
  >
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-700)',
        whiteSpace: 'nowrap',
      }}
    >
      {Math.round(credits).toLocaleString()} credits left
    </span>
  </div>
)

// ── Avatar content ─────────────────────────────────────────────────────────────

const AvatarContent = ({ name, avatarSrc }: { name: string; avatarSrc?: string }) => {
  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt={name}
        style={{
          position:      'absolute',
          inset:         0,
          width:         '100%',
          height:        '100%',
          objectFit:     'cover',
          display:       'block',
          pointerEvents: 'none',
        }}
      />
    )
  }
  return (
    <div
      style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'var(--neutral-100)',
        fontFamily:     'var(--font-body)',
        fontWeight:     'var(--font-weight-medium)',
        fontSize:       'var(--font-size-caption)',
        color:          'var(--neutral-600)',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Identity row ──────────────────────────────────────────────────────────────

const BODY_LH    = 22  // var(--line-height-body)    = 22px
const CAPTION_LH = 16  // var(--line-height-caption) = 16px

const IdentityRow = ({ name, plan, planWarning, avatarSrc }: {
  name: string; plan?: string; planWarning?: boolean; avatarSrc?: string
}) => {
  const avatarSize = plan ? BODY_LH + CAPTION_LH : BODY_LH

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        padding:      '5px 6px',
        borderRadius: '6px',
        overflow:     'hidden',
        gap:          '8px',
      }}
    >
      <div
        style={{
          width:        avatarSize,
          height:       avatarSize,
          overflow:     'hidden',
          borderRadius: '6px',
          flexShrink:   0,
          position:     'relative',
        }}
      >
        <AvatarContent name={name} avatarSrc={avatarSrc} />
      </div>

      <div
        style={{
          display:       'flex',
          flexDirection: 'column',
          flex:          '1 0 0',
          minWidth:      1,
        }}
      >
        <p
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     'var(--font-size-body)',
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-700)',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            margin:       0,
          }}
        >
          {name}
        </p>
        {plan && (
          planWarning ? (
            <Badge color="Yellow" label={plan} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <p
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     'var(--font-size-caption)',
                lineHeight:   'var(--line-height-caption)',
                color:        'var(--neutral-500)',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                margin:       0,
              }}
            >
              {plan}
            </p>
          )
        )}
      </div>

    </div>
  )
}

// ── Credits row — centered standalone row beneath the identity row ────────────

const CreditsRow = ({ credits }: { credits: number }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 6px' }}>
    <CreditsBadge credits={credits} />
  </div>
)

// ── Team switcher flyout row — flat circle avatar + name, gear/open actions on
// hover or when active. Distinct from the Sidebar's TeamRow: no role badge, no
// gradient avatar, solid `--neutral-100` highlight instead of the translucent
// dropdown hover tint. ────────────────────────────────────────────────────────

function TeamFlyoutRow({
  name,
  isActive,
  onSelect,
  onManage,
}: {
  name: string
  isActive: boolean
  onSelect: () => void
  onManage?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [manageIconHovered, setManageIconHovered] = useState(false)
  const showActions = hovered || isActive

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        width:           '100%',
        boxSizing:       'border-box',
        gap:             '8px',
        padding:         '6px',
        borderRadius:    '10px',
        cursor:          'pointer',
        backgroundColor: isActive ? 'var(--neutral-100)' : 'transparent',
        transition:      'background-color 150ms',
        userSelect:      'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 0 0' }}>
        {/* Square gradient avatar with the team's initial — same treatment as
            the Sidebar's TeamRow tile, so a given team's tile color matches
            across both switchers (see getGradient in TeamSwitcherDropdown). */}
        <span
          aria-hidden
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          20,
            height:         20,
            flexShrink:     0,
            borderRadius:   '4px',
            background:     getGradient(name),
            fontFamily:     'var(--font-title)',
            fontWeight:     500,
            fontSize:       '11px',
            lineHeight:     1,
            color:          'var(--neutral-white)',
            boxShadow:      'inset 0px 4px 4px rgba(0,0,0,0.25), inset 0px -1px 0.4px rgba(18,60,95,0.65)',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span
          style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   'var(--font-weight-medium)',
            fontSize:     'var(--font-size-body)',
            lineHeight:   'var(--line-height-body)',
            color:        'var(--neutral-700)',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </span>
      </div>

      {showActions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Tooltip content="Manage team" side="top" delayDuration={300}>
            <span
              role="button"
              tabIndex={0}
              aria-label="Manage team"
              onClick={(e) => { e.stopPropagation(); onManage?.() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onManage?.() } }}
              onMouseEnter={() => setManageIconHovered(true)}
              onMouseLeave={() => setManageIconHovered(false)}
              style={{
                display: 'inline-flex', cursor: 'pointer', transition: 'color 150ms',
                color: manageIconHovered ? 'var(--neutral-black)' : 'var(--neutral-500)',
              }}
            >
              <SettingsOneIcon size={16} />
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

// ── Team switcher flyout panel — "Create new team" + flat team list ───────────

function TeamSwitcherFlyout({ teamSwitcher }: { teamSwitcher: AccountMenuTeamSwitcher }) {
  return (
    <Dropdown maxHeight={false} style={{ width: '300px' }}>
      <Dropdown.Section fluid>
        <Dropdown.Item
          icon={<FolderAddIcon />}
          label="Create new team"
          fluid
          onClick={() => teamSwitcher.onCreateTeam?.()}
        />
      </Dropdown.Section>

      <Divider decorative />

      <Dropdown.Section fluid>
        {teamSwitcher.teams.map((team) => (
          <TeamFlyoutRow
            key={team.id}
            name={team.name}
            isActive={team.id === (teamSwitcher.activeTeamId ?? teamSwitcher.triggerTeam.id)}
            onSelect={() => teamSwitcher.onSelectTeam(team.id)}
            onManage={() => teamSwitcher.onManageTeam?.(team.id)}
          />
        ))}
      </Dropdown.Section>
    </Dropdown>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountMenu({
  ref,
  name,
  plan,
  planWarning = false,
  credits,
  avatarSrc,
  open: controlledOpen,
  onOpenChange,
  placement = 'top-start',
  panelWidth = 283,
  collapsed = false,
  roleBadge,
  renderTrigger,
  teamSwitcher,
  showUpgradePlan = true,
  showOrganization = false,
  onProfile,
  onUpgradePlan,
  onSettings,
  onOrganization,
  onWhatsNew,
  onHelp,
  onManageConnectors,
  onReportBug,
  onLogOut,
}: AccountMenuProps & { ref?: React.Ref<HTMLDivElement> }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open         = isControlled ? controlledOpen : internalOpen
  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false)

  const handleOpenChange = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }

  const close = () => handleOpenChange(false)

  // Dropdown.Float wraps the trigger in <span style="display:inline-flex">.
  // Wrapping the whole component in a flex-column div makes that span a flex
  // item, which then stretches (align-self:stretch default) to fill the full
  // container width. Without this, fluid SidebarMenuItem's width:100% can't
  // resolve against an indefinite inline-flex containing block.
  const onOpenSettingsClick = () => handleOpenChange(!open)

  const trigger: React.ReactElement = renderTrigger ? renderTrigger({ onOpenSettingsClick }) : (
    <SidebarMenuItem
      variant="account-item"
      label={name}
      sublabel={plan ?? ''}
      sublabelWarning={planWarning}
      avatarSrc={avatarSrc}
      roleBadge={roleBadge}
      {...(collapsed ? { collapsed: true } : { fluid: true })}
      onSettingsClick={onOpenSettingsClick}
    />
  )

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Dropdown.Float
        trigger={trigger}
        open={open}
        onOpenChange={handleOpenChange}
        placement={placement}
      >
        <Dropdown maxHeight={false} style={{ width: typeof panelWidth === 'number' ? `${panelWidth}px` : panelWidth }}>
          <Dropdown.Section fluid>
            <IdentityRow name={name} plan={plan} planWarning={planWarning} avatarSrc={avatarSrc} />

            {credits !== undefined && <CreditsRow credits={credits} />}

            <Dropdown.Item
              icon={<UserIcon />}
              label="Profile"
              fluid
              onClick={() => { onProfile?.(); close() }}
            />
            {showUpgradePlan && (
              <Dropdown.Item
                icon={<ArrowUpRightOneIcon />}
                label="Upgrade Plan"
                fluid
                onClick={() => { onUpgradePlan?.(); close() }}
              />
            )}

            <Divider decorative />

            <Dropdown.Item
              icon={<SettingsOneIcon />}
              label="Settings"
              badge={<ShortcutPill label="⌘ ," />}
              fluid
              onClick={() => { onSettings?.(); close() }}
            />
            {(showOrganization || onOrganization) && (
              <Dropdown.Item
                icon={<CourtHouseIcon />}
                label="Organization"
                fluid
                onClick={() => { onOrganization?.(); close() }}
              />
            )}
            <Dropdown.Item
              icon={<LinkSixIcon animated />}
              label="Manage connectors"
              fluid
              onClick={() => { onManageConnectors?.(); close() }}
            />
            <Dropdown.Item
              icon={<LogoIcon />}
              label="What's new"
              fluid
              onClick={() => { onWhatsNew?.(); close() }}
            />
            <Dropdown.Item
              icon={<InformationCircleIcon />}
              label="Help"
              rightIcon={<ArrowRightOneIcon />}
              fluid
              onClick={() => { onHelp?.(); close() }}
            />
            <Dropdown.Item
              icon={<AlertCircleIcon />}
              label="Report a bug"
              fluid
              onClick={() => { onReportBug?.(); close() }}
            />

            <Divider decorative />

            <Dropdown.Item
              icon={<LoginOneIcon animated />}
              label="Log out"
              fluid
              onClick={() => { onLogOut?.(); close() }}
            />

            {teamSwitcher && (
              <Dropdown.Submenu
                open={teamSwitcherOpen}
                onOpenChange={setTeamSwitcherOpen}
                trigger={
                  <TeamSwitcherRow
                    teamName={teamSwitcher.triggerTeam.name}
                    teamId={teamSwitcher.triggerTeam.id}
                    projectCount={teamSwitcher.triggerTeam.projectCount}
                    currentUserRole={teamSwitcher.triggerTeam.role}
                    isOpen={teamSwitcherOpen}
                  />
                }
              >
                <TeamSwitcherFlyout
                  teamSwitcher={{
                    ...teamSwitcher,
                    onSelectTeam: (teamId) => { teamSwitcher.onSelectTeam(teamId); setTeamSwitcherOpen(false); close() },
                    onManageTeam: (teamId) => { teamSwitcher.onManageTeam?.(teamId); setTeamSwitcherOpen(false); close() },
                    onCreateTeam: () => { teamSwitcher.onCreateTeam?.(); setTeamSwitcherOpen(false); close() },
                  }}
                />
              </Dropdown.Submenu>
            )}
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
    </div>
  )
}

AccountMenu.displayName = 'AccountMenu'
export default AccountMenu
