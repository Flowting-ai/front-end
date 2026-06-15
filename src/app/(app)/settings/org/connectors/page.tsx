'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { listConnectors, initiateLink, unlinkConnector, updateConnector, pollConnectorUntilActive } from '@/lib/api/connectors'
import type { ConnectorCatalogEntry, ConnectorTool } from '@/lib/api/connectors'
import { connectorLogoSrc } from '@/lib/connectorLogos'
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

const CONNECTOR_CATEGORY_MAP: Record<string, CategoryTab> = {
  github:    'Interactive',
  gmail:     'Communication',
  drive:     'Productivity',
  hubspot:   'Data',
  notion:    'Productivity',
  pipedrive: 'Data',
}

interface ConnectorRequest {
  slug:      string
  name:      string
  iconUrl?:  string
  requester: string
  daysAgo:   string
  votes?:    string    // "3 others" — upvote count label
  quote:     string
  /** true = in catalog, admin can approve; false = not in catalog, must escalate to Souvenir */
  available: boolean
}

// Connector requests have no backend endpoint yet, so there is no real data to
// show — start empty (the Requests tab renders its empty state). Replace these
// with a real fetch once an endpoint exists; do NOT reintroduce sample data.
const PENDING_FROM_TEAM: ConnectorRequest[] = []

const PENDING_YOUR_ACCOUNTS: ConnectorRequest[] = []

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

function ConnectorIcon({ kind, iconUrl, slug }: { kind?: ConnectorKind; iconUrl?: string; slug?: string }) {
  let mark: React.ReactNode

  // Prefer the bundled brand logo by slug (same source as Settings → Connectors),
  // then a backend icon_url, then the letter-mark fallback.
  const localLogo = slug ? connectorLogoSrc(slug) : null

  if (localLogo) {
    mark = (
      <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'white', boxShadow: '0px 0px 0px 1px var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- bundled brand asset, variable path prevents next/image static analysis */}
        <img src={localLogo} alt="" width={24} height={24} style={{ objectFit: 'contain' }} />
      </div>
    )
  } else if (iconUrl) {
    mark = (
      <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'white', boxShadow: '0px 0px 0px 1px var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        <Image src={iconUrl} alt="" width={24} height={24} unoptimized />
      </div>
    )
  } else if (kind === 'github') {
    mark = <GithubMark />
  } else if (kind === 'gmail') {
    mark = <GmailMark />
  } else if (kind === 'drive') {
    mark = <LetterMark label="G" background="#fff" color="#2f73d9" />
  } else if (kind === 'hubspot') {
    mark = <LetterMark label="HS" background="#fff2e8" color="#c54f1c" />
  } else if (kind === 'notion') {
    mark = <LetterMark label="N" background="#fff" color="#1f1b18" />
  } else {
    mark = <LetterMark label="?" background="var(--neutral-100)" color="var(--neutral-700)" />
  }

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

function DangerOutlineButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  connector,
  status,
  onConnect,
  onDisconnect,
}: {
  connector:     ConnectorCatalogEntry
  status:        'active' | 'connected' | 'not-connected'
  onConnect?:    () => void
  onDisconnect?: () => void
}) {
  const type = connector.auth_mode === 'oauth2' ? 'Per-member connector' : 'Workspace connector'

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
        <ConnectorIcon iconUrl={connector.icon_url} slug={connector.slug} />
        <TextBlock title={connector.display_name} subtitle={type} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {status === 'active' && <Badge label="Active" color="Green" />}
        {status === 'connected' && (
          <>
            <Badge label="Private to you" color="Blue" />
            <Badge label="Connected" color="Green" />
          </>
        )}
        {status === 'not-connected' && connector.auth_mode === 'oauth2' && (
          <>
            <Badge label="Private to you" color="Blue" />
            <Badge label="Not connected" color="Red" />
          </>
        )}
        {status === 'connected' ? (
          <DangerOutlineButton onClick={onDisconnect}>Disconnect</DangerOutlineButton>
        ) : (
          <Button variant="default" size="sm" onClick={onConnect}>Connect</Button>
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

// ── Shared search bar used in connector panels ────────────────────────────────
// Clicking the search IconButton expands an input inline; a second IconButton
// (CancelOneIcon) appears to clear the text while keeping the input open.
// Pressing Escape or clicking the search icon again collapses and clears.

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleToggle = () => {
    if (open) { onChange(''); setOpen(false) }
    else       { setOpen(true) }
  }

  // The clear IconButton is always mounted (never conditionally rendered) to
  // avoid the @strange-huge/icons Framer Motion controls.set() invariant that
  // fires when an icon-containing component mounts for the first time. Use
  // visibility + pointer-events instead so the DOM node stays alive.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search…"
        onKeyDown={e => { if (e.key === 'Escape') { onChange(''); setOpen(false) } }}
        style={{
          border:       open ? '1px solid var(--neutral-200)' : 'none',
          borderRadius: 8,
          padding:      open ? '4px 8px' : 0,
          height:       32,
          fontFamily:   'var(--font-body)',
          fontSize:     13,
          color:        'var(--neutral-900)',
          background:   'white',
          // eslint-disable-next-line react-doctor/no-outline-none -- global :focus-visible handles outline
          outline:      'none',
          width:        open ? 140 : 0,
          overflow:     'hidden',
          transition:   'width 150ms ease',
        }}
      />
      <span style={{ visibility: open && !!value ? 'visible' : 'hidden', pointerEvents: open && !!value ? 'auto' : 'none' }}>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Clear search"
          icon={<CancelOneIcon size={20} />}
          onClick={() => { onChange(''); inputRef.current?.focus() }}
        />
      </span>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={open ? 'Close search' : 'Search'}
        icon={<SearchOneIcon size={20} />}
        onClick={handleToggle}
      />
    </div>
  )
}

function MyConnectors({
  onBrowse,
  connectors,
  onConnect,
  onDisconnect,
}: {
  onBrowse:     () => void
  connectors:   ConnectorCatalogEntry[]
  onConnect:    (slug: string) => void
  onDisconnect: (slug: string) => void
}) {
  const [filter,      setFilter]      = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const q = searchQuery.toLowerCase().trim()
  const matchSearch = (c: ConnectorCatalogEntry) =>
    !q || c.display_name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)

  const sharedConnectors  = connectors.filter(c => c.auth_mode !== 'oauth2' && c.linked).filter(matchSearch)
  const accountConnectors = connectors.filter(c => c.auth_mode === 'oauth2').filter(matchSearch)
  const showShared   = filter === 'all' || filter === 'shared'
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
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {showShared && sharedConnectors.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Shared by your workspace</BodyText>
              <BodyText family="var(--font-title)">Set up by your admin — ready to use</BodyText>
            </div>
            {sharedConnectors.map(c => (
              <ConnectorRow key={c.slug} connector={c} status="active" onDisconnect={() => onDisconnect(c.slug)} />
            ))}
          </section>
        )}

        {showAccounts && accountConnectors.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Your accounts</BodyText>
              <BodyText family="var(--font-title)">Enabled for the team — connect your own</BodyText>
            </div>
            {accountConnectors.map(c => (
              <ConnectorRow
                key={c.slug}
                connector={c}
                status={c.linked ? 'connected' : 'not-connected'}
                onConnect={() => onConnect(c.slug)}
                onDisconnect={() => onDisconnect(c.slug)}
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

function CatalogCard({
  connectors,
  onConnect,
}: {
  connectors: ConnectorCatalogEntry[]
  onConnect:  (slug: string) => void
}) {
  const [category,    setCategory]    = useState<CategoryTab>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const q = searchQuery.toLowerCase().trim()
  const categoryFiltered = category === 'All' ? connectors : connectors.filter(c => CONNECTOR_CATEGORY_MAP[c.slug] === category)
  const visible = categoryFiltered.filter(c =>
    !q || c.display_name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  )

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
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      <div style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BodyText weight={500} color="var(--neutral-900)">Available to connect</BodyText>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {visible.map(c => (
            <ConnectorCatalogTile key={c.slug} connector={c} action="request" onAction={() => onConnect(c.slug)} />
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

// ── Scope badges (team/personal/accounts) ─────────────────────────────────────

interface ConnectorScope {
  teams?:        string[]
  personal?:     boolean
  accountCount?: number
}

function ScopeBadge({ label, variant }: { label: string; variant: 'team' | 'personal' | 'accounts' }) {
  const cfg = {
    team:     { bg: 'var(--blue-100, #cadcf1)',    border: 'rgba(13,110,178,0.5)',  text: 'var(--blue-700, #135487)' },
    personal: { bg: 'var(--green-50, #f7fee6)',    border: 'rgba(128,183,7,0.5)',   text: 'var(--green-800, #456211)' },
    accounts: { bg: 'var(--purple-100, #ded0df)',  border: 'rgba(103,79,104,0.5)',  text: 'var(--purple-700, #513853)' },
  }[variant]
  return (
    <span style={{
      display:         'inline-flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '2px 4px',
      borderRadius:    6,
      overflow:        'clip',
      position:        'relative',
      flexShrink:      0,
      backgroundColor: cfg.bg,
      boxShadow:       `0px 1px 1.5px rgba(0,0,0,0.15), 0px 0px 0px 1px ${cfg.border}`,
      fontFamily:      'var(--font-body)',
      fontWeight:      500,
      fontSize:        11,
      lineHeight:      '16px',
      color:           cfg.text,
      whiteSpace:      'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Connector catalog tile ─────────────────────────────────────────────────────

function ConnectorCatalogTile({
  connector,
  action,
  onAction,
  scope,
}: {
  connector: ConnectorCatalogEntry
  action:    'request' | 'manage' | 'add' | 'added'
  onAction?: () => void
  scope?:    ConnectorScope
}) {
  const isManage = action === 'manage'
  const category = connector.auth_mode === 'api_key' ? 'API Key' : 'OAuth'

  const scopeBadges: React.ReactNode[] = []
  if (scope?.teams) {
    scope.teams.forEach(team => scopeBadges.push(<ScopeBadge key={`team-${team}`} label={team} variant="team" />))
  }
  if (scope?.personal) {
    scopeBadges.push(<ScopeBadge key="personal" label="Personal" variant="personal" />)
  }
  if (scope?.accountCount != null && scope.accountCount > 0) {
    const n = scope.accountCount
    scopeBadges.push(<ScopeBadge key="accounts" label={`${n} ${n === 1 ? 'account' : 'accounts'}`} variant="accounts" />)
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding:         16,
        paddingBottom:   isManage ? 52 : 16,
        display:         'flex',
        flexDirection:   'column',
        gap:             12,
        minHeight:       isManage ? 190 : 170,
        position:        'relative',
      }}
    >
      {/* Header: icon + name/category + overflow menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 0 0' }}>
          <ConnectorIcon iconUrl={connector.icon_url} slug={connector.slug} />
          <TextBlock title={connector.display_name} subtitle={category} />
        </div>
        <IconButton variant="ghost" size="sm" aria-label={`${connector.display_name} options`} icon={<MoreVerticalIcon size={20} />} />
      </div>

      {/* Description — clamped for manage tiles */}
      <BodyText
        size={11}
        style={{
          flex:            '1 0 0',
          minHeight:       32,
          display:         '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
          whiteSpace:      'normal',
          wordBreak:       'normal',
        } as React.CSSProperties}
      >
        {connector.description}
      </BodyText>

      {/* Scope badges — rendered when scope data is available */}
      {isManage && scopeBadges.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scopeBadges}
        </div>
      )}

      {/* Action footer */}
      {isManage ? (
        <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
          <Button variant="outline" size="sm" onClick={onAction}>Manage</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: action === 'added' ? 'space-between' : 'flex-end', gap: 8, width: '100%' }}>
          {action === 'added' && (
            <>
              <Badge label="Available" color="Green" />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--neutral-700)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', whiteSpace: 'nowrap' }}>
                <CheckmarkCircleTwoIcon size={16} />
                Added
              </span>
            </>
          )}
          {action === 'add' && <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={onAction}>Add account</Button>}
          {action === 'request' && <Button variant="default" size="sm" onClick={onAction}>Request</Button>}
        </div>
      )}
    </div>
  )
}

function AdminManageConnectors({
  connectors,
  onConnect,
  onDisconnect,
  onManage,
}: {
  connectors:   ConnectorCatalogEntry[]
  onConnect:    (slug: string) => void
  onDisconnect: (slug: string) => void
  onManage?:    (entry: ConnectorCatalogEntry) => void
}) {
  const [category,    setCategory]    = useState<CategoryTab>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const q = searchQuery.toLowerCase().trim()
  const searchFiltered = connectors.filter(c =>
    !q || c.display_name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  )
  const linked   = searchFiltered.filter(c => c.linked)
  const unlinked = searchFiltered.filter(c => !c.linked)

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
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        </div>

        {linked.length > 0 && (
          <section style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BodyText weight={500} color="var(--neutral-900)">Connected</BodyText>
                <Badge label={`${linked.length} active`} color="Green" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {linked.map(c => (
                  <ConnectorCatalogTile key={c.slug} connector={c} action="manage" onAction={() => onManage?.(c)} />
                ))}
              </div>
            </div>
          </section>
        )}

        {unlinked.length > 0 && (
          <section style={{ padding: '12px 24px 12px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <BodyText weight={500} color="var(--neutral-900)">Available to connect</BodyText>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {unlinked.map(c => (
                <ConnectorCatalogTile key={c.slug} connector={c} action="add" onAction={() => onConnect(c.slug)} />
              ))}
            </div>
          </section>
        )}
      </PageCard>
    </div>
  )
}

function RequestReviewRow({
  req,
  onApprove,
  onDecline,
  onDismiss,
  onRequestSouvenir,
}: {
  req:                ConnectorRequest
  onApprove?:         (slug: string) => Promise<void>
  onDecline?:         (slug: string) => void
  onDismiss?:         (slug: string) => void
  onRequestSouvenir?: () => void
}) {
  const [approving, setApproving] = useState(false)

  async function handleApprove() {
    if (!onApprove) return
    setApproving(true)
    try {
      await onApprove(req.slug)
    } finally {
      setApproving(false)
    }
  }

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
      {req.available ? (
        <ConnectorIcon iconUrl={req.iconUrl} kind={req.slug as ConnectorKind} slug={req.slug} />
      ) : (
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
      )}
      <div style={{ minWidth: 0, flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BodyText weight={500} color="var(--neutral-900)">{req.name}</BodyText>
          <Badge label={req.available ? 'PENDING' : 'NOT AVAILABLE'} color={req.available ? 'Red' : 'Yellow'} />
        </div>
        <BodyText size={11}>
          Requested by{' '}
          <span style={{ color: 'black' }}>{req.requester}</span>{' '}
          · {req.daysAgo}
          {req.votes && (
            <> · also upvoted by <span style={{ color: 'black' }}>{req.votes}</span></>
          )}
        </BodyText>
        <BodyText size={11} color="var(--neutral-500)" family="var(--font-title)">&quot;{req.quote}&quot;</BodyText>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {req.available ? (
          <>
            <DangerOutlineButton onClick={() => onDecline?.(req.slug)}>Decline</DangerOutlineButton>
            <Button
              variant="default"
              size="sm"
              loading={approving}
              disabled={approving}
              onClick={() => void handleApprove()}
            >
              Approve &amp; connect
            </Button>
          </>
        ) : (
          <>
            <DangerOutlineButton onClick={() => onDismiss?.(req.slug)}>Dismiss</DangerOutlineButton>
            <Button
              variant="default"
              size="sm"
              rightIcon={<ArrowRightOneIcon size={16} />}
              onClick={onRequestSouvenir}
            >
              Request from Souvenir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function RequestQueue({
  orgName,
  isAdmin,
  onRequestSouvenir,
}: {
  orgName:           string
  isAdmin:           boolean
  onRequestSouvenir: () => void
}) {
  const [teamRequests,    setTeamRequests]    = useState<ConnectorRequest[]>(PENDING_FROM_TEAM)
  const [accountRequests, setAccountRequests] = useState<ConnectorRequest[]>(PENDING_YOUR_ACCOUNTS)

  const badgeLabel = orgName ? `${orgName} · ${isAdmin ? 'Admin' : 'Member'}` : (isAdmin ? 'Admin' : 'Member')

  async function handleApprove(slug: string) {
    try {
      const res = await initiateLink(slug)
      if (res.redirect_url) {
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (popup && !popup.closed) {
          popup.location.href = res.redirect_url
        } else {
          window.open(res.redirect_url, '_blank', 'noopener')
        }
        await pollConnectorUntilActive(slug)
        popup?.close()
        setTeamRequests(prev => prev.filter(r => r.slug !== slug))
        toast.success('Connector approved and connected')
      } else {
        setTeamRequests(prev => prev.filter(r => r.slug !== slug))
        toast.success('Connector approved and connected')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect connector')
    }
  }

  function handleDecline(slug: string) {
    setTeamRequests(prev => prev.filter(r => r.slug !== slug))
    toast.success('Request declined')
  }

  function handleDismiss(slug: string) {
    setAccountRequests(prev => prev.filter(r => r.slug !== slug))
  }

  return (
    <PageCard style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <BodyText weight={500} color="var(--neutral-900)">My connectors</BodyText>
          <BodyText>Integrations available to you in this workspace. Connect your own accounts where needed.</BodyText>
        </div>
        <Badge label={badgeLabel} color={isAdmin ? 'Yellow' : 'Blue'} />
      </div>

      <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {teamRequests.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <BodyText weight={500} color="var(--neutral-900)">From your team</BodyText>
              <BodyText>Available on Souvenir — approve to connect</BodyText>
            </div>
            {teamRequests.map(req => (
              <RequestReviewRow
                key={req.slug}
                req={req}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </section>
        )}

        {accountRequests.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <BodyText weight={500} color="var(--neutral-900)">Your accounts</BodyText>
              <BodyText>Enabled for the team — connect your own</BodyText>
            </div>
            {accountRequests.map(req => (
              <RequestReviewRow
                key={req.slug}
                req={req}
                onDismiss={handleDismiss}
                onRequestSouvenir={onRequestSouvenir}
              />
            ))}
          </section>
        )}

        {teamRequests.length === 0 && accountRequests.length === 0 && (
          <BodyText color="var(--neutral-400)" style={{ textAlign: 'center', padding: '24px 0' }}>
            No pending requests
          </BodyText>
        )}

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

function AdminCatalog({
  connectors,
  onConnect,
  onDisconnect,
  onManage,
  onRequestSouvenir,
}: {
  connectors:        ConnectorCatalogEntry[]
  onConnect:         (slug: string) => void
  onDisconnect:      (slug: string) => void
  onManage?:         (entry: ConnectorCatalogEntry) => void
  onRequestSouvenir: () => void
}) {
  const [category,    setCategory]    = useState<CategoryTab>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const q = searchQuery.toLowerCase().trim()
  const searchFiltered = connectors.filter(c =>
    !q || c.display_name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  )
  const filtered = category === 'All'
    ? searchFiltered
    : searchFiltered.filter(c => CONNECTOR_CATEGORY_MAP[c.slug] === category)

  const linked   = filtered.filter(c => c.linked)
  const unlinked = filtered.filter(c => !c.linked)

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
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      {linked.length > 0 && (
        <section style={{ borderBottom: '1px solid var(--neutral-100)', padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BodyText weight={500} color="var(--neutral-900)">Connected</BodyText>
            <Badge label={`${linked.length} active`} color="Green" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {linked.map(c => (
              <ConnectorCatalogTile key={c.slug} connector={c} action="manage" onAction={() => onManage?.(c)} />
            ))}
          </div>
        </section>
      )}

      {unlinked.length > 0 && (
        <section style={{ padding: '12px 24px 12px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <BodyText weight={500} color="var(--neutral-900)">Available to connect</BodyText>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {unlinked.map(c => (
              <ConnectorCatalogTile key={c.slug} connector={c} action="add" onAction={() => onConnect(c.slug)} />
            ))}
          </div>
        </section>
      )}

      <div style={{ padding: '0 24px 12px' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
            padding:         16,
            display:         'flex',
            alignItems:      'center',
            gap:             24,
          }}
        >
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
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
              <BodyText weight={500} color="var(--neutral-900)">
                Don&apos;t see what you need?
              </BodyText>
              <BodyText size={11} color="var(--neutral-500)" weight={500} style={{ whiteSpace: 'normal' }}>
                If your tool isn&apos;t in the catalog, request it directly from Souvenir. We&apos;ll scope the integration and notify your workspace when it ships.
              </BodyText>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={onRequestSouvenir}>
              Request from Souvenir
            </Button>
          </div>
        </div>
      </div>
    </PageCard>
  )
}

// ── Policy dropdown (for tool permissions in WorkspaceManageModal) ─────────────

type UIPolicy = 'Always allow' | 'Ask' | 'Never' | 'Allow once'

const UI_TO_API_POLICY: Record<UIPolicy, ConnectorTool['policy']> = {
  'Always allow': 'allow',
  'Ask':          'ask',
  'Never':        'block',
  'Allow once':   'allow_once',
}

const API_TO_UI_POLICY: Record<ConnectorTool['policy'], UIPolicy> = {
  allow:       'Always allow',
  ask:         'Ask',
  block:       'Never',
  allow_once:  'Allow once',
}

const POLICY_OPTIONS: UIPolicy[] = ['Always allow', 'Ask', 'Never', 'Allow once']

function PolicyDropdown({
  value,
  onChange,
  disabled,
}: {
  value:    UIPolicy
  onChange: (v: UIPolicy) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          gap:             6,
          padding:         '4px 10px',
          borderRadius:    8,
          border:          'none',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          opacity:         disabled ? 0.5 : 1,
          backgroundColor: 'white',
          boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        13,
          lineHeight:      '20px',
          color:           'var(--neutral-700)',
          whiteSpace:      'nowrap',
        }}
      >
        {value}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="var(--neutral-500)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop for dropdown */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position:        'absolute',
            right:           0,
            top:             'calc(100% + 4px)',
            backgroundColor: 'white',
            borderRadius:    10,
            boxShadow:       '0px 4px 16px 0px rgba(38,33,30,0.12), 0px 0px 0px 1px var(--neutral-100)',
            overflow:        'hidden',
            zIndex:          20,
            minWidth:        130,
          }}>
            {POLICY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display:         'flex',
                  width:           '100%',
                  padding:         '8px 12px',
                  border:          'none',
                  backgroundColor: opt === value ? 'var(--neutral-50)' : 'transparent',
                  cursor:          'pointer',
                  fontFamily:      'var(--font-body)',
                  fontWeight:      opt === value ? 500 : 400,
                  fontSize:        13,
                  lineHeight:      '20px',
                  color:           'var(--neutral-700)',
                  textAlign:       'left',
                  whiteSpace:      'nowrap',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Workspace manage modal ─────────────────────────────────────────────────────

function WorkspaceManageModal({
  entry,
  onClose,
  onUpdate,
  isAdmin,
}: {
  entry:    ConnectorCatalogEntry
  onClose:  () => void
  onUpdate: (updated: ConnectorCatalogEntry) => void
  isAdmin:  boolean
}) {
  const [tools,          setTools]          = useState<ConnectorTool[]>(entry.tools ?? [])
  const [saving,         setSaving]         = useState<string | null>(null)
  const [disconnecting,  setDisconnecting]  = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const abortedRef = useRef(false)
  useEffect(() => {
    abortedRef.current = false
    return () => { abortedRef.current = true }
  }, [])

  const handlePolicyChange = useCallback(async (toolSlug: string, uiPolicy: UIPolicy) => {
    if (abortedRef.current) return
    const apiPolicy = UI_TO_API_POLICY[uiPolicy]
    setTools(prev => prev.map(t => t.slug === toolSlug ? { ...t, policy: apiPolicy } : t))
    setSaving(toolSlug)
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard: check after async call
      const updated = await updateConnector(entry.slug, { permissions: [{ slug: toolSlug, policy: apiPolicy }] })
      if (abortedRef.current) return
      setTools(updated.tools ?? [])
      onUpdate(updated)
      toast.success('Permission updated')
    } catch (err) {
      if (abortedRef.current) return
      setTools(entry.tools ?? [])
      toast.error(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      if (!abortedRef.current) setSaving(null)
    }
  }, [entry, onUpdate])

  const handleDisconnect = useCallback(async () => {
    if (abortedRef.current) return
    setDisconnecting(true)
    try {
      // eslint-disable-next-line react-doctor/async-defer-await -- abort-guard: check after async call
      await unlinkConnector(entry.slug)
      if (abortedRef.current) return
      toast.success(`${entry.display_name} disconnected`)
      onUpdate({ ...entry, linked: false, tools: [] })
      onClose()
    } catch (err) {
      if (abortedRef.current) return
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
      setDisconnecting(false)
    }
  }, [entry, onUpdate, onClose])

  return (
    <>
      {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- backdrop overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(38,33,30,0.32)', zIndex: 50 }} />
      <div
        className="kaya-scrollbar"
        style={{
          position:        'fixed',
          top:             '50%',
          left:            '50%',
          transform:       'translate(-50%, -50%)',
          zIndex:          51,
          backgroundColor: 'white',
          borderRadius:    16,
          boxShadow:       '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
          width:           680,
          maxWidth:        'calc(100vw - 48px)',
          maxHeight:       'calc(100vh - 96px)',
          overflowY:       'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 24px 16px', borderBottom: '1px solid var(--neutral-100)' }}>
          <ConnectorIcon iconUrl={entry.icon_url} slug={entry.slug} />
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <BodyText size={14} weight={500} color="var(--neutral-900)">{entry.display_name}</BodyText>
            <span style={{
              display:         'inline-flex',
              alignItems:      'center',
              alignSelf:       'flex-start',
              padding:         '1px 6px',
              borderRadius:    6,
              backgroundColor: 'var(--green-50, #f7fee6)',
              boxShadow:       '0px 0px 0px 1px rgba(128,183,7,0.4)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        12,
              lineHeight:      '16px',
              color:           'var(--green-800, #456211)',
            }}>
              Connected
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', flexShrink: 0, color: 'var(--neutral-500)' }}
          >
            <CancelOneIcon size={18} />
          </button>
        </div>

        {/* Description */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <BodyText>{entry.description}</BodyText>
        </div>

        {/* Tool permissions */}
        {tools.length > 0 && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <BodyText size={14} weight={500} color="var(--neutral-900)" style={{ marginBottom: 4 }}>Tool permissions</BodyText>
            <BodyText size={11}>Choose when this connector can be used in chat and Brain.</BodyText>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
              {tools.map((tool, idx) => (
                <div key={tool.slug}>
                  {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <span style={{ flex: '1 0 0', minWidth: 0, fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.slug}
                    </span>
                    <PolicyDropdown
                      value={API_TO_UI_POLICY[tool.policy]}
                      onChange={v => void handlePolicyChange(tool.slug, v)}
                      disabled={saving === tool.slug}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disconnect (admin only) */}
        {isAdmin && (
          <div style={{ padding: '16px 24px' }}>
            {showDisconnect ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <BodyText color="var(--neutral-700)">
                  Disconnecting <strong>{entry.display_name}</strong> removes it from the workspace and disables it for all members. This cannot be undone without reconnecting.
                </BodyText>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button size="sm" variant="outline" disabled={disconnecting} onClick={() => setShowDisconnect(false)}>Cancel</Button>
                  <Button size="sm" variant="secondary" disabled={disconnecting} loading={disconnecting} onClick={() => void handleDisconnect()}>
                    <span style={{ color: 'var(--red-600, #DC2626)' }}>Yes, disconnect</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="sm" variant="secondary" disabled={disconnecting} onClick={() => setShowDisconnect(true)}>
                  <span style={{ color: 'var(--red-600, #DC2626)' }}>Disconnect connector</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
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
  const { org, currentUserRole } = useOrg()
  const isAdminView = currentUserRole === 'admin'
  const [tab,              setTab]              = useState<MainTab>('manage')
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [manageEntry,      setManageEntry]      = useState<ConnectorCatalogEntry | null>(null)
  const [connectors,       setConnectors]       = useState<ConnectorCatalogEntry[]>([])
  const [refreshToken,     setRefreshToken]     = useState(0)

  const activeTab: MainTab = isAdminView
    ? (tab === 'my' || tab === 'browse' ? 'manage' : tab)
    : (tab === 'manage' || tab === 'requests' || tab === 'catalog' ? 'my' : tab)

  useEffect(() => {
    listConnectors()
      .then(setConnectors)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load connectors'))
  }, [refreshToken])

  async function handleConnect(slug: string) {
    try {
      const res = await initiateLink(slug)
      if (res.redirect_url) {
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (popup && !popup.closed) {
          popup.location.href = res.redirect_url
        } else {
          window.open(res.redirect_url, '_blank', 'noopener')
        }
        await pollConnectorUntilActive(slug)
        popup?.close()
        setRefreshToken(t => t + 1)
      } else {
        setRefreshToken(t => t + 1)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  async function handleDisconnect(slug: string) {
    try {
      await unlinkConnector(slug)
      setRefreshToken(t => t + 1)
      toast.success('Connector disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: '0 0 2px' }}>
            Connectors
          </h1>
          <BodyText style={{ padding: '5px 6px' }}>
            Tools your workspace can use across chat, projects, agents, and Brain. Owner &amp; Admins manage these; members request what they need.
          </BodyText>
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
          {activeTab === 'manage' && (
            <AdminManageConnectors
              connectors={connectors}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onManage={(e) => setManageEntry(e)}
            />
          )}
          {activeTab === 'requests' && (
            <RequestQueue
              orgName={org.name}
              isAdmin={isAdminView}
              onRequestSouvenir={() => setRequestModalOpen(true)}
            />
          )}
          {activeTab === 'catalog' && (
            <AdminCatalog
              connectors={connectors}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onManage={(e) => setManageEntry(e)}
              onRequestSouvenir={() => setRequestModalOpen(true)}
            />
          )}
        </>
      ) : activeTab === 'my' ? (
        <MyConnectors
          onBrowse={() => setTab('browse')}
          connectors={connectors}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <NoticeCard />
          <CatalogCard
            connectors={connectors.filter(c => !c.linked)}
            onConnect={handleConnect}
          />
        </div>
      )}

      <RequestFromSouvenirDialog open={requestModalOpen} onOpenChange={setRequestModalOpen} />

      {manageEntry && manageEntry.linked && (
        <WorkspaceManageModal
          entry={manageEntry}
          onClose={() => setManageEntry(null)}
          onUpdate={(updated) => {
            setConnectors(prev => prev.map(c => c.slug === updated.slug ? updated : c))
            if (!updated.linked) setManageEntry(null)
          }}
          isAdmin={isAdminView}
        />
      )}
    </PageShell>
  )
}
