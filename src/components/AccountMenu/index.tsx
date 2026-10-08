'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useState } from 'react'
import {
  AnalyticsOneIcon,
  ArrowUpRightOneIcon,
  SettingsOneIcon,
  InformationCircleIcon,
  CourtHouseIcon,
  AlertCircleIcon,
  LoginOneIcon,
} from '@strange-huge/icons'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { Divider } from '@/components/Divider'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { ThemeModeSwitcher } from '@/components/ThemeModeSwitcher'
import { useTheme } from '@/context/theme-context'
import { useModKeyLabel } from '@/lib/platform'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccountMenuProps {
  /** Display name shown in the trigger; the menu header falls back to it when there is no `email`. */
  name: string
  /** Workspace identity line under the name in the trigger — e.g. "Acme Corp". Omit for
   *  an individual account with no workspace context. */
  plan?: string
  /** True when the viewer has no active plan — the plan card shows a "No plan selected"
   *  chip instead of the credits. */
  planWarning?: boolean
  /** Plan name shown as the plan card's chip, e.g. "Free Plan", "Core", "Pro". The chip
   *  colour is derived from it. */
  planType?: string
  /** Credits remaining, shown in the plan card. Ignored when `planWarning` is true. */
  credits?: number
  /** @deprecated Ignored. The plan chip colour now comes from `planType`. */
  planStatusVariant?: 'neutral' | 'blue'
  /** Avatar image URL. Falls back to initials if absent. */
  avatarSrc?: string
  /** Signed-in email, shown at the top of the menu. Falls back to `name`. */
  email?: string
  /** Total credits for the period; with `credits` it draws the remaining-credits bar. */
  creditsTotal?: number
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
  /**
   * Set false to render a static, non-interactive identity display — the
   * trigger's visual only, with no click behavior, no dropdown, and no
   * settings-icon affordance. For a context that already exposes Profile/
   * Usage/Upgrade Plan/Settings/Workspace/Help as its own persistent nav (e.g.
   * the Settings sidebar footer), where this dropdown would just repeat
   * those same destinations, plus offer "Settings" while already there.
   * @default true
   */
  interactive?: boolean
  /** Show the plan item ("Upgrade Plan" / "View plan" / "Choose a plan"). @default true. Hide it for anyone who cannot open the plan page (workspace members). */
  showUpgradePlan?: boolean
  /** The top plan has nothing to upgrade to: the plan item reads "View plan" instead of "Upgrade Plan". @default false */
  viewPlanOnly?: boolean
  /** Force-show the "Organization" item (owner/admin). Otherwise it shows whenever `onOrganization` is provided. @default false */
  showOrganization?: boolean
  /** Opens the personal Usage page. */
  onUsage?:        () => void
  onUpgradePlan?:  () => void
  /** Settings home; it opens on Account, so there is no separate Profile item. */
  onSettings?:     () => void
  /** When provided (or `showOrganization`), a "Workspace settings" item is shown under Settings. Admins only. */
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
      background:     'var(--shortcut-pill-bg)',
      boxShadow:      '0px 1px 1.5px 0px var(--shortcut-pill-shadow), 0px 0px 0px 1px var(--shortcut-pill-ring)',
      flexShrink:     0,
    }}
  >
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-regular)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--shortcut-pill-text)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  </div>
)

// ── Email header ─────────────────────────────────────────────────────────────────
// Who the menu belongs to. The email alone: name and workspace already show on the
// sidebar trigger, so repeating them (and the avatar) here only added noise.

const EmailHeader = ({ email }: { email: string }) => (
  <div style={{ padding: '6px 8px 2px' }}>
    <Tooltip content={email} maxWidth={280}><p
      style={{
        margin:       0,
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
      {email}
    </p></Tooltip>
  </div>
)

// ── Plan card ──────────────────────────────────────────────────────────────────
// Plan + credits in one card. The plan name is a chip coloured by plan, with the plan's
// total credits beneath. The theme slider rides at the top right.

type PlanTone = 'blue' | 'purple' | 'green' | 'brown' | 'yellow' | 'neutral'

const PLAN_TONE_TOKENS: Record<PlanTone, { bg: string; text: string; shadow: string }> = {
  blue:    { bg: 'var(--color-tag-Blue-bg)',    text: 'var(--color-tag-Blue-text)',    shadow: 'var(--color-tag-Blue-shadow), var(--color-tag-Blue-inner-shadow)' },
  purple:  { bg: 'var(--color-tag-Purple-bg)',  text: 'var(--color-tag-Purple-text)',  shadow: 'var(--color-tag-Purple-shadow), var(--color-tag-Purple-inner-shadow)' },
  green:   { bg: 'var(--color-tag-Green-bg)',   text: 'var(--color-tag-Green-text)',   shadow: 'var(--color-tag-Green-shadow), var(--color-tag-Green-inner-shadow)' },
  brown:   { bg: 'var(--color-tag-Brown-bg)',   text: 'var(--color-tag-Brown-text)',   shadow: 'var(--color-tag-Brown-shadow), var(--color-tag-Brown-inner-shadow)' },
  yellow:  { bg: 'var(--color-tag-Yellow-bg)',  text: 'var(--color-tag-Yellow-text)',  shadow: 'var(--color-tag-Yellow-shadow), var(--color-tag-Yellow-inner-shadow)' },
  neutral: { bg: 'var(--color-tag-Neutral-bg)', text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow), var(--color-tag-Neutral-inner-shadow)' },
}

/** One colour per plan so it reads at a glance: Free Plan blue, Free Trial purple, Core green, Pro brown. */
function planTone(label: string, planWarning: boolean): PlanTone {
  if (planWarning) return 'yellow'
  const key = label.toLowerCase()
  if (key.includes('trial')) return 'purple'
  if (key.includes('free')) return 'blue'
  if (key.includes('core')) return 'green'
  if (key.includes('pro')) return 'brown'
  return 'neutral'
}

const PlanChip = ({ label, tone }: { label: string; tone: PlanTone }) => {
  const t = PLAN_TONE_TOKENS[tone]
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             5,
        padding:         '2px 8px',
        borderRadius:    6,
        backgroundColor: t.bg,
        boxShadow:       t.shadow,
        color:           t.text,
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        'var(--font-size-caption)',
        lineHeight:      'var(--line-height-caption)',
        whiteSpace:      'nowrap',
        minWidth:        0,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'currentColor', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </span>
  )
}

/** "Core" → "Core Plan", "Pro" → "Pro Plan"; labels that already say what they are ("Free Plan", "Free Trial") are kept. */
function withPlanSuffix(label: string): string {
  return /(plan|trial)/i.test(label) ? label : `${label} Plan`
}

const formatCredits = (n: number) => Math.max(0, Math.round(n)).toLocaleString()

const PlanCard = ({
  planWarning,
  planType,
  credits,
  creditsTotal,
}: {
  planWarning?: boolean
  planType?: string
  /** Remaining credits. Only used as a fallback when the total is unknown. */
  credits?: number
  creditsTotal?: number
}) => {
  const { enabled: themingEnabled } = useTheme()
  // The plan's total credits; falls back to the balance when no total is known.
  const shownCredits = planWarning ? undefined : (creditsTotal ?? credits)
  if (!planWarning && !planType && shownCredits === undefined && !themingEnabled) return null

  const planLabel = planWarning ? 'No plan selected' : withPlanSuffix(planType ?? 'Plan')

  const creditsBlock = shownCredits !== undefined ? (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
      <span style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 20, lineHeight: '24px', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
        {formatCredits(shownCredits)}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
        total credits
      </span>
    </span>
  ) : null

  return (
    <div style={{ padding: '4px 6px 6px' }}>
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             8,
          padding:         10,
          borderRadius:    10,
          backgroundColor: 'var(--neutral-100)',
          boxShadow:       'inset 0px 0px 0px 1px var(--neutral-200)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <PlanChip label={planLabel} tone={planTone(planLabel, !!planWarning)} />
          <ThemeModeSwitcher />
        </div>
        {creditsBlock && <div style={{ display: 'flex' }}>{creditsBlock}</div>}
      </div>
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
  email,
  creditsTotal,
  open: controlledOpen,
  onOpenChange,
  placement = 'top-start',
  panelWidth = 283,
  collapsed = false,
  roleBadge,
  renderTrigger,
  interactive = true,
  showUpgradePlan = true,
  viewPlanOnly = false,
  showOrganization = false,
  onUsage,
  onUpgradePlan,
  onSettings,
  onOrganization,
  onHelp,
  onReportBug,
  onLogOut,
}: AccountMenuProps & { ref?: React.Ref<HTMLDivElement> }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const modKey = useModKeyLabel()
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
      onSettingsClick={interactive ? onOpenSettingsClick : undefined}
    />
  )

  // Static mode: just the identity visual, no dropdown wrapper, no click
  // behavior at all.
  if (!interactive) {
    return (
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {trigger}
      </div>
    )
  }

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
            <EmailHeader email={email ?? name} />

            <PlanCard
              planWarning={planWarning}
              planType={planType}
              credits={credits}
              creditsTotal={creditsTotal}
            />

            <Dropdown.Item
              icon={<AnalyticsOneIcon />}
              label="Usage"
              fluid
              onClick={() => { onUsage?.(); close() }}
            />
            {showUpgradePlan && (
              <Dropdown.Item
                icon={<ArrowUpRightOneIcon />}
                label={planWarning ? 'Choose a plan' : viewPlanOnly ? 'View plan' : 'Upgrade Plan'}
                fluid
                onClick={() => { onUpgradePlan?.(); close() }}
              />
            )}

            <Divider decorative />

            <Dropdown.Item
              icon={<SettingsOneIcon />}
              label="Settings"
              badge={<ShortcutPill label={`${modKey} ,`} />}
              fluid
              onClick={() => { onSettings?.(); close() }}
            />
            {(showOrganization || onOrganization) && (
              <Dropdown.Item
                icon={<CourtHouseIcon />}
                label="Workspace settings"
                fluid
                onClick={() => { onOrganization?.(); close() }}
              />
            )}

            <Divider decorative />

            <Dropdown.Item
              icon={<InformationCircleIcon />}
              label="Help & Legal"
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
              variant="danger"
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
