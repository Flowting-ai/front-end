'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowDownOneIcon,
  ArrowRightOneIcon,
  CancelOneIcon,
  CheckmarkCircleTwoIcon,
  MoreVerticalIcon,
  PlusSignIcon,
  SearchOneIcon,
  TokenSquareIcon,
  WorkflowSquareTenIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { useOrg } from '@/context/org-context'

type MainTab = 'my' | 'browse' | 'manage' | 'requests' | 'catalog'
type FilterTab = 'all' | 'shared' | 'accounts'
type CategoryTab = 'All' | 'Productivity' | 'Communication' | 'Design' | 'Interactive' | 'Data'
type ConnectorKind = 'github' | 'gmail' | 'drive' | 'hubspot' | 'notion' | 'pipedrive'

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all',      label: 'All' },
  { id: 'shared',   label: 'Shared by your workspace' },
  { id: 'accounts', label: 'Your accounts' },
]

const CATEGORIES: CategoryTab[] = ['All', 'Productivity', 'Communication', 'Design', 'Interactive', 'Data']

const WORKSPACE_CONNECTORS = [
  { name: 'Github', type: 'Workspace connector' },
  { name: 'Github', type: 'Workspace connector' },
]

const ACCOUNT_CONNECTORS = [
  { name: 'Gmail', type: 'Per-member connector', connected: true },
  { name: 'Gmail', type: 'Per-member connector', connected: false },
]

const MANAGED_CONNECTORS = [
  {
    id:          1,
    name:        'Google Drive',
    category:    'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    kind:        'drive' as const,
    action:      'manage' as const,
  },
  {
    id:          2,
    name:        'Google Drive',
    category:    'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    kind:        'drive' as const,
    action:      'manage' as const,
  },
  {
    id:          3,
    name:        'Google Drive',
    category:    'Productivity',
    description: 'Access, attach, and search files from your Drive directly in chat and search files from your Drive directly in chat.',
    kind:        'drive' as const,
    action:      'manage' as const,
  },
]

const ADMIN_CATALOG_CONNECTORS = Array.from({ length: 9 }, (_, index) => ({
  id:          index + 1,
  name:        'Github',
  category:    'Interactive',
  description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
  kind:        'github' as const,
  action:      index % 3 === 0 ? 'added' as const : 'add' as const,
}))

const MEMBER_CATALOG_CONNECTORS = Array.from({ length: 12 }, (_, index) => ({
  id:          index + 1,
  name:        'Github',
  category:    'Interactive',
  description: 'Reference repos, pull requests, and issues. Review code with full repo context.',
}))

const TEAM_REQUESTS = [
  {
    name:      'HubSpot',
    requester: 'Priya Nair',
    meta:      '2 days ago · also upvoted by',
    votes:     '3 others',
    quote:     'Need this to pull deal stages into the sales brain for weekly reports.',
    primary:   'Approve & connect',
    secondary: 'Decline',
  },
  {
    name:      'Notion',
    requester: 'Marcus Web',
    meta:      '2 days ago',
    quote:     'Our design docs live here — brain should be able to read them.',
    primary:   'Approve & connect',
    secondary: 'Decline',
  },
]

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex:           '1 0 0',
        minHeight:      0,
        overflowY:      'auto',
        overflowX:      'hidden',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '64px 24px 48px',
      }}
    >
      <div
        style={{
          width:         967,
          maxWidth:      '100%',
          display:       'flex',
          flexDirection: 'column',
          gap:           32,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function BodyText({
  children,
  size = 14,
  color = 'var(--neutral-500)',
  weight = 400,
  family = 'var(--font-body)',
  style,
}: {
  children: React.ReactNode
  size?: 11 | 12 | 14 | 16 | 24
  color?: string
  weight?: 400 | 500 | 600
  family?: string
  style?: React.CSSProperties
}) {
  const lineHeight = size === 24 ? '32px' : size === 11 ? '16px' : '22px'

  return (
    <p
      style={{
        fontFamily: family,
        fontWeight: weight,
        fontSize:   size,
        lineHeight,
        color,
        margin:     0,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

function TextBlock({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <BodyText
        size={14}
        weight={500}
        color="var(--neutral-900)"
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {title}
      </BodyText>
      {subtitle && (
        <BodyText
          size={11}
          color="var(--neutral-500)"
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {subtitle}
        </BodyText>
      )}
    </div>
  )
}

function TabGroup<T extends string>({
  tabs,
  value,
  onChange,
  size = 'medium',
}: {
  tabs: Array<{ id: T; label: string; badge?: React.ReactNode }>
  value: T
  onChange: (value: T) => void
  size?: 'medium' | 'small'
}) {
  const isSmall = size === 'small'

  return (
    <div
      style={{
        display:         'inline-flex',
        alignSelf:       'flex-start',
        width:           'fit-content',
        alignItems:      'center',
        gap:             isSmall ? 2 : 4,
        padding:         isSmall ? 1 : 0,
        borderRadius:    isSmall ? 8 : 10,
        backgroundColor: 'rgba(247,242,237,0.5)',
        boxShadow:       'inset 0px -1px 0px rgba(255,255,255,0.9), inset 0px 1px 0px var(--neutral-100), inset 0px 0px 4px rgba(209,198,189,0.5)',
      }}
    >
      {tabs.map(tab => {
        const selected = tab.id === value

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border:          'none',
              borderRadius:    isSmall ? 8 : 10,
              padding:         isSmall ? '7px' : '7px 8px',
              backgroundColor: selected ? 'white' : 'transparent',
              boxShadow:       selected ? '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px rgba(38,33,30,0.1)' : undefined,
              color:           selected ? 'var(--blue-600)' : 'var(--neutral-700)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        isSmall ? 11 : 14,
              lineHeight:      isSmall ? '16px' : '22px',
              whiteSpace:      'nowrap',
              cursor:          'pointer',
              display:         'inline-flex',
              alignItems:      'center',
              gap:             6,
            }}
          >
            {tab.label}
            {tab.badge}
          </button>
        )
      })}
    </div>
  )
}

function GithubMark() {
  return (
    <div
      style={{
        width:           32,
        height:          32,
        borderRadius:    6,
        backgroundColor: 'black',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'white',
        fontFamily:      'var(--font-body)',
        fontWeight:      700,
        fontSize:        13,
        lineHeight:      1,
        flexShrink:      0,
      }}
    >
      GH
    </div>
  )
}

function GmailMark() {
  return (
    <div
      style={{
        width:           32,
        height:          32,
        borderRadius:    6,
        backgroundColor: 'white',
        boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
        flexShrink:      0,
      }}
    >
      <Image src="/connector-logos/gmail.svg" alt="" width={24} height={24} />
    </div>
  )
}

function LetterMark({
  label,
  background,
  color,
}: {
  label: string
  background: string
  color: string
}) {
  return (
    <div
      style={{
        width:           32,
        height:          32,
        borderRadius:    6,
        backgroundColor: background,
        color,
        boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontFamily:      'var(--font-body)',
        fontSize:        12,
        fontWeight:      700,
        flexShrink:      0,
      }}
    >
      {label}
    </div>
  )
}

function ConnectorIcon({ kind }: { kind: ConnectorKind }) {
  let mark: React.ReactNode

  if (kind === 'github') mark = <GithubMark />
  else if (kind === 'gmail') mark = <GmailMark />
  else if (kind === 'drive') mark = <LetterMark label="G" background="#fff" color="#2f73d9" />
  else if (kind === 'hubspot') mark = <LetterMark label="HS" background="#fff2e8" color="#c54f1c" />
  else if (kind === 'notion') mark = <LetterMark label="N" background="#fff" color="#1f1b18" />
  else mark = <LetterMark label="PD" background="#eef7f0" color="#317a4a" />

  return (
    <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {mark}
    </div>
  )
}

function PageCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section
      style={{
        width:           '100%',
        border:          '1px solid var(--neutral-200)',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        overflow:        'hidden',
        backgroundColor: 'var(--neutral-50)',
        ...style,
      }}
    >
      {children}
    </section>
  )
}

function DangerOutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             2,
        padding:         '6px 10px 8px',
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'white',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(24,2,2,0.05), 0px 1.455px 3.127px 0px rgba(24,2,2,0.15), 0px 0px 0px 1px var(--red-100), inset 0px -2.182px 0.364px 0px var(--red-100)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--red-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

function ConnectorRow({
  name,
  type,
  kind,
  status,
}: {
  name: string
  type: string
  kind: 'github' | 'gmail'
  status: 'active' | 'connected' | 'not-connected'
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding:         16,
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        minHeight:       70,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 0 0' }}>
        <ConnectorIcon kind={kind} />
        <TextBlock title={name} subtitle={type} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {status === 'active' && <Badge label="Active" color="Green" />}
        {status === 'connected' && (
          <>
            <Badge label="Private to you" color="Blue" />
            <Badge label="Connected" color="Green" />
          </>
        )}
        {status === 'not-connected' && kind === 'gmail' && (
          <>
            <Badge label="Private to you" color="Blue" />
            <Badge label="Not connected" color="Red" />
          </>
        )}
        {status === 'connected' ? (
          <DangerOutlineButton>Disconnect</DangerOutlineButton>
        ) : (
          <Button variant="default" size="sm">Connect</Button>
        )}
      </div>
    </div>
  )
}

function RequestCta({ onClick }: { onClick: () => void }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding:         16,
        display:         'flex',
        alignItems:      'center',
        gap:             12,
      }}
    >
      <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div
          style={{
            width:           32,
            height:          32,
            borderRadius:    8,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           'var(--neutral-700)',
          }}
        >
          <PlusSignIcon size={22} />
        </div>
      </div>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <TextBlock
          title="Need another integration?"
          subtitle="Browse the catalog and request it — your admin gets notified."
        />
      </div>
      <Button variant="default" size="sm" onClick={onClick}>Browse &amp; request</Button>
    </div>
  )
}

function MyConnectors({ onBrowse }: { onBrowse: () => void }) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const showShared = filter === 'all' || filter === 'shared'
  const showAccounts = filter === 'all' || filter === 'accounts'

  return (
    <PageCard>
      <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: '1 0 0', minWidth: 0 }}>
            <BodyText weight={500} color="var(--neutral-900)">My connectors</BodyText>
            <BodyText family="var(--font-title)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Integrations available to you in this workspace. Connect your own accounts where needed.
            </BodyText>
          </div>
          <Badge label="Souvenir Inc. · Member" color="Blue" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <TabGroup tabs={FILTER_TABS} value={filter} onChange={setFilter} size="small" />
          <div style={{ position: 'absolute', right: 0 }}>
            <IconButton variant="ghost" size="sm" aria-label="Search connectors" icon={<SearchOneIcon size={20} />} />
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {showShared && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Shared by your workspace</BodyText>
              <BodyText family="var(--font-title)">Set up by your admin — ready to use</BodyText>
            </div>
            {WORKSPACE_CONNECTORS.map((connector, index) => (
              <ConnectorRow
                key={`${connector.name}-${index}`}
                name={connector.name}
                type={connector.type}
                kind="github"
                status="active"
              />
            ))}
          </section>
        )}

        {showAccounts && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Your accounts</BodyText>
              <BodyText family="var(--font-title)">Enabled for the team — connect your own</BodyText>
            </div>
            {ACCOUNT_CONNECTORS.map((connector, index) => (
              <ConnectorRow
                key={`${connector.name}-${index}`}
                name={connector.name}
                type={connector.type}
                kind="gmail"
                status={connector.connected ? 'connected' : 'not-connected'}
              />
            ))}
          </section>
        )}

        <RequestCta onClick={onBrowse} />
      </div>
    </PageCard>
  )
}

function NoticeCard() {
  return (
    <PageCard style={{ backgroundColor: '#f9f5f1', padding: '12px 0' }}>
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width:           45,
            height:          45,
            borderRadius:    8,
            backgroundColor: 'var(--neutral-100)',
            boxShadow:       '0px 0px 0px 1px rgba(106,98,93,0.5), inset 0px 2px 0px rgba(247,242,237,0.7), inset 0px -2px 0px rgba(106,98,93,0.1)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            color:           'var(--neutral-700)',
            flexShrink:      0,
          }}
        >
          <WorkflowSquareTenIcon size={24} />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <BodyText size={16} weight={500} color="var(--neutral-700)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            You can request, your admin approves
          </BodyText>
          <BodyText family="var(--font-title)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Members don&apos;t connect workspace tools directly — request it and your admin enables it for everyone.
          </BodyText>
        </div>
      </div>
    </PageCard>
  )
}

function CatalogCard() {
  const [category, setCategory] = useState<CategoryTab>('All')

  return (
    <PageCard>
      <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <TabGroup
          tabs={CATEGORIES.map(item => ({ id: item, label: item }))}
          value={category}
          onChange={setCategory}
          size="small"
        />
        <div style={{ position: 'absolute', right: 24, top: 13 }}>
          <IconButton variant="ghost" size="sm" aria-label="Search connector catalog" icon={<SearchOneIcon size={20} />} />
        </div>
      </div>

      <div style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BodyText weight={500} color="var(--neutral-900)">Available to connect</BodyText>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {MEMBER_CATALOG_CONNECTORS.map(connector => (
            <ConnectorCatalogTile key={connector.id} connector={{ ...connector, kind: 'github', action: 'request' }} />
          ))}
        </div>
      </div>
    </PageCard>
  )
}

function SwitchRow() {
  return (
    <PageCard>
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          aria-label="Surface connector suggestions in chat"
          style={{
            width:           44,
            height:          24,
            borderRadius:    999,
            border:          'none',
            padding:         2,
            backgroundColor: 'var(--neutral-200)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'flex-start',
            cursor:          'pointer',
            flexShrink:      0,
          }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: 'white', boxShadow: '0px 1px 2px rgba(82,75,71,0.18)' }} />
        </button>
        <div style={{ minWidth: 0 }}>
          <BodyText weight={500} color="var(--neutral-900)">Surface connector suggestions in chat</BodyText>
          <BodyText>Souvenir proactively suggests relevant connectors based on what you&apos;re working on.</BodyText>
        </div>
      </div>
    </PageCard>
  )
}

function ConnectorCatalogTile({
  connector,
}: {
  connector: {
    id: number
    name: string
    category: string
    description: string
    kind: ConnectorKind
    action: 'request' | 'manage' | 'add' | 'added'
  }
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding:         16,
        display:         'flex',
        flexDirection:   'column',
        gap:             12,
        minHeight:       170,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 0 0' }}>
          <ConnectorIcon kind={connector.kind} />
          <TextBlock title={connector.name} subtitle={connector.category} />
        </div>
        <IconButton variant="ghost" size="sm" aria-label={`${connector.name} options`} icon={<MoreVerticalIcon size={20} />} />
      </div>
      <BodyText
        size={11}
        style={{
          flex:       '1 0 0',
          minHeight:  32,
          overflow:   'visible',
          whiteSpace: 'normal',
          wordBreak:  'normal',
        }}
      >
        {connector.description}
      </BodyText>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: connector.action === 'added' ? 'space-between' : 'flex-end', gap: 8, width: '100%' }}>
        {connector.action === 'added' && (
          <>
            <Badge label="Available" color="Green" />
            <span
              style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        4,
                color:      'var(--neutral-700)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckmarkCircleTwoIcon size={16} />
              Added
            </span>
          </>
        )}
        {connector.action === 'add' && <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />}>Add</Button>}
        {connector.action === 'manage' && <Button variant="default" size="sm">Manage</Button>}
        {connector.action === 'request' && <Button variant="default" size="sm">Request</Button>}
      </div>
    </div>
  )
}

function AdminManageConnectors() {
  const [category, setCategory] = useState<CategoryTab>('All')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SwitchRow />
      <PageCard style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <TabGroup
            tabs={CATEGORIES.map(item => ({ id: item, label: item }))}
            value={category}
            onChange={setCategory}
            size="small"
          />
          <div style={{ position: 'absolute', right: 24, top: 13 }}>
            <IconButton variant="ghost" size="sm" aria-label="Search connectors" icon={<SearchOneIcon size={20} />} />
          </div>
        </div>

        <section style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BodyText weight={500} color="var(--neutral-900)">Connected</BodyText>
              <Badge label="2 active" color="Green" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {MANAGED_CONNECTORS.map(connector => (
                <ConnectorCatalogTile key={connector.id} connector={connector} />
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '12px 24px 12px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <BodyText weight={500} color="var(--neutral-900)">Available to connect</BodyText>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {ADMIN_CATALOG_CONNECTORS.slice(2, 8).map(connector => (
              <ConnectorCatalogTile key={connector.id} connector={{ ...connector, action: 'add' }} />
            ))}
          </div>
        </section>
      </PageCard>
    </div>
  )
}

function RequestReviewRow({
  request,
  unavailable = false,
  onRequestSouvenir,
}: {
  request: {
    name: string
    requester: string
    meta: string
    votes?: string
    quote: string
    primary: string
    secondary: string
  }
  unavailable?: boolean
  onRequestSouvenir?: () => void
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding:         16,
        display:         'flex',
        alignItems:      'center',
        gap:             12,
      }}
    >
      {unavailable ? (
        <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div
            style={{
              width:           32,
              height:          32,
              borderRadius:    8,
              backgroundColor: 'var(--neutral-100)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           'var(--neutral-900)',
            }}
          >
            <PlusSignIcon size={22} />
          </div>
        </div>
      ) : (
        <ConnectorIcon kind="github" />
      )}
      <div style={{ minWidth: 0, flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BodyText weight={500} color="var(--neutral-900)">{request.name}</BodyText>
          <Badge label={unavailable ? 'NOT AVAILABLE' : 'PENDING'} color={unavailable ? 'Yellow' : 'Red'} />
        </div>
        <BodyText size={11}>
          Requested by <span style={{ color: 'black' }}>{request.requester}</span> · {request.meta}
          {request.votes && <> <span style={{ color: 'black' }}>{request.votes}</span></>}
        </BodyText>
        <BodyText size={11} color="var(--neutral-500)" family="var(--font-title)">&quot;{request.quote}&quot;</BodyText>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <DangerOutlineButton>{request.secondary}</DangerOutlineButton>
        <Button
          variant="default"
          size="sm"
          onClick={onRequestSouvenir}
          rightIcon={unavailable ? <ArrowRightOneIcon size={16} /> : undefined}
        >
          {request.primary}
        </Button>
      </div>
    </div>
  )
}

function RequestQueue({ onRequestSouvenir }: { onRequestSouvenir: () => void }) {
  return (
    <PageCard style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <BodyText weight={500} color="var(--neutral-900)">My connectors</BodyText>
          <BodyText>Integrations available to you in this workspace. Connect your own accounts where needed.</BodyText>
        </div>
        <Badge label="Souvenir Inc. · Member" color="Blue" />
      </div>

      <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <BodyText weight={500} color="var(--neutral-900)">From your team</BodyText>
            <BodyText>Available on Souvenir — approve to connect</BodyText>
          </div>
          {TEAM_REQUESTS.map(request => (
            <RequestReviewRow key={request.name} request={request} />
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <BodyText weight={500} color="var(--neutral-900)">Your accounts</BodyText>
            <BodyText>Enabled for the team — connect your own</BodyText>
          </div>
          <RequestReviewRow
            unavailable
            onRequestSouvenir={onRequestSouvenir}
            request={{
              name:      'Pipedrive',
              requester: 'Harsh Patel',
              meta:      '1 days ago',
              quote:     "This is our actual CRM — Salesforce connector won't help us.",
              primary:   'Request from Souvenir',
              secondary: 'Dismiss',
            }}
          />
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--neutral-500)' }}>
          <TokenSquareIcon size={24} />
          <BodyText>
            Approving a connector here adds it to <span style={{ color: 'black' }}>Shared connectors</span> or enables it as a <span style={{ color: 'black' }}>Per-member</span> type, depending on the integration.
          </BodyText>
        </div>
      </div>
    </PageCard>
  )
}

function AdminCatalog({ onRequestSouvenir }: { onRequestSouvenir: () => void }) {
  const [category, setCategory] = useState<CategoryTab>('All')

  return (
    <PageCard style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <TabGroup
          tabs={CATEGORIES.map(item => ({ id: item, label: item }))}
          value={category}
          onChange={setCategory}
          size="small"
        />
        <div style={{ position: 'absolute', right: 24, top: 13 }}>
          <IconButton variant="ghost" size="sm" aria-label="Search connector catalog" icon={<SearchOneIcon size={20} />} />
        </div>
      </div>

      <div style={{ padding: '12px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {ADMIN_CATALOG_CONNECTORS.map(connector => (
          <ConnectorCatalogTile key={connector.id} connector={connector} />
        ))}
        <div
          style={{
            gridColumn:      '1 / span 3',
            backgroundColor: 'white',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
            padding:         16,
            display:         'flex',
            alignItems:      'flex-start',
            gap:             24,
          }}
        >
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 390, maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width:           40,
                  height:          40,
                  borderRadius:    999,
                  border:          '3px solid black',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  color:           'black',
                  flexShrink:      0,
                  transform:       'rotate(-10deg)',
                }}
              >
                <WorkflowSquareTenIcon size={22} />
              </div>
              <div style={{ minWidth: 0, flex: '1 0 0' }}>
                <BodyText weight={500} color="var(--neutral-900)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Don&apos;t see what you need?
                </BodyText>
                <BodyText
                  size={11}
                  color="var(--neutral-500)"
                  weight={500}
                  style={{ width: 365, maxWidth: '100%', whiteSpace: 'normal', overflow: 'visible' }}
                >
                  If your tool isn&apos;t in the catalog, request it directly from Souvenir. We&apos;ll scope the integration and notify your workspace when it ships.
                </BodyText>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={onRequestSouvenir}>
              Request from Souvenir
            </Button>
          </div>
        </div>
      </div>
    </PageCard>
  )
}

function RequestFromSouvenirDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [toolName, setToolName] = useState('')
  const [url,      setUrl]      = useState('')
  const [details,  setDetails]  = useState('')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(26,25,22,0.24)',
            zIndex:          100,
          }}
        />
        <Dialog.Content
          style={{
            position:        'fixed',
            top:             '50%',
            left:            '50%',
            transform:       'translate(-50%, -50%)',
            width:           708,
            maxWidth:        'calc(100vw - 48px)',
            borderRadius:    20,
            backgroundColor: '#f7f2ed',
            boxShadow:       '0px 24px 60px rgba(38,33,30,0.22), 0px 0px 0px 1px var(--neutral-200)',
            padding:         8,
            zIndex:          101,
          }}
        >
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'flex-start', gap: 24 }}>
              <div style={{ minWidth: 0, flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Dialog.Title asChild>
                  <BodyText size={24} family="var(--font-title)" color="#1a1916">Request from Souvenir</BodyText>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <BodyText>
                    Tell Souvenir what you need. We&apos;ll scope it and notify your workspace when it&apos;s available.
                  </BodyText>
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <IconButton variant="ghost" size="sm" aria-label="Close request dialog" icon={<CancelOneIcon size={20} />} />
              </Dialog.Close>
            </div>

            <BodyText style={{ padding: '0 12px' }}>
              Share the tool and the workflow you need. Add enough context for Souvenir to understand the data, actions, and team that will use it.
            </BodyText>

            <div
              style={{
                border:          '1px solid var(--neutral-200)',
                borderRadius:    16,
                padding:         12,
                backgroundColor: 'var(--neutral-50)',
                display:         'flex',
                flexDirection:   'column',
                gap:             12,
              }}
            >
              <InputField
                fluid
                label="Tool / service name"
                placeholder="e.g. beehiiv"
                value={toolName}
                onChange={setToolName}
              />
              <InputField
                fluid
                label="Website or app URL (optional)"
                placeholder="http://"
                value={url}
                onChange={setUrl}
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <BodyText size={14} color="var(--text-field-label)">What do you need it to do?</BodyText>
                <textarea
                  value={details}
                  onChange={event => setDetails(event.target.value)}
                  placeholder="What data should the brain read? What actions should it take? Which team needs it?"
                  style={{
                    minHeight:       88,
                    resize:          'vertical',
                    border:          'none',
                    borderRadius:    10,
                    padding:         '10px 12px',
                    backgroundColor: 'var(--text-field-bg)',
                    boxShadow:       '0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
                    fontFamily:      'var(--font-body)',
                    fontSize:        14,
                    lineHeight:      '22px',
                    color:           'var(--neutral-900)',
                    outline:         '2px solid transparent',
                    outlineOffset:   3,
                  }}
                />
              </label>
              <InputField
                fluid
                readOnly
                label="How blocking is this?"
                value="Would help our workflow"
                rightIcon={<ArrowDownOneIcon size={16} />}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Dialog.Close asChild>
                <Button variant="secondary" size="md">Cancel</Button>
              </Dialog.Close>
              <Button variant="default" size="md">Send request to Souvenir</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function OrgConnectorsPage() {
  const { currentUserRole } = useOrg()
  const isAdminView = currentUserRole === 'admin'
  const [tab, setTab] = useState<MainTab>('manage')
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const activeTab: MainTab = isAdminView
    ? (tab === 'my' || tab === 'browse' ? 'manage' : tab)
    : (tab === 'manage' || tab === 'requests' || tab === 'catalog' ? 'my' : tab)

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ minHeight: 36 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0 }}>
            Connectors
          </h1>
        </div>
        <TabGroup
          tabs={isAdminView
            ? [
                { id: 'manage',   label: 'Manage connectors' },
                { id: 'requests', label: 'Request', badge: <Badge label="5" color="Red" /> },
                { id: 'catalog',  label: 'Browse catalog' },
              ]
            : [
                { id: 'my',     label: 'My Connectors' },
                { id: 'browse', label: 'Browse & request' },
              ]}
          value={activeTab}
          onChange={setTab}
        />
      </div>

      {isAdminView ? (
        <>
          {activeTab === 'manage' && <AdminManageConnectors />}
          {activeTab === 'requests' && <RequestQueue onRequestSouvenir={() => setRequestModalOpen(true)} />}
          {activeTab === 'catalog' && <AdminCatalog onRequestSouvenir={() => setRequestModalOpen(true)} />}
        </>
      ) : activeTab === 'my' ? (
        <MyConnectors onBrowse={() => setTab('browse')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <NoticeCard />
          <CatalogCard />
        </div>
      )}

      <RequestFromSouvenirDialog open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PageShell>
  )
}
