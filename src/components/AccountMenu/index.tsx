'use client'

import React, { useState } from 'react'
import {
  UserIcon,
  ArrowUpRightOneIcon,
  SettingsOneIcon,
  LogoIcon,
  InformationCircleIcon,
  ArrowRightOneIcon,
  ArrowRightTwoIcon,
} from '@strange-huge/icons'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccountMenuProps {
  /** Display name shown in both trigger and identity header. */
  name: string
  /** Plan label — "Pro", "Free", "Team", etc. */
  plan?: string
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
  onProfile?:     () => void
  onUpgradePlan?: () => void
  onSettings?:    () => void
  onWhatsNew?:    () => void
  onHelp?:        () => void
  onLogOut?:      () => void
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
      {credits} credits left
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

const IdentityRow = ({ name, plan, credits, avatarSrc }: {
  name: string; plan?: string; credits?: number; avatarSrc?: string
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

      {credits !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <CreditsBadge credits={credits} />
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountMenu({
  ref,
  name,
  plan,
  credits,
  avatarSrc,
  open: controlledOpen,
  onOpenChange,
  placement = 'top-start',
  panelWidth = 283,
  collapsed = false,
  onProfile,
  onUpgradePlan,
  onSettings,
  onWhatsNew,
  onHelp,
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
  const trigger = (
    <SidebarMenuItem
      variant="account-item"
      label={name}
      sublabel={plan ?? ''}
      avatarSrc={avatarSrc}
      {...(collapsed ? { collapsed: true } : { fluid: true })}
      onSettingsClick={() => { onSettings?.(); handleOpenChange(true) }}
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
            <IdentityRow name={name} plan={plan} credits={credits} avatarSrc={avatarSrc} />

            <Dropdown.Item
              icon={<UserIcon />}
              label="Profile"
              fluid
              onClick={() => { onProfile?.(); close() }}
            />
            <Dropdown.Item
              icon={<ArrowUpRightOneIcon />}
              label="Upgrade Plan"
              fluid
              onClick={() => { onUpgradePlan?.(); close() }}
            />

            <Divider decorative />

            <Dropdown.Item
              icon={<SettingsOneIcon />}
              label="Settings"
              badge={<ShortcutPill label="⌘ ," />}
              fluid
              onClick={() => { onSettings?.(); close() }}
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

            <Divider decorative />

            <Dropdown.Item
              icon={<ArrowRightTwoIcon />}
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
