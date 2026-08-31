'use client'

import React, { useState } from 'react'
import {
  UserIcon,
  ArrowUpRightOneIcon,
  SettingsOneIcon,
  InformationCircleIcon,
  ArrowRightOneIcon,
  CourtHouseIcon,
  AlertCircleIcon,
  LoginOneIcon,
} from '@strange-huge/icons'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccountMenuProps {
  /** Display name shown in both trigger and identity header. */
  name: string
  /** Workspace identity line under the name — e.g. "Acme Corp". Omit for
   *  an individual account with no workspace context. */
  plan?: string
  /** True when the viewer has no active plan — renders a "No Plan Selected"
   *  status tag instead of the credit count. */
  planWarning?: boolean
  /** Plan-type label prefixed onto the credit count in the status tag — e.g.
   *  "Workspace" or "Pro", giving "Workspace | 250 credits left". Omit to
   *  show just the credit count with no prefix. Ignored when `planWarning`. */
  planType?: string
  /** Credit count shown in the status tag beneath the identity row. Ignored
   *  when `planWarning` is true. */
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
  /** Show the "Upgrade Plan" item. @default true (gate to individuals in the Sidebar). */
  showUpgradePlan?: boolean
  /** Force-show the "Organization" item (owner/admin). Otherwise it shows whenever `onOrganization` is provided. @default false */
  showOrganization?: boolean
  onProfile?:      () => void
  onUpgradePlan?:  () => void
  onSettings?:     () => void
  /** When provided (or `showOrganization`), an "Organization" item is shown between Settings and Help. */
  onOrganization?:     () => void
  onHelp?:             () => void
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

// ── Status badge — "No Plan Selected" / "{x} credits left" pill ──────────────────

const StatusBadge = ({ label }: { label: string }) => (
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
      {label}
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

const IdentityRow = ({ name, plan, avatarSrc }: {
  name: string; plan?: string; avatarSrc?: string
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
        )}
      </div>

    </div>
  )
}

// ── Plan status row — centered standalone row beneath the identity row.
// "No Plan Selected" when there's no active plan, otherwise "{planType} |
// {x} credits left" (e.g. "Workspace | 250 credits left") — the two are
// mutually exclusive so this always renders exactly one. ──

const PlanStatusRow = ({ planWarning, planType, credits }: { planWarning?: boolean; planType?: string; credits?: number }) => {
  if (!planWarning && credits === undefined) return null
  const creditsLabel = `${Math.round(credits ?? 0).toLocaleString()} credits left`
  const label = planWarning ? 'No Plan Selected' : (planType ? `${planType} | ${creditsLabel}` : creditsLabel)
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 6px' }}>
      <StatusBadge label={label} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountMenu({
  ref,
  name,
  plan,
  planWarning = false,
  planType,
  credits,
  avatarSrc,
  open: controlledOpen,
  onOpenChange,
  placement = 'top-start',
  panelWidth = 283,
  collapsed = false,
  roleBadge,
  renderTrigger,
  showUpgradePlan = true,
  showOrganization = false,
  onProfile,
  onUpgradePlan,
  onSettings,
  onOrganization,
  onHelp,
  onReportBug,
  onLogOut,
}: AccountMenuProps & { ref?: React.Ref<HTMLDivElement> }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open         = isControlled ? controlledOpen : internalOpen

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
            <IdentityRow name={name} plan={plan} avatarSrc={avatarSrc} />

            <PlanStatusRow planWarning={planWarning} planType={planType} credits={credits} />

            <Dropdown.Item
              icon={<UserIcon />}
              label="Profile"
              fluid
              onClick={() => { onProfile?.(); close() }}
            />
            {showUpgradePlan && (
              <Dropdown.Item
                icon={<ArrowUpRightOneIcon />}
                label={planWarning ? 'Choose a plan' : 'Upgrade Plan'}
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
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
    </div>
  )
}

AccountMenu.displayName = 'AccountMenu'
export default AccountMenu
