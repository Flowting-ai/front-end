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
  { id: 'account',       label: 'Account',         href: '/settings/account',       icon: <UserAiIcon       size={20} /> },
  { id: 'billing',       label: 'Usage & Billing',  href: '/settings/billing',       icon: <AbacusIcon       size={20} /> },
  { id: 'files',         label: 'Files & Data',     href: '/settings/files',         icon: <FolderLibraryIcon size={20} /> },
  { id: 'ai',            label: 'AI & Models',      href: '/settings/ai',            icon: <NeuralNetworkIcon size={20} /> },
  { id: 'notifications', label: 'Notifications',    href: '/settings/notifications', icon: <BubbleChatIcon   size={20} /> },
  { id: 'preferences',   label: 'Preference',       href: '/settings/preferences',   icon: <FolderOneIcon    size={20} /> },
  { id: 'security',      label: 'Security',         href: '/settings/security',      icon: <FolderOneIcon size={20} /> },
  { id: 'connectors',   label: 'Connectors',       href: '/settings/connectors',    icon: <LinkSixIcon   size={20} /> },
  { id: 'help',         label: 'Help & Legal',     href: '/settings/help',          icon: <FolderOneIcon size={20} /> },
]

const ORG_ITEMS = [
  { id: 'general',   label: 'General',           href: '/settings/org/general',   icon: <UserAiIcon       size={20} /> },
  { id: 'members',   label: 'Members',           href: '/settings/org/members',   icon: <FolderAddIcon    size={20} /> },
  { id: 'plans',     label: 'Plans & Billing',   href: '/settings/org/plans',     icon: <AbacusIcon       size={20} /> },
  { id: 'analytics', label: 'Usage & Analytics', href: '/settings/org/analytics', icon: <FolderLibraryIcon size={20} /> },
]

export function SettingsSidebar() {
  const router  = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  return (
    <div
      className="kaya-scrollbar"
      style={{
        position:        'relative',
        display:         'flex',
        flexDirection:   'column',
        gap:             24,
        width:           294,
        height:          '100%',
        backgroundColor: 'var(--neutral-50)',
        overflowX:       'hidden',
        overflowY:       'auto',
        flexShrink:      0,
        paddingTop:      24,
        paddingLeft:     16,
        paddingRight:    16,
        paddingBottom:   68,
      }}
    >
      {/* ── Title row ── */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, width: '100%' }}>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Go back"
          icon={<ArrowLeftOneIcon size={20} />}
          onClick={() => router.push('/chat')}
        />
        <p style={{
          fontFamily:    'var(--font-title)',
          fontWeight:    400,
          fontSize:      24,
          lineHeight:    '32px',
          color:         'var(--neutral-900)',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
          flex:          '1 0 0',
          minWidth:      0,
          margin:        0,
        }}>
          Settings
        </p>
      </div>

      {/* ── My Settings section ── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: 8, width: '100%', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ padding: '5px 6px' }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-500)',
              margin:     0,
              whiteSpace: 'pre',
            }}>
              My Settings
            </p>
          </div>
          {MY_SETTINGS_ITEMS.map(item => (
            <SidebarMenuItem
              key={item.id}
              fluid
              variant="default"
              icon={item.icon}
              label={item.label}
              selected={pathname === item.href}
              onClick={() => router.push(item.href)}
            />
          ))}
        </div>
      </div>

      {/* ── Organization section ── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: 8, width: '100%', flexShrink: 0 }}>
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
            <SidebarMenuItem
              key={item.id}
              fluid
              variant="default"
              icon={item.icon}
              label={item.label}
              selected={pathname === item.href}
              onClick={() => router.push(item.href)}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom account item ── */}
      <div style={{
        position:        'absolute',
        bottom:          0,
        left:            0,
        right:           0,
        backgroundColor: 'var(--neutral-50)',
        paddingLeft:     10,
        paddingRight:    10,
        paddingTop:      12,
        paddingBottom:   12,
        boxShadow:       '0px -34px 33.5px 0px var(--neutral-50)',
        overflow:        'hidden',
      }}>
        <SidebarMenuItem
          fluid
          variant="account-item"
          label={displayName || 'Account'}
          sublabel={user?.email ?? ''}
          onSettingsClick={() => router.push('/settings/account')}
        />
      </div>
    </div>
  )
}
