'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { springs } from '@/lib/springs'
import {
  ArrowDownOneIcon,
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  ArrowUpDownIcon,
  CancelOneIcon,
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Dropdown, DropdownFloat, type DropdownPlacement } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
  SettingsTableFooter,
} from '@/components/SettingsTable'
import { Switch } from '@/components/Switch'
import Tabs from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { useConnectorBrowse, CategoryFilter, Pagination } from '@/components/ConnectorBrowse'
import { connectorCategory } from '@/lib/connectorCategories'
import { useOrg } from '@/context/org-context'
import {
  DEFAULT_API_KEY_FIELD,
  fieldLabel,
  fieldPlaceholder,
  isSecretField,
  listConnectors,
  listOrgCatalog,
} from '@/lib/api/connectors'
import type { ApiKeyField, ConnectorAccount, ConnectorCatalogEntry } from '@/lib/api/connectors'
import {
  createOrgConnectorAccount,
  deleteOrgConnectorAccount,
  listOrgConnectorAccounts,
  listOrgConnectorRequests,
  pollOrgConnectorAccountUntilConnected,
  removeOrgConnectorRequest,
  requestOrgConnector,
  setOrgConnectorRequestStatus,
  updateOrgConnectorAccount,
} from '@/lib/api/org-connectors'
import type { AccountStatus, OrgConnectorAccount, OrgConnectorRequest, OrgConnectorRequestStatus } from '@/lib/api/org-connectors'
import { toConnector } from '@/lib/connector'
import { isMcpProviderConnector } from '@/lib/connectorProvider'

type MainTab = 'org-access' | 'shared-accounts'
type AccountStatusFilter = 'all' | 'active' | 'needs-attention'

const ADMIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'org-access', label: 'Org access' },
  { id: 'shared-accounts', label: 'Shared accounts' },
]

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 64,
        paddingBottom: 48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: 1088, maxWidth: '100%', padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 28 }}>
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
  size?: 11 | 12 | 14 | 16 | 20 | 24
  color?: string
  weight?: 400 | 500 | 600
  family?: string
  style?: React.CSSProperties
}) {
  const lineHeight = size === 24 ? '32px' : size === 20 ? '28px' : size === 11 ? '16px' : '22px'

  return (
    <p style={{ fontFamily: family, fontWeight: weight, fontSize: size, lineHeight, color, margin: 0, ...style }}>
      {children}
    </p>
  )
}

function PageCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        width: '100%',
        border: '1px solid var(--neutral-200)',
        borderRadius: 16,
        boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        overflow: 'hidden',
        backgroundColor: 'var(--neutral-50)',
        ...style,
      }}
    >
      {children}
    </section>
  )
}


function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div
      style={{
        height: 36,
        minWidth: 240,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        backgroundColor: 'white',
        borderRadius: 10,
        boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
      }}
    >
      <SearchOneIcon size={18} />
      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Search connectors"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          lineHeight: '20px',
          color: 'var(--neutral-900)',
        }}
      />
    </div>
  )
}

function ConnectorIcon({ connector }: { connector: Pick<ConnectorCatalogEntry, 'slug' | 'display_name'> & { logo_url?: string | null } }) {
  const src = toConnector(connector).logo
  const initials = connector.display_name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      style={{
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: 'white',
          boxShadow: '0px 0px 0px 1px var(--neutral-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          color: 'var(--neutral-700)',
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled brand asset with runtime slug path
          <img src={src} alt="" width={23} height={23} style={{ objectFit: 'contain' }} />
        ) : (
          initials || '?'
        )}
      </div>
    </div>
  )
}

function ConnectorTitle({ connector, subtitle }: { connector: ConnectorCatalogEntry; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <ConnectorIcon connector={connector} />
      <div style={{ minWidth: 0 }}>
        <BodyText weight={500} color="var(--neutral-900)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {connector.display_name}
        </BodyText>
        <BodyText size={11} color="var(--neutral-500)" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle ?? connectorCategory(connector.slug)}
        </BodyText>
      </div>
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: '34px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <BodyText weight={500} color="var(--neutral-700)">{title}</BodyText>
      {subtitle && <BodyText size={12} color="var(--neutral-400)">{subtitle}</BodyText>}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes catalogSpinnerRotate { to { transform: rotate(360deg) } }`}</style>
      <span
        style={{
          display:        'inline-block',
          width:          12,
          height:         12,
          borderRadius:   '50%',
          border:         '1.5px solid var(--neutral-200)',
          borderTopColor: 'var(--neutral-500)',
          animation:      'catalogSpinnerRotate 0.6s linear infinite',
          flexShrink:     0,
        }}
      />
    </>
  )
}

function SkeletonBlock({
  width = '100%',
  height,
  radius = 8,
}: {
  width?: number | string
  height: number
  radius?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius:    radius,
        flexShrink:      0,
        background:      'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
        backgroundSize:  '200% 100%',
        animation:       'connSkeletonShimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

function ConnectorsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <style>{`@keyframes connSkeletonShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      {/* Page header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={140} height={28} radius={8} />
          <SkeletonBlock width={340} height={14} radius={5} />
        </div>
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 4, padding: 4, borderRadius: 10, backgroundColor: 'rgba(247,242,237,0.5)', boxShadow: 'inset 0px -1px 0px rgba(255,255,255,0.9), inset 0px 1px 0px var(--neutral-100)' }}>
          <SkeletonBlock width={68}  height={34} radius={8} />
          <SkeletonBlock width={96}  height={34} radius={8} />
          <SkeletonBlock width={140} height={34} radius={8} />
        </div>
      </div>
      {/* Catalog card */}
      <PageCard>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock width={156} height={18} radius={6} />
            <SkeletonBlock width={260} height={13} radius={5} />
          </div>
          <SkeletonBlock width={200} height={36} radius={10} />
        </div>
        {[3, 2, 4, 3].map((teamCount, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={32} height={32} radius={8} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={110} height={14} radius={5} />
                    <SkeletonBlock width={72}  height={11} radius={4} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SkeletonBlock width={38} height={22} radius={11} />
                  <SkeletonBlock width={52} height={14} radius={5} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {Array.from({ length: teamCount }).map((_, j) => (
                  <SkeletonBlock key={j} height={50} radius={12} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </PageCard>
    </div>
  )
}

function statusBadge(status: OrgConnectorRequestStatus) {
  if (status === 'approved') return <Badge label="Approved" color="Green" />
  if (status === 'denied') return <Badge label="Denied" color="Red" />
  return <Badge label="Pending" color="Yellow" />
}

function accountBadge(account: { connected: boolean; status: AccountStatus }) {
  if (!account.connected) return <Badge label="Pending" color="Yellow" />
  if (account.status === 'active') return <Badge label="Active" color="Green" />
  if (account.status === 'disabled') return <Badge label="Disabled" color="Neutral" />
  return <Badge label="Expired" color="Red" />
}

// Shows at most 5 accounts before the menu scrolls — same "N visible, then
// overflow" idea as CONNECTOR_TEAMS_VISIBLE_MAX below, just sized per-row
// instead of a flat row height since a row is 38px with a subLabel (identifier
// line present) or 22px without.
const SHARED_ACCOUNTS_VISIBLE_MAX = 5

function sharedAccountRowHeight(account: ConnectorAccount): number {
  return account.account_label && account.account_identifier ? 38 : 22
}

// Height of the first N (capped) rows + inter-row gaps + Dropdown.Section's
// own 16px padding — used both to cap the menu at 5 visible rows and (in
// handlePrepareOpen below) to judge whether it'll need more room than is
// available on whichever side it would open toward.
function sharedAccountsMenuHeight(accounts: ConnectorAccount[]): number {
  const visible = accounts.slice(0, SHARED_ACCOUNTS_VISIBLE_MAX)
  const rows = visible.reduce((sum, a) => sum + sharedAccountRowHeight(a), 0) + 4 * Math.max(0, visible.length - 1)
  return rows + 16
}

// "Shared accounts" cell (Org access table) — a secondary button that opens a
// dropdown to its left listing every account shared with this connector, so
// the table row doesn't need to grow to fit account names inline. Flips
// between anchoring at the trigger's top (grows down) and its bottom (grows
// up) depending on which side actually has room, same idea as PersonaCard's
// ··· menu — computed fresh right before each open, not just once on mount.
function SharedAccountsCell({ accounts }: { accounts: ConnectorAccount[] }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<DropdownPlacement>('left-start')
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (accounts.length === 0) {
    return <BodyText size={14} color="var(--neutral-400)">—</BodyText>
  }

  function handlePrepareOpen() {
    if (open) return // closing — no need to recompute
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const needed      = sharedAccountsMenuHeight(accounts)
    setPlacement(spaceBelow < needed + 8 && spaceAbove > spaceBelow ? 'left-end' : 'left-start')
  }

  return (
    <DropdownFloat
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      offset={8}
      trigger={
        <Button
          ref={triggerRef}
          variant="secondary"
          size="sm"
          rightIcon={<ArrowDownOneIcon size={12} />}
          onClick={handlePrepareOpen}
        >
          {accounts.length} shared
        </Button>
      }
    >
      <Dropdown
        size="md"
        maxHeight={accounts.length > SHARED_ACCOUNTS_VISIBLE_MAX ? sharedAccountsMenuHeight(accounts) : false}
      >
        <Dropdown.Section fluid>
          {accounts.map(account => (
            <DropdownMenuItem
              key={account.id}
              fluid
              label={account.account_label || account.account_identifier || 'Untitled account'}
              subLabel={account.account_label && account.account_identifier ? account.account_identifier : undefined}
              badge={accountBadge(account)}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </DropdownFloat>
  )
}

const connectorEntrySlug = (entry: ConnectorCatalogEntry): string => entry.slug

function useConnectorSearch(connectors: ConnectorCatalogEntry[], initialSearch = '') {
  const [search, setSearch] = useState(initialSearch)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return connectors
    return connectors.filter(connector =>
      connector.display_name.toLowerCase().includes(q) || connector.slug.toLowerCase().includes(q),
    )
  }, [connectors, search])

  return { search, setSearch, filtered }
}

// ── Connector sort/filter (catalog listing) ───────────────────────────────────
// Sort direction and status filter are independent axes — "Z to A" + "Only
// OFF" is a valid combination, not a 5th mutually-exclusive option. Default is
// A to Z / All. Org-enabled connectors are always pinned above disabled ones
// when status is "All" (moot for "Only ON"/"Only OFF", since every visible
// row already shares one status there).

type ConnectorSortDirection = 'az' | 'za'
type ConnectorStatusFilter  = 'all' | 'on' | 'off'

const CONNECTOR_SORT_DIRECTIONS: { id: ConnectorSortDirection; label: string }[] = [
  { id: 'az', label: 'A to Z' },
  { id: 'za', label: 'Z to A' },
]

const CONNECTOR_STATUS_FILTERS: { id: ConnectorStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'on',  label: 'Enabled' },
  { id: 'off', label: 'Available' },
]

function sortConnectors(
  connectors: ConnectorCatalogEntry[],
  direction: ConnectorSortDirection,
  status: ConnectorStatusFilter,
  approvedSlugs: Set<string>,
): ConnectorCatalogEntry[] {
  const byName = (a: ConnectorCatalogEntry, b: ConnectorCatalogEntry) => a.display_name.localeCompare(b.display_name)
  const dir = direction === 'za' ? -1 : 1

  const scoped = status === 'on'
    ? connectors.filter(c => approvedSlugs.has(c.slug))
    : status === 'off'
    ? connectors.filter(c => !approvedSlugs.has(c.slug))
    : connectors

  if (status !== 'all') return [...scoped].sort((a, b) => byName(a, b) * dir)

  return [...scoped].sort((a, b) => {
    const aActive = approvedSlugs.has(a.slug)
    const bActive = approvedSlugs.has(b.slug)
    if (aActive !== bActive) return aActive ? -1 : 1
    return byName(a, b) * dir
  })
}

// Two separate text buttons — same Dropdown.Float/Dropdown/Dropdown.Section/
// Dropdown.Item pattern as Pinboard's own Sort and Filter dropdowns, but with
// the current selection shown as the button's label (rather than an icon-only
// trigger), so both are self-explanatory without a tooltip.
function ConnectorSortDirectionButton({
  value,
  onChange,
}: {
  value:    ConnectorSortDirection
  onChange: (next: ConnectorSortDirection) => void
}) {
  const [open, setOpen] = useState(false)
  const label = CONNECTOR_SORT_DIRECTIONS.find(option => option.id === value)?.label ?? 'Sort'

  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={4}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ArrowUpDownIcon size={16} />}
          rightIcon={<ArrowDownOneIcon size={12} />}
        >
          {label}
        </Button>
      }
    >
      <Dropdown>
        <Dropdown.Section fluid>
          {CONNECTOR_SORT_DIRECTIONS.map(option => (
            <Dropdown.Item
              key={option.id}
              fluid
              label={option.label}
              selected={option.id === value}
              icon={option.id === value ? <TickTwoIcon size={14} /> : undefined}
              onClick={() => { onChange(option.id); setOpen(false) }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

function ConnectorStatusFilterButton({
  value,
  onChange,
}: {
  value:    ConnectorStatusFilter
  onChange: (next: ConnectorStatusFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const label = CONNECTOR_STATUS_FILTERS.find(option => option.id === value)?.label ?? 'Status'

  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={4}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FilterMailIcon size={16} />}
          rightIcon={<ArrowDownOneIcon size={12} />}
        >
          {label}
        </Button>
      }
    >
      <Dropdown>
        <Dropdown.Section fluid>
          {CONNECTOR_STATUS_FILTERS.map(option => (
            <Dropdown.Item
              key={option.id}
              fluid
              label={option.label}
              selected={option.id === value}
              icon={option.id === value ? <TickTwoIcon size={14} /> : undefined}
              onClick={() => { onChange(option.id); setOpen(false) }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

const CONNECTOR_COLUMNS = 'minmax(240px, 1.4fr) 150px 140px 150px'

function OrgAccessTab({
  orgId,
  connectors,
  requests,
  initialSearch,
  onRequestsChanged,
}: {
  orgId: string
  connectors: ConnectorCatalogEntry[]
  requests: OrgConnectorRequest[]
  initialSearch: string
  onRequestsChanged: (requests: OrgConnectorRequest[]) => void
}) {
  const requestBySlug = useMemo(
    () => Object.fromEntries(requests.map(r => [r.connectorSlug, r])),
    [requests],
  )
  const approvedSlugs = useMemo(
    () => requests.reduce((slugs, r) => {
      if (r.status === 'approved') slugs.add(r.connectorSlug)
      return slugs
    }, new Set<string>()),
    [requests],
  )

  const { search, setSearch, filtered } = useConnectorSearch(connectors, initialSearch)
  const [sortDirection, setSortDirection] = useState<ConnectorSortDirection>('az')
  const [statusFilter, setStatusFilter] = useState<ConnectorStatusFilter>('all')
  const [viewMode, setViewMode] = useState<ConnectorViewMode>('list')
  const sorted = useMemo(
    () => sortConnectors(filtered, sortDirection, statusFilter, approvedSlugs),
    [filtered, sortDirection, statusFilter, approvedSlugs],
  )
  const browse = useConnectorBrowse(sorted, connectorEntrySlug, { resetKey: `${search}::${sortDirection}::${statusFilter}` })
  const [busyOrgSlug, setBusyOrgSlug] = useState<string | null>(null)
  const [pendingDisable, setPendingDisable] = useState<ConnectorCatalogEntry | null>(null)

  // Enabled/available are split from the full, category+search+sort-filtered
  // list (browse.filteredItems), NOT the paginated browse.pageItems — otherwise
  // pagination chops the mixed enabled/disabled list arbitrarily, so only
  // whichever enabled connectors happen to land on the current page show up
  // together instead of all of them. Enabled always shows in full; only
  // "available" (disabled) paginates, on its own page counter.
  const [availablePage, setAvailablePage] = useState(1)
  const enabledItems = statusFilter === 'all' ? browse.filteredItems.filter(c => approvedSlugs.has(c.slug)) : []
  const availableAllItems = statusFilter === 'all' ? browse.filteredItems.filter(c => !approvedSlugs.has(c.slug)) : []
  const availablePageCount = Math.max(1, Math.ceil(availableAllItems.length / browse.pageSize))
  const safeAvailablePage = Math.min(availablePage, availablePageCount)
  const availableItems = availableAllItems.slice(
    (safeAvailablePage - 1) * browse.pageSize,
    safeAvailablePage * browse.pageSize,
  )
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors useConnectorBrowse's own reset-page-on-context-change behavior
  useEffect(() => { setAvailablePage(1) }, [browse.category, search, sortDirection, statusFilter])

  function replaceRequest(next: OrgConnectorRequest | null, slug: string) {
    const withoutSlug = requests.filter(r => r.connectorSlug !== slug)
    onRequestsChanged(next ? [...withoutSlug, next] : withoutSlug)
  }

  // Turning a connector on requests it — auto-approved immediately since this
  // tab is admin-only. Turning it off removes the request/approval entirely.
  async function handleOrgToggle(connector: ConnectorCatalogEntry, checked: boolean) {
    setBusyOrgSlug(connector.slug)
    try {
      if (checked) {
        const next = await requestOrgConnector(orgId, connector.slug)
        replaceRequest(next, connector.slug)
      } else {
        await removeOrgConnectorRequest(orgId, connector.slug)
        replaceRequest(null, connector.slug)
      }
      toast.success(`${connector.display_name} ${checked ? 'enabled' : 'disabled'} for the organization`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update connector access')
    } finally {
      setBusyOrgSlug(null)
    }
  }

  async function handleApprove(connector: ConnectorCatalogEntry) {
    setBusyOrgSlug(connector.slug)
    try {
      const next = await setOrgConnectorRequestStatus(orgId, connector.slug, 'approved')
      replaceRequest(next, connector.slug)
      toast.success(`${connector.display_name} approved for the organization`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve connector')
    } finally {
      setBusyOrgSlug(null)
    }
  }

  async function handleDeny(connector: ConnectorCatalogEntry) {
    setBusyOrgSlug(connector.slug)
    try {
      const next = await setOrgConnectorRequestStatus(orgId, connector.slug, 'denied')
      replaceRequest(next, connector.slug)
      toast.success(`${connector.display_name} denied`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deny connector')
    } finally {
      setBusyOrgSlug(null)
    }
  }

  function handleSwitchChange(connector: ConnectorCatalogEntry, checked: boolean) {
    const accountCount = connector.accounts?.length ?? 0
    if (!checked && accountCount > 0) {
      setPendingDisable(connector)
      return
    }
    void handleOrgToggle(connector, checked)
  }

  async function confirmDisable() {
    if (!pendingDisable) return
    await handleOrgToggle(pendingDisable, false)
    setPendingDisable(null)
  }

  // Staggered fade+slide-in on mount — replays on load and on list/grid switch
  // (rows/cards below are keyed on `${slug}-${viewMode}`, so toggling view
  // forces a fresh mount). Capped so a long page doesn't produce a slow tail.
  function enterTransition(index: number) {
    return { ...springs.moderate, delay: Math.min(index, 10) * 0.03 }
  }

  // A connector with a pending member request shows an approve/deny pair
  // instead of the plain toggle — an admin flipping their own switch always
  // auto-approves, so the pending state only ever comes from someone else.
  function connectorActions(connector: ConnectorCatalogEntry) {
    const request = requestBySlug[connector.slug]
    const busy = busyOrgSlug === connector.slug
    if (request?.status === 'pending') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BodyText size={11} color="var(--neutral-500)">
            {request.requestedByName ?? request.requestedByEmail ?? 'A member'} requested
          </BodyText>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleDeny(connector)}>Deny</Button>
          <Button variant="default" size="sm" disabled={busy} loading={busy} onClick={() => void handleApprove(connector)}>Approve</Button>
        </div>
      )
    }
    const approved = approvedSlugs.has(connector.slug)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {busy && <Spinner />}
        <BodyText size={12} color="var(--neutral-700)" style={{ width: 52, textAlign: 'right' }}>
          {approved ? 'Org ON' : 'Org OFF'}
        </BodyText>
        <Switch
          checked={approved}
          disabled={busy}
          onCheckedChange={checked => handleSwitchChange(connector, checked)}
        />
      </div>
    )
  }

  function renderConnectorRow(connector: ConnectorCatalogEntry, index: number) {
    return (
      <motion.div
        key={`${connector.slug}-${viewMode}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition(index)}
      >
        <SettingsTableRow minHeight={72}>
          <SettingsTableCell>
            <ConnectorTitle connector={connector} />
          </SettingsTableCell>
          <SettingsTableCell>
            <BodyText size={14} color="var(--neutral-500)">{connectorCategory(connector.slug)}</BodyText>
          </SettingsTableCell>
          <SettingsTableCell>
            <SharedAccountsCell accounts={connector.accounts ?? []} />
          </SettingsTableCell>
          <SettingsTableCell align="end">
            {connectorActions(connector)}
          </SettingsTableCell>
        </SettingsTableRow>
      </motion.div>
    )
  }

  function renderConnectorCard(connector: ConnectorCatalogEntry, index: number) {
    const accountCount = connector.accounts?.length ?? 0
    return (
      <motion.div
        key={`${connector.slug}-${viewMode}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition(index)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             12,
          padding:         16,
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        }}
      >
        <ConnectorTitle connector={connector} />
        {accountCount > 0 ? (
          <BodyText size={12} color="var(--neutral-500)">{accountCount} shared account{accountCount === 1 ? '' : 's'}</BodyText>
        ) : (
          <BodyText size={12} color="var(--neutral-400)">No shared accounts</BodyText>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {connectorActions(connector)}
        </div>
      </motion.div>
    )
  }

  const isEmpty = statusFilter === 'all'
    ? enabledItems.length === 0 && availableAllItems.length === 0
    : browse.pageItems.length === 0
  const emptyMessage = connectors.length === 0 ? 'No connectors available' : 'No connectors match your filters'
  const paginationProps = statusFilter === 'all'
    ? { page: safeAvailablePage, pageCount: availablePageCount, onChange: setAvailablePage }
    : { page: browse.page, pageCount: browse.pageCount, onChange: browse.setPage }

  return (
    <SettingsTable columns={CONNECTOR_COLUMNS} columnGap={24}>
      <SettingsTableToolbar title="Org access" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ width: 220, maxWidth: '100%', flexShrink: 1 }}>
            <InputField
              label="Search connectors"
              showLabel={false}
              showSubtitle={false}
              size="small"
              fluid
              leftIcon={<SearchOneIcon size={16} />}
              placeholder="Search connectors"
              value={search}
              onChange={setSearch}
            />
          </div>
          <ConnectorSortDirectionButton value={sortDirection} onChange={setSortDirection} />
          <ConnectorStatusFilterButton value={statusFilter} onChange={setStatusFilter} />
          <ConnectorViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </SettingsTableToolbar>

      <div style={{ padding: '0 24px 12px' }}>
        <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
      </div>

      {viewMode === 'list' ? (
        <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
          <div role="table" aria-label="Org access" style={{ minWidth: 760 }}>
            <SettingsTableHeader>
              <SettingsTableHeaderCell>Connector</SettingsTableHeaderCell>
              <SettingsTableHeaderCell>Category</SettingsTableHeaderCell>
              <SettingsTableHeaderCell>Shared accounts</SettingsTableHeaderCell>
              <SettingsTableHeaderCell align="end">Organization</SettingsTableHeaderCell>
            </SettingsTableHeader>

            {isEmpty ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                  {emptyMessage}
                </p>
              </div>
            ) : statusFilter === 'all' ? (
              <>
                {enabledItems.length > 0 && (
                  <>
                    <ConnectorSectionLabel label="Enabled" />
                    {enabledItems.map(renderConnectorRow)}
                  </>
                )}
                {availableItems.length > 0 && (
                  <>
                    <ConnectorSectionLabel label="Available" />
                    {availableItems.map(renderConnectorRow)}
                  </>
                )}
              </>
            ) : browse.pageItems.map(renderConnectorRow)}

            <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <BodyText size={12} color="var(--neutral-500)">
                {browse.total} connector{browse.total === 1 ? '' : 's'}
              </BodyText>
              <Pagination {...paginationProps} />
            </SettingsTableFooter>
          </div>
        </div>
      ) : isEmpty ? (
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 24px 16px' }}>
          {statusFilter === 'all' ? (
            <>
              {enabledItems.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ margin: '0 -24px' }}><ConnectorSectionLabel label="Enabled" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                    {enabledItems.map(renderConnectorCard)}
                  </div>
                </div>
              )}
              {availableItems.length > 0 && (
                <div>
                  <div style={{ margin: '0 -24px' }}><ConnectorSectionLabel label="Available" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                    {availableItems.map(renderConnectorCard)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {browse.pageItems.map(renderConnectorCard)}
            </div>
          )}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <BodyText size={12} color="var(--neutral-500)">
              {browse.total} connector{browse.total === 1 ? '' : 's'}
            </BodyText>
            <Pagination {...paginationProps} />
          </div>
        </div>
      )}

      {pendingDisable && (
        <DisableConnectorConfirmModal
          connector={pendingDisable}
          busy={busyOrgSlug === pendingDisable.slug}
          onCancel={() => setPendingDisable(null)}
          onConfirm={() => void confirmDisable()}
        />
      )}
    </SettingsTable>
  )
}

function ConnectorSectionLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '10px 24px', backgroundColor: 'var(--neutral-25, #fafaf9)', borderBottom: '1px solid var(--neutral-100)' }}>
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', color: 'var(--neutral-500)', margin: 0 }}>
        {label}
      </p>
    </div>
  )
}

// ── Grid / list view toggle ───────────────────────────────────────────────────

type ConnectorViewMode = 'grid' | 'list'

function GridViewGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ListViewGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3"    width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="6.9"  width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="10.8" width="12" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  )
}

function ConnectorViewToggle({ value, onChange }: { value: ConnectorViewMode; onChange: (v: ConnectorViewMode) => void }) {
  return (
    <Tabs value={value} onValueChange={v => onChange(v as ConnectorViewMode)}>
      <Tabs.List size="small" collapse pillTopInset={0.5} pillBottomInset={1}>
        <Tooltip content="Grid view" side="top">
          <Tabs.Trigger value="grid" icon={<GridViewGlyph />}>Grid</Tabs.Trigger>
        </Tooltip>
        <Tooltip content="List view" side="top">
          <Tabs.Trigger value="list" icon={<ListViewGlyph />}>List</Tabs.Trigger>
        </Tooltip>
      </Tabs.List>
    </Tabs>
  )
}

function DisableConnectorConfirmModal({
  connector,
  busy,
  onCancel,
  onConfirm,
}: {
  connector: ConnectorCatalogEntry
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const accountCount = connector.accounts?.length ?? 0
  return (
    <>
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, border: 'none', padding: 0, backgroundColor: 'rgba(18,12,8,0.38)', zIndex: 50, cursor: 'default' }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 51,
          width: 420,
          maxWidth: 'calc(100vw - 48px)',
          borderRadius: 20,
          backgroundColor: '#f7f2ed',
          boxShadow: '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1), 0px 0px 0px 1px var(--neutral-100)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            Turn off {connector.display_name}?
          </h2>
          <BodyText style={{ marginTop: 8 }}>
            {accountCount} shared account{accountCount === 1 ? '' : 's'} will stop working for the organization.
          </BodyText>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={busy}>Turn off</Button>
        </div>
      </div>
    </>
  )
}

function ConnectorCard({
  connector,
  approved,
  onManage,
}: {
  connector: ConnectorCatalogEntry
  approved: boolean
  onManage: (connector: ConnectorCatalogEntry) => void
}) {
  const accounts = connector.accounts ?? []
  const activeAccounts = accounts.filter(account => account.connected && account.status === 'active')

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)',
        padding: 16,
        minHeight: 176,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <ConnectorTitle connector={connector} />
      <BodyText
        size={11}
        style={{
          flex: 1,
          minHeight: 34,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'normal',
        } as React.CSSProperties}
      >
        {connector.description || 'No description available.'}
      </BodyText>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={approved ? 'Org on' : 'Org off'} color={approved ? 'Green' : 'Neutral'} />
          <Badge label={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`} color="Purple" />
          <Badge label={`${activeAccounts.length} active`} color={activeAccounts.length ? 'Green' : 'Neutral'} />
        </div>
        <Button variant="outline" size="sm" rightIcon={<ArrowRightOneIcon size={16} />} onClick={() => onManage(connector)}>
          Manage
        </Button>
      </div>
    </div>
  )
}

function ManageConnectorsTab({
  connectors,
  requests,
  initialSearch,
  onManage,
}: {
  connectors: ConnectorCatalogEntry[]
  requests: OrgConnectorRequest[]
  initialSearch: string
  onManage: (connector: ConnectorCatalogEntry) => void
}) {
  const approvedSlugs = useMemo(
    () => requests.reduce((slugs, r) => {
      if (r.status === 'approved') slugs.add(r.connectorSlug)
      return slugs
    }, new Set<string>()),
    [requests],
  )
  const orgEnabled = useMemo(() => connectors.filter(connector => approvedSlugs.has(connector.slug)), [connectors, approvedSlugs])
  const { search, setSearch, filtered } = useConnectorSearch(orgEnabled, initialSearch)
  const browse = useConnectorBrowse(filtered, connectorEntrySlug, { resetKey: search })

  return (
    <PageCard>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <BodyText size={16} weight={500} color="var(--neutral-900)">Manage shared connector accounts</BodyText>
          <BodyText size={12}>Create org-owned accounts and share them with teams.</BodyText>
        </div>
        <SearchBar value={search} onChange={setSearch} />
      </div>
      {orgEnabled.length > 0 && (
        <div style={{ padding: '14px 24px 0' }}>
          <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
        </div>
      )}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {orgEnabled.length === 0 ? (
          <EmptyState title="No connectors enabled yet" subtitle="Turn on connectors in the Org access tab to manage shared accounts for them." />
        ) : browse.pageItems.length === 0 ? (
          <EmptyState title="No connectors found" subtitle="Try a different search or category." />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {browse.pageItems.map(connector => (
                <ConnectorCard key={connector.slug} connector={connector} approved={approvedSlugs.has(connector.slug)} onManage={onManage} />
              ))}
            </div>
            <Pagination page={browse.page} pageCount={browse.pageCount} onChange={browse.setPage} />
          </>
        )}
      </div>
    </PageCard>
  )
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          border: 'none',
          padding: 0,
          backgroundColor: 'rgba(18,12,8,0.38)',
          zIndex: 50,
          cursor: 'default',
        }}
      />
      <div
        className="kaya-scrollbar"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 51,
          width: 720,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          borderRadius: 20,
          backgroundColor: '#f7f2ed',
          boxShadow: '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1), 0px 0px 0px 1px var(--neutral-100)',
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {/* Horizontal padding absorbed here (16 + the 8 that used to be on the
            scrolling element above) — keeps the scrollbar flush with the
            modal's edge instead of inset by it. */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 12px 20px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {title}
              </h2>
              {subtitle && <BodyText style={{ marginTop: 4 }}>{subtitle}</BodyText>}
            </div>
            <IconButton variant="ghost" size="sm" aria-label="Close" icon={<CancelOneIcon size={20} />} onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
    </>
  )
}

function credentialFields(connector: ConnectorCatalogEntry): ApiKeyField[] {
  if (connector.api_key_fields && connector.api_key_fields.length > 0) return connector.api_key_fields
  return connector.auth_mode === 'api_key' ? [DEFAULT_API_KEY_FIELD] : []
}

function AddSharedAccountModal({
  connector,
  orgId,
  onClose,
  onCreated,
}: {
  connector: ConnectorCatalogEntry
  orgId: string
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const fields = credentialFields(connector)
  const [label, setLabel] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const canSubmit = label.trim().length > 0 && fields.every(field => !field.required || values[field.name]?.trim())

  async function handleSubmit() {
    if (!canSubmit) return
    setBusy(true)
    try {
      const fieldPayload = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()))
      const res = await createOrgConnectorAccount(orgId, connector.slug, {
        accountLabel: label.trim(),
        accountIdentifier: identifier.trim() || undefined,
        initData: connector.auth_mode === 'oauth2' ? fieldPayload : undefined,
      })

      if (connector.auth_mode === 'api_key') {
        const accounts = await listOrgConnectorAccounts(orgId, connector.slug)
        const created = accounts.find(account => account.id === res.sharedAccountId)
        await updateOrgConnectorAccount(orgId, res.sharedAccountId, {
          credentials: fieldPayload,
          expectedVersion: created?.version,
        })
      }

      if (res.redirectUrl) {
        // Native MCP connectors: the backend's OAuth callback redirects back
        // to our own app domain on success/failure, so this must navigate
        // the current tab rather than a popup (a popup would just land our
        // app inside the small popup window).
        if (isMcpProviderConnector(connector.slug)) {
          window.location.href = res.redirectUrl
          return
        }
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (popup && !popup.closed) popup.location.href = res.redirectUrl
        else window.open(res.redirectUrl, '_blank', 'noopener')
        setPolling(true)
        try {
          await pollOrgConnectorAccountUntilConnected(orgId, connector.slug, res.sharedAccountId)
          popup?.close()
        } catch {
          popup?.close()
          toast.warning('OAuth flow timed out. The account was created; refresh the account list after finishing auth.')
          return
        } finally {
          setPolling(false)
        }
      }

      toast.success('Shared account created')
      await onCreated()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create shared account')
    } finally {
      setBusy(false)
      setPolling(false)
    }
  }

  return (
    <ModalShell
      title={`Add ${connector.display_name} account`}
      subtitle="Create an org-owned account, visible to the whole organization."
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageCard style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <InputField fluid label="Account label" placeholder="Support inbox" value={label} onChange={setLabel} />
            <InputField fluid label="Account identifier" placeholder="support@example.com" value={identifier} onChange={setIdentifier} />
          </div>
        </PageCard>

        {fields.length > 0 && (
          <PageCard style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <BodyText weight={500} color="var(--neutral-900)">
                  {connector.auth_mode === 'oauth2' ? 'OAuth setup fields' : 'Credentials'}
                </BodyText>
                <BodyText size={12}>
                  {connector.auth_mode === 'oauth2'
                    ? 'These values are sent to the hosted OAuth flow.'
                    : 'Credentials are saved on the shared org account.'}
                </BodyText>
              </div>
              {fields.map(field => (
                <InputField
                  key={field.name}
                  fluid
                  type={field.secret || isSecretField(field.name) ? 'password' : 'text'}
                  label={field.label || fieldLabel(field.name)}
                  placeholder={field.help || fieldPlaceholder(field.name)}
                  value={values[field.name] ?? ''}
                  onChange={value => setValues(prev => ({ ...prev, [field.name]: value }))}
                />
              ))}
            </div>
          </PageCard>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="default"
            disabled={!canSubmit || busy}
            loading={busy}
            rightIcon={!busy ? <ArrowRightOneIcon size={16} /> : undefined}
            onClick={() => void handleSubmit()}
          >
            {polling ? 'Waiting for auth...' : connector.auth_mode === 'oauth2' ? 'Start shared OAuth' : 'Create shared account'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

function AccountDetailView({
  account,
  connector,
  orgId,
  onBack,
  onChanged,
}: {
  account: OrgConnectorAccount
  connector: ConnectorCatalogEntry
  orgId: string
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const [label, setLabel] = useState(account.accountLabel)
  const [version, setVersion] = useState(account.version)
  const [status, setStatus] = useState(account.status)
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function saveLabel() {
    setSaving('label')
    try {
      const updated = await updateOrgConnectorAccount(orgId, account.id, {
        accountLabel: label,
        expectedVersion: version,
      })
      setVersion(updated.version)
      toast.success('Account label updated')
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update label')
    } finally {
      setSaving(null)
    }
  }

  async function toggleStatus(checked: boolean) {
    const nextStatus = checked ? 'active' : 'disabled'
    setSaving('status')
    setStatus(nextStatus)
    try {
      const updated = await updateOrgConnectorAccount(orgId, account.id, {
        status: nextStatus,
        expectedVersion: version,
      })
      setVersion(updated.version)
      toast.success(`Account ${checked ? 'enabled' : 'disabled'}`)
      await onChanged()
    } catch (error) {
      setStatus(account.status)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete() {
    if (confirmText !== account.accountLabel) return
    setSaving('delete')
    try {
      await deleteOrgConnectorAccount(orgId, account.id)
      toast.success('Shared account deleted')
      await onChanged()
      onBack()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <button
            type="button"
            onClick={onBack}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px' }}
          >
            Back to {connector.display_name} accounts
          </button>
          <div style={{ marginTop: 8 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0 }}>
              {account.accountLabel}
            </h1>
            <BodyText>{`${connector.display_name}${account.accountIdentifier ? ` · ${account.accountIdentifier}` : ''}`}</BodyText>
          </div>
        </div>

        <PageCard style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Account status</BodyText>
              <BodyText size={12}>Disabled or expired accounts stop working for the organization.</BodyText>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {accountBadge({ ...account, status })}
              <Switch checked={status === 'active'} disabled={saving === 'status'} onCheckedChange={checked => void toggleStatus(checked)} />
            </div>
          </div>
        </PageCard>

        <PageCard style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <InputField fluid label="Account label" value={label} onChange={setLabel} />
            </div>
            <Button variant="outline" size="sm" disabled={saving === 'label' || label === account.accountLabel} loading={saving === 'label'} onClick={() => void saveLabel()}>
              Save
            </Button>
          </div>
        </PageCard>

        <PageCard style={{ padding: 16, borderColor: 'var(--red-300, #fca5a5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <InputField
                fluid
                label="Delete shared account"
                placeholder={`Type "${account.accountLabel}" to confirm`}
                value={confirmText}
                onChange={setConfirmText}
              />
            </div>
            <Button
              variant="danger"
              size="sm"
              disabled={confirmText !== account.accountLabel || saving === 'delete'}
              loading={saving === 'delete'}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          </div>
        </PageCard>
      </div>
    </PageShell>
  )
}

function ConnectorDetailView({
  connector,
  orgId,
  onBack,
  onChanged,
}: {
  connector: ConnectorCatalogEntry
  orgId: string
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const [accounts, setAccounts] = useState<OrgConnectorAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [activeAccount, setActiveAccount] = useState<OrgConnectorAccount | null>(null)
  const [filter, setFilter] = useState<AccountStatusFilter>('all')

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listOrgConnectorAccounts(orgId, connector.slug)
      setAccounts(list)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }, [orgId, connector.slug])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAccounts() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAccounts])

  async function refreshAll() {
    await loadAccounts()
    await onChanged()
  }

  const visibleAccounts = accounts.filter(account => {
    if (filter === 'active') return account.connected && account.status === 'active'
    if (filter === 'needs-attention') return !account.connected || account.status !== 'active'
    return true
  })

  if (activeAccount) {
    return (
      <AccountDetailView
        account={activeAccount}
        connector={connector}
        orgId={orgId}
        onBack={() => setActiveAccount(null)}
        onChanged={async () => {
          await refreshAll()
          const latest = (await listOrgConnectorAccounts(orgId, connector.slug)).find(account => account.id === activeAccount.id)
          if (latest) setActiveAccount(latest)
        }}
      />
    )
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--neutral-500)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              lineHeight: '18px',
            }}
          >
            <ArrowLeftOneIcon size={14} />
            Back to manage connectors
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <ConnectorIcon connector={connector} />
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: 0 }}>
                {connector.display_name}
              </h1>
              <BodyText>{connector.description || 'Manage shared accounts for this connector.'}</BodyText>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Tabs value={filter} onValueChange={v => setFilter(v as AccountStatusFilter)}>
            <Tabs.List>
              <Tabs.Trigger value="all">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  All
                  <Badge label={`${accounts.length}`} color="Blue" />
                </span>
              </Tabs.Trigger>
              <Tabs.Trigger value="active">Active</Tabs.Trigger>
              <Tabs.Trigger value="needs-attention">Needs attention</Tabs.Trigger>
            </Tabs.List>
          </Tabs>
          <Button variant="default" size="sm" leftIcon={<PlusSignIcon size={16} />} onClick={() => setAddOpen(true)}>
            Add shared account
          </Button>
        </div>

        <PageCard>
          {loading ? (
            <EmptyState title="Loading accounts..." />
          ) : visibleAccounts.length === 0 ? (
            <EmptyState title="No shared accounts" subtitle="Create an org shared account for members to use." />
          ) : (
            visibleAccounts.map((account, index) => (
              <div key={account.id}>
                {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, backgroundColor: 'white' }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <BodyText weight={500} color="var(--neutral-900)">{account.accountLabel}</BodyText>
                      {accountBadge(account)}
                    </div>
                    <BodyText size={11}>
                      {account.accountIdentifier || 'No provider identity yet'}
                    </BodyText>
                  </div>
                  <Button variant="outline" size="sm" rightIcon={<ArrowRightOneIcon size={16} />} onClick={() => setActiveAccount(account)}>
                    Manage
                  </Button>
                </div>
              </div>
            ))
          )}
        </PageCard>
      </div>

      {addOpen && (
        <AddSharedAccountModal
          connector={connector}
          orgId={orgId}
          onClose={() => setAddOpen(false)}
          onCreated={refreshAll}
        />
      )}
    </PageShell>
  )
}

function MemberBrowseView({
  orgId,
  connectors,
  requests,
  initialSearch,
  onRequested,
}: {
  orgId: string
  connectors: ConnectorCatalogEntry[]
  requests: OrgConnectorRequest[]
  initialSearch: string
  onRequested: () => void
}) {
  const { search, setSearch, filtered } = useConnectorSearch(connectors, initialSearch)
  const browse = useConnectorBrowse(filtered, connectorEntrySlug, { resetKey: search })
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const requestBySlug = useMemo(
    () => Object.fromEntries(requests.map(r => [r.connectorSlug, r])),
    [requests],
  )

  async function requestAccess(connector: ConnectorCatalogEntry) {
    setBusySlug(connector.slug)
    try {
      await requestOrgConnector(orgId, connector.slug, 'Requested from the connectors page.')
      toast.success('Request sent to your organization admin')
      onRequested()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <PageCard>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <BodyText size={16} weight={500} color="var(--neutral-900)">Browse and request connectors</BodyText>
          <BodyText size={12}>Request a connector — an admin approves it for the organization.</BodyText>
        </div>
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div style={{ padding: '14px 24px 0' }}>
        <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
      </div>

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {browse.pageItems.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState title="No connectors found" subtitle="Try a different search or category." />
          </div>
        ) : browse.pageItems.map(connector => {
          const request = requestBySlug[connector.slug]
          return (
            <div key={connector.slug} style={{ backgroundColor: 'white', borderRadius: 16, boxShadow: '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ConnectorTitle connector={connector} />
              <BodyText size={11} style={{ minHeight: 34 }}>{connector.description || 'No description available.'}</BodyText>
              {request && statusBadge(request.status)}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="default"
                  size="sm"
                  disabled={busySlug === connector.slug || request?.status === 'approved' || request?.status === 'pending'}
                  loading={busySlug === connector.slug}
                  onClick={() => void requestAccess(connector)}
                >
                  {request?.status === 'approved' ? 'Approved' : request?.status === 'pending' ? 'Pending' : 'Request access'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '0 24px 20px' }}>
        <Pagination page={browse.page} pageCount={browse.pageCount} onChange={browse.setPage} />
      </div>
    </PageCard>
  )
}


function OrgConnectorsPageContent() {
  const { org, orgReady, currentUserRole } = useOrg()
  const router = useRouter()
  const params = useSearchParams()
  const initialSearch = params.get('q') ?? ''
  const isAdminView = currentUserRole === 'admin'
  const VALID_TABS: MainTab[] = ['org-access', 'shared-accounts']
  const tabParam = params.get('tab') as MainTab | null
  const [tab, setTab] = useState<MainTab>(tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'org-access')

  function handleTabChange(next: MainTab) {
    setTab(next)
    const sp = new URLSearchParams(params.toString())
    sp.set('tab', next)
    router.replace(`?${sp.toString()}`)
  }
  const [connectors, setConnectors] = useState<ConnectorCatalogEntry[]>([])
  const [requests, setRequests] = useState<OrgConnectorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [detailConnector, setDetailConnector] = useState<ConnectorCatalogEntry | null>(null)

  const pendingCount = useMemo(
    () => requests.filter(request => request.status === 'pending').length,
    [requests],
  )

  const loadPageData = useCallback(async () => {
    if (!org.id) return
    setLoading(true)
    try {
      const [catalog, requestList] = await Promise.all([
        isAdminView ? listOrgCatalog(org.id) : listConnectors(),
        listOrgConnectorRequests(org.id),
      ])
      setConnectors(catalog)
      setRequests(requestList)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load connector page')
    } finally {
      setLoading(false)
    }
  }, [org.id, isAdminView])

  useEffect(() => {
    if (!orgReady || !org.id) return
    const timer = window.setTimeout(() => { void loadPageData() }, 0)
    return () => window.clearTimeout(timer)
  }, [orgReady, org.id, loadPageData])

  if (!orgReady || loading) {
    return (
      <PageShell>
        <ConnectorsSkeleton />
      </PageShell>
    )
  }

  if (!org.id) {
    return (
      <PageShell>
        <EmptyState title="No organization found" subtitle="Create or join an organization before managing connectors." />
      </PageShell>
    )
  }

  if (detailConnector) {
    return (
      <ConnectorDetailView
        connector={detailConnector}
        orgId={org.id}
        onBack={() => setDetailConnector(null)}
        onChanged={loadPageData}
      />
    )
  }

  if (!isAdminView) {
    return (
      <PageShell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: '0 0 2px' }}>
              Connectors
            </h1>
            <BodyText style={{ padding: '5px 6px' }}>
              Browse available connectors and request access from your admin.
            </BodyText>
          </div>
          <MemberBrowseView
            orgId={org.id}
            connectors={connectors}
            requests={requests}
            initialSearch={initialSearch}
            onRequested={loadPageData}
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Tabs
        value={tab}
        onValueChange={v => handleTabChange(v as MainTab)}
        style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: '#1a1916', margin: '0 0 2px' }}>
              Connectors
            </h1>
            <BodyText style={{ padding: '5px 6px' }}>
              Manage organization connector access, approvals, and shared accounts.
            </BodyText>
          </div>
          <Tabs.List>
            {ADMIN_TABS.map(item => (
              <Tabs.Trigger key={item.id} value={item.id}>
                {item.id === 'org-access' && pendingCount > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {item.label}
                    <Badge label={`${pendingCount}`} color="Red" />
                  </span>
                ) : (
                  item.label
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
        <Tabs.Content value="org-access">
          <OrgAccessTab
            orgId={org.id}
            connectors={connectors}
            requests={requests}
            initialSearch={initialSearch}
            onRequestsChanged={setRequests}
          />
        </Tabs.Content>
        <Tabs.Content value="shared-accounts">
          <ManageConnectorsTab
            connectors={connectors}
            requests={requests}
            initialSearch={initialSearch}
            onManage={setDetailConnector}
          />
        </Tabs.Content>
      </Tabs>
    </PageShell>
  )
}

export default function OrgConnectorsPage() {
  return (
    <Suspense fallback={null}>
      <OrgConnectorsPageContent />
    </Suspense>
  )
}
