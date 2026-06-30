'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  UserAiIcon,
  AbacusIcon,
  NeuralNetworkIcon,
  FolderOneIcon,
  LinkSixIcon,
} from '@strange-huge/icons'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { IconButton } from '@/components/IconButton'
import { AccountMenu } from '@/components/AccountMenu'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole } from '@/components/RoleBadge'
import { Tooltip } from '@/components/Tooltip'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { useSettingsGuard } from '@/context/settings-guard-context'
import { useMounted } from '@/hooks/use-mounted'
import { toast } from 'sonner'

const MY_SETTINGS_ITEMS = [
  { id: 'account',       label: 'Account',         href: '/settings/account',       icon: <UserAiIcon        size={20} />, disabled: false },
  { id: 'billing',       label: 'Usage & Billing',  href: '/settings/billing',       icon: <AbacusIcon        size={20} />, disabled: false },
  // { id: 'files',         label: 'Files & Data',     href: '/settings/files',         icon: <FolderLibraryIcon size={20} />, disabled: true  },
  { id: 'ai',            label: 'AI & Models',      href: '/settings/ai',            icon: <NeuralNetworkIcon size={20} />, disabled: false },
  // { id: 'notifications', label: 'Notifications',    href: '/settings/notifications', icon: <BubbleChatIcon    size={20} />, disabled: true  },
  // { id: 'preferences',   label: 'Preference',       href: '/settings/preferences',   icon: <FolderOneIcon     size={20} />, disabled: true  },
  // { id: 'security',      label: 'Security',         href: '/settings/security',      icon: <FolderOneIcon     size={20} />, disabled: true  },
  { id: 'connectors',    label: 'Connectors',       href: '/settings/connectors',    icon: <LinkSixIcon       size={20} />, disabled: false },
  { id: 'help',          label: 'Help & Legal',     href: '/settings/help',          icon: <FolderOneIcon     size={20} variant="static" />, disabled: false },
]


export function SettingsSidebar() {
  const { push } = useRouter()
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useAuth()
  const { orgId, org, plan, orgRole, currentUserRole } = useOrg()
  const { isDirty, saveRef } = useSettingsGuard()
  const portalMounted = useMounted()
  const [pendingHref,    setPendingHref]    = useState<string | null>(null)
  const [isSavingGuard,  setIsSavingGuard]  = useState(false)

  const safeNavigate = (href: string) => {
    if (isDirty && pathname !== href) {
      setPendingHref(href)
      return
    }
    push(href)
  }

  const handleDiscard = () => {
    const href = pendingHref!
    setPendingHref(null)
    push(href)
  }

  const handleSaveAndContinue = async () => {
    if (!saveRef.current) { handleDiscard(); return }
    setIsSavingGuard(true)
    const ok = await saveRef.current()
    setIsSavingGuard(false)
    if (ok) {
      const href = pendingHref!
      setPendingHref(null)
      push(href)
    }
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

  const planLabel = isTeamUser
    ? (orgId ? `Teams | ${org?.name ?? 'Teams'}` : 'Teams')
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : user?.isTrial
        ? 'Free Trial'
        : 'No Plan Selected'

  const planWarning = !isTeamUser && !user?.planType && !user?.isTrial

  // Org and personal balances are already normalized to display credits.
  const accountCredits = orgId
    ? (plan ? org?.creditPool?.remaining : undefined)
    : (user?.creditsRemaining ?? undefined)

  // Role badge with tooltip — mirrors LeftSidebar's displayRole hierarchy.
  const displayRole = (orgRole === 'owner' || orgRole === 'admin')
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
          onClick={() => safeNavigate('/chat')}
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
          display:       'flex',
          flexDirection: 'column',
          gap:           24,
          padding:       '8px 16px 16px',
        }}
      >
        {/* My Settings section  - Personal Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
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
                Personal Settings
              </p>
              {/* <Badge label="Individual" color="Blue" /> */}
            </div>
            {MY_SETTINGS_ITEMS.map(item => (
              item.disabled ? (
                <div key={item.id} style={{ opacity: 0.4, pointerEvents: 'none' }}>
                  <SidebarMenuItem
                    fluid
                    variant="default"
                    icon={item.icon}
                    label={item.label}
                    selected={false}
                  />
                </div>
              ) : (
                <SidebarMenuItem
                  key={item.id}
                  fluid
                  variant="default"
                  icon={item.icon}
                  label={item.label}
                  selected={pathname === item.href}
                  onClick={() => safeNavigate(item.href)}
                />
              )
            ))}
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
            credits={accountCredits}
            avatarSrc={user?.profilePicture ?? undefined}
            collapsed={false}
            panelWidth={274}
            roleBadge={roleBadge}
            placement="top-start"
            onProfile={() => safeNavigate('/settings/account')}
            onUpgradePlan={() => safeNavigate('/settings/billing')}
            onSettings={() => safeNavigate('/settings')}
            onOrganization={(orgId && (orgRole === 'owner' || orgRole === 'admin')) ? () => safeNavigate('/org/general') : undefined}
            onWhatsNew={() => toast.info("What's new — coming soon!")}
            onHelp={() => safeNavigate('/settings/help')}
            onLogOut={() => { if (isAuthenticated) { void logout() } else { push('/auth/login') } }}
          />
        )}
      </div>
    </div>

    {/* ── Unsaved changes confirmation modal ── */}
    {portalMounted && pendingHref && createPortal(
      // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => { if (!isSavingGuard) setPendingHref(null) }}
      >
        {/* eslint-disable-next-line click-events-have-key-events, no-static-element-interactions */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved account changes"
          style={{ backgroundColor: 'var(--neutral-white)', borderRadius: 16, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)' }}
          onClick={e => e.stopPropagation()}
        >
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
              Unsaved account changes
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
              Your profile changes will be lost if you leave now.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" size="sm" disabled={isSavingGuard} onClick={handleDiscard}>
              Discard changes
            </Button>
            <Button variant="default" size="sm" loading={isSavingGuard} onClick={() => { void handleSaveAndContinue() }}>
              Save & continue
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}
