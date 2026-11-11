'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useState } from 'react'
import {
  AnalyticsOneIcon,
  SettingsOneIcon,
  InformationCircleIcon,
  CourtHouseIcon,
  ArrowUpRightOneIcon,
  AlertCircleIcon,
  LoginOneIcon,
} from '@strange-huge/icons'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/Avatar'
import { Divider } from '@/components/Divider'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { ThemeModeSwitcher } from '@/components/ThemeModeSwitcher'
import { useTheme } from '@/context/theme-context'
import type { CreditsDisplay } from '@/lib/api/plan'
import { useModKeyLabel } from '@/lib/platform'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccountMenuProps {
  /** Display name shown in the trigger; the menu header falls back to it when there is no `email`. */
  name: string
  /** Workspace identity line under the name in the trigger — e.g. "Acme Corp". Omit for
   *  an individual account with no workspace context. */
  plan?: string
  /** True when the viewer has no active plan — the plan card shows a "Free Plan"
   *  chip instead of the credits. */
  planWarning?: boolean
  /** Plan name shown as the plan card's chip, e.g. "Free Plan", "Core", "Enterprise". The
   *  chip colour is derived from it. */
  planType?: string
  /** The credits line under the chip, e.g. "43,478 total credits" or "Unlimited". Ignored
   *  when `planWarning` is true. */
  credits?: CreditsDisplay
  /** @deprecated Ignored. The plan chip colour now comes from `planType`. */
  planStatusVariant?: 'neutral' | 'blue'
  /** Avatar image URL. Falls back to initials if absent. */
  avatarSrc?: string
  /** Signed-in email, shown under the name at the top of the menu. */
  email?: string
  /** The viewer's workspace role ("Admin", "Member"…), shown as a chip in the menu header. */
  roleLabel?: string
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

// ── Header ──────────────────────────────────────────────────────────────────────
// Who the menu belongs to: avatar, name, email and workspace role — the same for every role.

const AccountHeader = ({ name, email, avatarSrc, roleLabel }: { name: string; email?: string; avatarSrc?: string; roleLabel?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 10px' }}>
    <UserAvatar name={name} src={avatarSrc} size={36} />
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <p style={{ margin: 0, minWidth: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </p>
        {roleLabel && (
          <span style={{ flexShrink: 0, padding: '0 6px', borderRadius: 999, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)', fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 11, lineHeight: '18px', color: 'var(--neutral-600)' }}>
            {roleLabel}
          </span>
        )}
      </div>
      {email && (
        <Tooltip content={email} maxWidth={280}>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email}
          </p>
        </Tooltip>
      )}
    </div>
  </div>
)

// ── Plan row ───────────────────────────────────────────────────────────────────
// The plan chip, and on the right what this viewer can act on: an upgrade link for whoever manages
// the plan, or "Managed by your admin" for members — so the row is never half empty. Credits below.

type PlanTone = 'blue' | 'purple' | 'green' | 'brown' | 'yellow' | 'neutral'

const PLAN_TONE_TOKENS: Record<PlanTone, { bg: string; text: string; shadow: string }> = {
  blue:    { bg: 'var(--color-tag-Blue-bg)',    text: 'var(--color-tag-Blue-text)',    shadow: 'var(--color-tag-Blue-shadow), var(--color-tag-Blue-inner-shadow)' },
  purple:  { bg: 'var(--color-tag-Purple-bg)',  text: 'var(--color-tag-Purple-text)',  shadow: 'var(--color-tag-Purple-shadow), var(--color-tag-Purple-inner-shadow)' },
  green:   { bg: 'var(--color-tag-Green-bg)',   text: 'var(--color-tag-Green-text)',   shadow: 'var(--color-tag-Green-shadow), var(--color-tag-Green-inner-shadow)' },
  brown:   { bg: 'var(--color-tag-Brown-bg)',   text: 'var(--color-tag-Brown-text)',   shadow: 'var(--color-tag-Brown-shadow), var(--color-tag-Brown-inner-shadow)' },
  yellow:  { bg: 'var(--color-tag-Yellow-bg)',  text: 'var(--color-tag-Yellow-text)',  shadow: 'var(--color-tag-Yellow-shadow), var(--color-tag-Yellow-inner-shadow)' },
  neutral: { bg: 'var(--color-tag-Neutral-bg)', text: 'var(--color-tag-Neutral-text)', shadow: 'var(--color-tag-Neutral-shadow), var(--color-tag-Neutral-inner-shadow)' },
}

/** One colour per plan so it reads at a glance: Free Plan blue, Free Trial purple, Core green, Enterprise brown. */
function planTone(label: string, planWarning: boolean): PlanTone {
  if (planWarning) return 'yellow'
  const key = label.toLowerCase()
  if (key.includes('trial')) return 'purple'
  if (key.includes('free')) return 'blue'
  if (key.includes('core')) return 'green'
  if (key.includes('enterprise') || key.includes('pro')) return 'brown'
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
        // The chip names the plan, so it is never the thing that gives: a longer
        // label ("Enterprise Plan") used to be squeezed to "Enterprise P…" by the
        // caption beside it. The row wraps instead — see PlanRow.
        flexShrink:      0,
        maxWidth:        '100%',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'currentColor', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </span>
  )
}

/** "Core" → "Core Plan", "Pro" → "Pro Plan"; labels that already say what they are ("Free Plan", "Free Trial") are kept. */
function withPlanSuffix(label: string): string {
  return /\b(plan|trial)\b/i.test(label) ? label : `${label} Plan`
}

const CAPTION: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }

const PlanRow = ({
  planWarning,
  planType,
  credits,
  planAction,
  onPlanAction,
}: {
  planWarning?: boolean
  planType?: string
  credits?: CreditsDisplay
  /** "Upgrade", "View plan", "Choose a plan" — only for whoever can open the plan page. */
  planAction?: string
  onPlanAction?: () => void
}) => {
  if (!planWarning && !planType && credits === undefined) return null
  // No subscription and no trial IS the free tier, named the way the rest of the app names it
  // (Plan.chipLabel, the billing pages). The yellow tone still flags it as needing a choice.
  const planLabel = planWarning ? 'Free Plan' : withPlanSuffix(planType ?? 'Plan')
  const shownCredits = planWarning ? undefined : credits
  return (
    <div style={{ padding: '0 6px 6px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 10, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0px 0px 0px 1px var(--neutral-200)' }}>
        {/* Wraps rather than squeezing: the plan name and what the viewer can do about
            it are both short and both matter, so when they don't fit side by side the
            second one takes its own line instead of either being truncated. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, rowGap: 4, minWidth: 0 }}>
          <PlanChip label={planLabel} tone={planTone(planLabel, !!planWarning)} />
          {planAction ? (
            <Button variant="secondary" size="xs" rightIcon={<ArrowUpRightOneIcon />} onClick={onPlanAction}>
              {planAction}
            </Button>
          ) : (
            <span style={CAPTION}>Managed by your admin</span>
          )}
        </div>
        {shownCredits && (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
              {shownCredits.value}
            </span>
            {shownCredits.caption && <span style={CAPTION}>{shownCredits.caption}</span>}
          </span>
        )}
      </div>
    </div>
  )
}

/** Theme on its own labelled row (hidden when theming is off). */
const ThemeRow = () => {
  const { enabled } = useTheme()
  if (!enabled) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 8px 6px' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-700)' }}>Theme</span>
      <ThemeModeSwitcher />
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
  roleLabel,
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
  // Dropdown.Float (Radix DropdownMenu) already toggles the menu on pointerdown and on
  // Enter / Space / ArrowDown at its trigger wrapper. Toggling again from the trigger's own
  // click / key handler would immediately undo that (the menu never opened), so this is
  // deliberately a no-op; it is kept so trigger visuals keep their click affordance.
  const onOpenSettingsClick = () => {}

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
            <AccountHeader name={name} email={email} avatarSrc={avatarSrc} roleLabel={roleLabel} />

            <PlanRow
              planWarning={planWarning}
              planType={planType}
              credits={credits}
              planAction={showUpgradePlan ? (planWarning ? 'Choose a plan' : viewPlanOnly ? 'View plan' : 'Upgrade') : undefined}
              onPlanAction={() => { onUpgradePlan?.(); close() }}
            />

            <ThemeRow />

            <Divider decorative />

            <Dropdown.Item
              icon={<AnalyticsOneIcon />}
              label="Usage"
              fluid
              onClick={() => { onUsage?.(); close() }}
            />
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
