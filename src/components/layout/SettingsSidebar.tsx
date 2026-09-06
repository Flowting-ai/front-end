'use client'

import React, { useState } from 'react'
import { m } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ArrowLeftOneIcon } from '@strange-huge/icons'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { IconButton } from '@/components/IconButton'
import { AccountMenu } from '@/components/AccountMenu'
import { ReportBugModal } from '@/components/ReportBugModal'
import { RequestFeatureModal } from '@/components/RequestFeatureModal'
import { Divider } from '@/components/Divider'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole } from '@/components/RoleBadge'
import { Tooltip } from '@/components/Tooltip'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useGuardedRouter } from '@/context/nav-guard-context'
import { SETTINGS_ACCOUNT_ROUTE, SETTINGS_USAGE_ROUTE, SETTINGS_HELP_ROUTE, CHAT_ROUTE, ORG_GENERAL_ROUTE, ORG_MEMBERS_ROUTE, ORG_PLANS_ROUTE, ORG_ANALYTICS_ROUTE, SETTINGS_ROUTE, AUTH_LOGIN_ROUTE } from '@/lib/routes'

// ── Nav icons — Settings v1.5 sidebar ────────────────────────────────────────
// Figma: https://www.figma.com/design/EirgiIxJWDEeUNZnKwr3f8/Settings-v1.5?node-id=18-27780
// Exported as static assets (public/icons/settings-sidebar/) rather than
// mapped onto existing @strange-huge/icons glyphs — none of the existing set
// clearly matched these (e.g. General's monitor glyph vs. the gear-shaped
// SettingsOneIcon used elsewhere), and 1:1 fidelity was the ask. `triggered`
// is accepted-and-ignored so SidebarMenuItem's `cloneElement(icon, {
// triggered })` doesn't warn about an unknown prop landing on a plain <img>.
function SidebarAssetIcon({ src, triggered: _triggered }: { src: string; triggered?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local icon, Next Image adds no value here
    <img src={src} width={20} height={20} alt="" aria-hidden style={{ display: 'block' }} />
  )
}

// -- Item stagger animation - same three-layer pattern as LeftSidebar/Sidebar --
const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
}

const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

// ── Settings v1.5 nav groups ──────────────────────────────────────────────────
// PERSONAL: node 18:27786. "Connectors" (previously in this group under the
// old design, SETTINGS_CONNECTORS_ROUTE) has no home in the new Figma frame —
// dropped here, flagged for follow-up rather than silently discarded.
const PERSONAL_ITEMS = [
  { id: 'account', label: 'Account', href: SETTINGS_ACCOUNT_ROUTE, icon: <SidebarAssetIcon src="/icons/settings-sidebar/account.svg" /> },
  // Was a stand-in pointing at SETTINGS_BILLING_ROUTE until the dedicated
  // Usage page (node 17-22980) existed — now points at its own route.
  { id: 'usage',   label: 'Usage',   href: SETTINGS_USAGE_ROUTE,   icon: <SidebarAssetIcon src="/icons/settings-sidebar/usage-personal.svg" /> },
]

// WORKSPACE: node 18:27793 (labelled "Organization" pre-v1.5). Admin only.
const WORKSPACE_ITEMS = [
  { id: 'general', label: 'General',         href: ORG_GENERAL_ROUTE, icon: <SidebarAssetIcon src="/icons/settings-sidebar/general.svg" /> },
  { id: 'members', label: 'Members',         href: ORG_MEMBERS_ROUTE, icon: <SidebarAssetIcon src="/icons/settings-sidebar/members.svg" /> },
  { id: 'plans',   label: 'Plans & Billing', href: ORG_PLANS_ROUTE,   icon: <SidebarAssetIcon src="/icons/settings-sidebar/plans-billing.svg" /> },
  // "Usage" here maps to the same Analytics page as the old "Analytics" item —
  // closest existing route to a workspace-level usage view. The old group's
  // separate "Activity Log" (ORG_ACTIVITY_ROUTE) has no slot in the new design.
  { id: 'usage',   label: 'Usage',           href: ORG_ANALYTICS_ROUTE, icon: <SidebarAssetIcon src="/icons/settings-sidebar/usage-workspace.svg" /> },
]

// HELP & SUPPORT: node 18:27804. New group — Help & Legal moves out of
// PERSONAL; Report a bug moves out of the account-menu dropdown into the main
// nav; Feature request is new (wired to the existing RequestFeatureModal).
const HELP_ITEMS = [
  { id: 'help', label: 'Help & Legal', href: SETTINGS_HELP_ROUTE, icon: <SidebarAssetIcon src="/icons/settings-sidebar/help-legal.svg" /> },
]


export function SettingsSidebar() {
  // Guarded push — same app-wide "unsaved changes" system LeftSidebar uses
  // (nav-guard-context), so leaving a dirty Settings page shows the shared
  // confirmation modal (rendered once in (app)/layout.tsx) regardless of
  // whether the user clicks a Settings nav item or the main app sidebar.
  const { push } = useGuardedRouter()
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useAuth()
  const { orgId, org, plan, orgRole, currentUserRole } = useOrg()
  const [reportBugOpen,  setReportBugOpen]  = useState(false)
  const [requestFeatureOpen, setRequestFeatureOpen] = useState(false)

  // No-op for a click on the already-active nav item — avoids re-triggering
  // the guard (or a pointless re-navigation) for a same-page click.
  const safeNavigate = (href: string) => {
    if (pathname === href) return
    push(href)
  }

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  const billingSnap = (() => {
    try { const r = window?.sessionStorage?.getItem('kaya:billing:snapshot:v2'); return r ? JSON.parse(r) : null } catch { return null }
  })()
  const isTeamUser = Boolean(
    orgId ||
    user?.orgId ||
    user?.roleFit === 'small_team' ||
    user?.roleFit === 'large_team' ||
    billingSnap?.isTeamAccount
  )

  // A truthy `plan` object just means the plan API call returned something —
  // orgs get one populated with zeroes before a real subscription/pool exists.
  // Mirrors plans-and-billing/page.tsx's `hasPlan = isEnterprise || totalCredits > 0`.
  const orgHasPlan = orgId ? (org?.plan === 'enterprise' || (plan?.totalCredits ?? 0) > 0) : false

  // Distinct from orgHasPlan above: true only once a plan is actually
  // SELECTED (a real Teams subscription or signed Enterprise contract), not
  // just because the org has a starting credit balance — the one-time $25
  // founder org-create grant funds the pool immediately on workspace
  // creation, before any plan is ever chosen. See OrgPlan.hasSelectedPlan's
  // own doc comment (types/teams.ts) for the backend signal this reads.
  const orgHasSelectedPlan = orgId ? !!plan?.hasSelectedPlan : false

  // Workspace identity line — just the org name, independent of plan/billing
  // status, which now surfaces only via the status tag below. Individuals
  // have no named workspace, so they get no second line at all.
  const planLabel = isTeamUser
    ? (orgId ? (org?.name ?? 'Workspace') : 'Workspace')
    : undefined

  const planWarning = isTeamUser ? !orgHasPlan : (!user?.planType && !user?.isTrial)

  // Plan-type label for the status tag ("Workspace | 250 credits left" /
  // "Pro | 250 credits left") — distinct from planLabel above, which is now
  // just the org's own name. Team orgs get "Free Plan" (blue tag, see
  // planStatusVariant below) until a real plan is selected, then "Workspace".
  const planTypeLabel = isTeamUser
    ? (orgHasSelectedPlan ? 'Workspace' : 'Free Plan')
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : user?.isTrial
        ? 'Free Trial'
        : undefined

  // Blue tag for "Free Plan" (running on starting credits, no plan selected
  // yet); default color once a real plan is selected, and always for
  // individuals.
  const planStatusVariant: 'neutral' | 'blue' = (isTeamUser && orgHasPlan && !orgHasSelectedPlan) ? 'blue' : 'neutral'

  // Org and personal balances are already normalized to display credits.
  const accountCredits = orgId
    ? (orgHasPlan ? org?.creditPool?.remaining : undefined)
    : (planWarning ? undefined : (user?.creditsRemaining ?? undefined))

  // Role badge with tooltip — mirrors LeftSidebar's displayRole hierarchy.
  const displayRole = orgRole === 'admin'
    ? orgRole
    : (currentUserRole ?? (orgId ? 'member' : undefined))
  const roleTooltip = displayRole
    ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1)
    : undefined
  const roleBadge = orgId && displayRole ? (
    <Tooltip content={roleTooltip} side="top" delayDuration={300}>
      <span style={{ display: 'inline-flex' }}>
        <RoleBadge role={displayRole as WorkspaceRole} showLabel={false} mode="solar" />
      </span>
    </Tooltip>
  ) : undefined

  // PERSONAL section's inline role chip (node 23:29814) — same role signal as
  // roleBadge above but with the label shown, matching the Figma "Admin" chip.
  // Figma's chip uses the blue/editor colour tokens under an "Admin" label —
  // likely a copy-paste mismatch in the design (this codebase's RoleBadge
  // consistently uses tan for admin, blue for editor elsewhere) — rendering
  // the real per-viewer role+colour here rather than hardcoding the mismatch.
  const personalSectionChip = orgId && displayRole ? (
    <RoleBadge role={displayRole as WorkspaceRole} showLabel mode="solar" />
  ) : undefined

  return (
    <>
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        width:           294,
        height:          '100%',
        backgroundColor: 'var(--neutral-50)',
        flexShrink:      0,
        overflow:        'hidden',
      }}
    >
      {/* ── Title row — fixed ── */}
      <div style={{
        flexShrink:  0,
        display:     'flex',
        gap:         4,
        alignItems:  'center',
        padding:     '24px 16px 8px',
      }}>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Go back"
          icon={<ArrowLeftOneIcon size={20} />}
          onClick={() => safeNavigate(CHAT_ROUTE)}
        />
        <p style={{
          fontFamily:   'var(--font-title)',
          fontWeight:   400,
          fontSize:     24,
          lineHeight:   '32px',
          color:        'var(--neutral-900)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          flex:         '1 0 0',
          minWidth:     0,
          margin:       0,
        }}>
          Settings
        </p>
      </div>

      {/* ── Scrollable nav ── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex:          '1 0 0',
          minHeight:     0,
          overflowY:     'auto',
          overflowX:     'hidden',
          paddingTop:    8,
          paddingBottom: 16,
        }}
      >
        {/* Horizontal padding lives on this inner wrapper, not the scrolling
            element above — keeps the scrollbar flush with the sidebar's edge. */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>

        {/* PERSONAL — node 18:27786 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '5px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
              whiteSpace: 'nowrap',
            }}>
              PERSONAL
            </p>
            {personalSectionChip}
          </div>
          <m.div
            animate="open"
            initial="closed"
            variants={sectionStaggerVariants}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {PERSONAL_ITEMS.map(item => (
              <m.div key={item.id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant="default"
                  icon={item.icon}
                  label={item.label}
                  selected={pathname === item.href}
                  onClick={() => safeNavigate(item.href)}
                />
              </m.div>
            ))}
          </m.div>
        </div>

        <Divider decorative style={{ margin: '8px 0' }} />

        {/* WORKSPACE — node 18:27793 (admin only; former /org/* admin pages) */}
        {orgId && orgRole === 'admin' && (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ padding: '5px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
                whiteSpace: 'nowrap',
              }}>
                WORKSPACE
              </p>
            </div>
            <m.div
              animate="open"
              initial="closed"
              variants={sectionStaggerVariants}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {WORKSPACE_ITEMS.map(item => (
                <m.div key={item.id} variants={sectionItemVariants}>
                  <SidebarMenuItem
                    fluid
                    variant="default"
                    icon={item.icon}
                    label={item.label}
                    selected={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    onClick={() => safeNavigate(item.href)}
                  />
                </m.div>
              ))}
            </m.div>
          </div>

          <Divider decorative style={{ margin: '8px 0' }} />
          </>
        )}

        {/* HELP & SUPPORT — node 18:27804 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '5px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
              whiteSpace: 'nowrap',
            }}>
              HELP & SUPPORT
            </p>
          </div>
          <m.div
            animate="open"
            initial="closed"
            variants={sectionStaggerVariants}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {HELP_ITEMS.map(item => (
              <m.div key={item.id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant="default"
                  icon={item.icon}
                  label={item.label}
                  selected={pathname === item.href}
                  onClick={() => safeNavigate(item.href)}
                />
              </m.div>
            ))}
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<SidebarAssetIcon src="/icons/settings-sidebar/report-bug.svg" />}
                label="Report a bug"
                selected={false}
                onClick={() => setReportBugOpen(true)}
              />
            </m.div>
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<SidebarAssetIcon src="/icons/settings-sidebar/feature-request.svg" />}
                label="Feature request"
                selected={false}
                onClick={() => setRequestFeatureOpen(true)}
              />
            </m.div>
          </m.div>
        </div>

        </div>

      </div>

      {/* ── Account menu — fixed ── */}
      <div style={{
        flexShrink:      0,
        backgroundColor: 'var(--neutral-50)',
        paddingLeft:     10,
        paddingRight:    10,
        paddingTop:      12,
        paddingBottom:   12,
        boxShadow:       '0px -34px 33.5px 0px var(--neutral-50)',
      }}>
        {!user ? (
          <div style={{ padding: '8px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="kaya-skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="kaya-skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
              <div className="kaya-skeleton" style={{ height: 11, width: '42%', borderRadius: 4 }} />
            </div>
          </div>
        ) : (
          <AccountMenu
            name={displayName || 'Account'}
            plan={planLabel}
            planWarning={planWarning}
            planType={planTypeLabel}
            credits={accountCredits}
            planStatusVariant={planStatusVariant}
            avatarSrc={user?.profilePicture ?? undefined}
            collapsed={false}
            panelWidth={274}
            roleBadge={roleBadge}
            placement="top-start"
            onProfile={() => safeNavigate(SETTINGS_ACCOUNT_ROUTE)}
            onUpgradePlan={() => safeNavigate(ORG_PLANS_ROUTE)}
            onSettings={() => safeNavigate(SETTINGS_ROUTE)}
            onOrganization={(orgId && orgRole === 'admin') ? () => safeNavigate(ORG_GENERAL_ROUTE) : undefined}
            onHelp={() => safeNavigate(SETTINGS_HELP_ROUTE)}
            onReportBug={() => setReportBugOpen(true)}
            onLogOut={() => { if (isAuthenticated) { void logout() } else { push(AUTH_LOGIN_ROUTE) } }}
          />
        )}
      </div>
    </div>

    {/* Unsaved-changes confirmation is now the shared NavGuardModal (mounted
        once app-wide in (app)/layout.tsx) — see useGuardedRouter() above. */}

    {reportBugOpen && <ReportBugModal onClose={() => setReportBugOpen(false)} />}
    {requestFeatureOpen && <RequestFeatureModal onClose={() => setRequestFeatureOpen(false)} />}
    </>
  )
}
