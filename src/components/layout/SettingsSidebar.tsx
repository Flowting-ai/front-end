'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  UserAiIcon,
  AbacusIcon,
  NeuralNetworkIcon,
  FolderLibraryIcon,
  BubbleChatIcon,
  FolderOneIcon,
  FolderAddIcon,
  LinkSixIcon,
} from '@strange-huge/icons'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { IconButton } from '@/components/IconButton'
import { useAuth } from '@/context/auth-context'

const MY_SETTINGS_ITEMS = [
  { id: 'account',       label: 'Account',         href: '/settings/account',       icon: <UserAiIcon        size={20} />, disabled: false },
  { id: 'billing',       label: 'Usage & Billing',  href: '/settings/billing',       icon: <AbacusIcon        size={20} />, disabled: false },
  { id: 'files',         label: 'Files & Data',     href: '/settings/files',         icon: <FolderLibraryIcon size={20} />, disabled: true  },
  { id: 'ai',            label: 'AI & Models',      href: '/settings/ai',            icon: <NeuralNetworkIcon size={20} />, disabled: false },
  { id: 'notifications', label: 'Notifications',    href: '/settings/notifications', icon: <BubbleChatIcon    size={20} />, disabled: true  },
  { id: 'preferences',   label: 'Preference',       href: '/settings/preferences',   icon: <FolderOneIcon     size={20} />, disabled: true  },
  { id: 'security',      label: 'Security',         href: '/settings/security',      icon: <FolderOneIcon     size={20} />, disabled: true  },
  { id: 'connectors',    label: 'Connectors',       href: '/settings/connectors',    icon: <LinkSixIcon       size={20} />, disabled: false },
  { id: 'help',          label: 'Help & Legal',     href: '/settings/help',          icon: <FolderOneIcon     size={20} />, disabled: false },
]

const ORG_ITEMS = [
  { id: 'general',   label: 'General',           href: '/settings/org/general',   icon: <UserAiIcon        size={20} />, disabled: true },
  { id: 'members',   label: 'Members',           href: '/settings/org/members',   icon: <FolderAddIcon     size={20} />, disabled: true },
  { id: 'plans',     label: 'Plans & Billing',   href: '/settings/org/plans',     icon: <AbacusIcon        size={20} />, disabled: true },
  { id: 'analytics', label: 'Usage & Analytics', href: '/settings/org/analytics', icon: <FolderLibraryIcon size={20} />, disabled: true },
]

export function SettingsSidebar() {
  const { push } = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  return (
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
          onClick={() => push('/chat')}
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
        {/* My Settings section */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ padding: '5px 6px' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
                whiteSpace: 'nowrap',
              }}>
                My Settings
              </p>
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
                  onClick={() => push(item.href)}
                />
              )
            ))}
          </div>
        </div>

        {/* Organization section */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ padding: '5px 6px' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-500)',
                margin:     0,
                whiteSpace: 'nowrap',
              }}>
                Organization
              </p>
            </div>
            {ORG_ITEMS.map(item => (
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
                  onClick={() => push(item.href)}
                />
              )
            ))}
          </div>
        </div>
      </div>

      {/* ── Account item — fixed ── */}
      <div style={{
        flexShrink:      0,
        backgroundColor: 'var(--neutral-50)',
        paddingLeft:     10,
        paddingRight:    10,
        paddingTop:      12,
        paddingBottom:   12,
        boxShadow:       '0px -34px 33.5px 0px var(--neutral-50)',
      }}>
        <SidebarMenuItem
          fluid
          variant="account-item"
          label={displayName || 'Account'}
          sublabel={user?.email ?? ''}
          onSettingsClick={() => push('/settings/account')}
        />
      </div>
    </div>
  )
}
