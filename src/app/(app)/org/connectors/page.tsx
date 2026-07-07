'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowDownOneIcon,
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  CancelOneIcon,
  InformationCircleIcon,
  PlusSignIcon,
  SearchOneIcon,
  TickTwoIcon,
  UserIcon,
  WorkflowSquareTenIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
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
  updateOrgCatalog,
} from '@/lib/api/connectors'
import type { ApiKeyField, ConnectorCatalogEntry, ConnectorTool } from '@/lib/api/connectors'
import {
  createOrgConnectorAccount,
  createPersonalRequest,
  deleteOrgConnectorAccount,
  listOrgConnectorAccounts,
  listPersonalRequests,
  pollOrgConnectorAccountUntilConnected,
  reviewPersonalRequest,
  updateOrgConnectorAccount,
} from '@/lib/api/org-connectors'
import type { OrgConnectorAccount, PersonalConnectorRequest } from '@/lib/api/org-connectors'
import {
  attachSharedAccount,
  createTeamConnectionAccount,
  listTeamConnections,
  listTeamConnectors,
  requestTeamConnector,
  setTeamConnectorStatus,
  updateTeamConnectionPermissions,
  unlinkTeamConnection,
} from '@/lib/api/teams'
import type { ConnectorRequestStatus, TeamConnectionEntry, TeamConnectorRequest } from '@/lib/api/teams'
import { connectorLogoSrc } from '@/lib/connectorLogos'
import type { Team } from '@/types/teams'

type MainTab = 'catalog' | 'permissions' | 'manage'
type AccountStatusFilter = 'all' | 'active' | 'needs-attention'

type TeamRequestIndex = Record<string, Record<string, TeamConnectorRequest>>

const POLICY_LABELS: Record<ConnectorTool['policy'], string> = {
  allow:      'Always allow',
  ask:        'Ask',
  block:      'Never',
  allow_once: 'Allow once',
}

const POLICY_VALUES: ConnectorTool['policy'][] = ['allow', 'ask', 'block', 'allow_once']

const POLICY_HELP: Record<ConnectorTool['policy'], string> = {
  allow:      'Runs without asking',
  ask:        'Asks before each run',
  block:      'Never runs',
  allow_once: 'Runs once, then asks again',
}

// Turn a raw tool slug (e.g. "GOOGLECALENDAR_CREATE_EVENT") into a readable
// action name, dropping the redundant connector prefix when present.
function humanizeAction(toolSlug: string, connectorSlug: string): string {
  let s = toolSlug
  const prefix = `${connectorSlug.replace(/[\s-]/g, '_').toUpperCase()}_`
  if (s.toUpperCase().startsWith(prefix)) s = s.slice(prefix.length)
  s = s.replace(/_/g, ' ').trim().toLowerCase()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : toolSlug
}

// KDS policy selector — mirrors the Dropdown.Float pattern used across settings.
function PolicySelect({
  value,
  disabled,
  onChange,
}: {
  value:     ConnectorTool['policy']
  disabled?: boolean
  onChange:  (value: ConnectorTool['policy']) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownFloat
      open={open}
      onOpenChange={next => { if (!disabled) setOpen(next) }}
      placement="bottom-end"
      offset={4}
      trigger={
        <button
          type="button"
          disabled={disabled}
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            gap:             8,
            width:           150,
            height:          34,
            padding:         '0 10px',
            borderRadius:    10,
            border:          'none',
            backgroundColor: 'white',
            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
            cursor:          disabled ? 'not-allowed' : 'pointer',
            opacity:         disabled ? 0.6 : 1,
            outline:         'none',
            flexShrink:      0,
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)' }}>
            {POLICY_LABELS[value]}
          </span>
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown style={{ width: 220 }}>
        {POLICY_VALUES.map(policy => (
          <DropdownMenuItem
            key={policy}
            fluid
            label={POLICY_LABELS[policy]}
            subLabel={POLICY_HELP[policy]}
            selected={policy === value}
            icon={policy === value ? <TickTwoIcon size={14} /> : undefined}
            onClick={() => { onChange(policy); setOpen(false) }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  )
}

// Filter the actions table by current permission (plus an "All" option).
function PolicyFilterSelect({
  value,
  onChange,
}: {
  value:    'all' | ConnectorTool['policy']
  onChange: (value: 'all' | ConnectorTool['policy']) => void
}) {
  const [open, setOpen] = useState(false)
  const label = value === 'all' ? 'All permissions' : POLICY_LABELS[value]
  return (
    <DropdownFloat
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      offset={4}
      trigger={
        <button
          type="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            height: 34, padding: '0 10px', borderRadius: 10, border: 'none', backgroundColor: 'white',
            boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
            cursor: 'pointer', outline: 'none', flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)' }}>{label}</span>
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </button>
      }
    >
      <Dropdown style={{ width: 200 }}>
        <DropdownMenuItem
          fluid
          label="All permissions"
          selected={value === 'all'}
          icon={value === 'all' ? <TickTwoIcon size={14} /> : undefined}
          onClick={() => { onChange('all'); setOpen(false) }}
        />
        {POLICY_VALUES.map(policy => (
          <DropdownMenuItem
            key={policy}
            fluid
            label={POLICY_LABELS[policy]}
            selected={policy === value}
            icon={policy === value ? <TickTwoIcon size={14} /> : undefined}
            onClick={() => { onChange(policy); setOpen(false) }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  )
}

// Bulk-apply one permission to every action currently shown (the "common
// permission for everything" control); per-action overrides still work after.
function BulkPolicyButton({
  count,
  disabled,
  onPick,
}: {
  count:     number
  disabled?: boolean
  onPick:    (policy: ConnectorTool['policy']) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownFloat
      open={open}
      onOpenChange={next => { if (!disabled) setOpen(next) }}
      placement="bottom-end"
      offset={4}
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={14} />} disabled={disabled}>
          {`Set ${count} to…`}
        </Button>
      }
    >
      <Dropdown style={{ width: 220 }}>
        {POLICY_VALUES.map(policy => (
          <DropdownMenuItem
            key={policy}
            fluid
            label={POLICY_LABELS[policy]}
            subLabel={POLICY_HELP[policy]}
            onClick={() => { onPick(policy); setOpen(false) }}
          />
        ))}
      </Dropdown>
    </DropdownFloat>
  )
}

// One team's permissions as a filterable table: search by action, filter by
// current permission, bulk-set the shown rows, or override a single action.
function TeamPermissionsTable({
  team,
  connection,
  tools,
  connectorSlug,
  savingPermission,
  savingBulk,
  onUpdateTool,
  onBulkSet,
}: {
  team:             Team
  connection:       TeamConnectionEntry | undefined
  tools:            ConnectorTool[]
  connectorSlug:    string
  savingPermission: string | null
  savingBulk:       boolean
  onUpdateTool:     (tool: ConnectorTool, policy: ConnectorTool['policy']) => void
  onBulkSet:        (slugs: string[], policy: ConnectorTool['policy']) => void
}) {
  const [search, setSearch] = useState('')
  const [policyFilter, setPolicyFilter] = useState<'all' | ConnectorTool['policy']>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tools.filter(tool => {
      if (policyFilter !== 'all' && tool.policy !== policyFilter) return false
      if (q && !humanizeAction(tool.slug, connectorSlug).toLowerCase().includes(q)) return false
      return true
    })
  }, [tools, search, policyFilter, connectorSlug])

  return (
    <SettingsTable columns={PERMISSION_COLUMNS} columnGap={0}>
      <SettingsTableToolbar title={team.name} style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 0 0', minWidth: 0 }}>
          {connection ? statusBadge(connection.status) : <Badge label="Unavailable" color="Neutral" />}
          <div style={{ width: 180, maxWidth: '100%' }}>
            <InputField
              label="Search actions"
              showLabel={false}
              showSubtitle={false}
              size="small"
              fluid
              leftIcon={<SearchOneIcon size={16} />}
              placeholder="Search actions"
              value={search}
              onChange={setSearch}
            />
          </div>
          <PolicyFilterSelect value={policyFilter} onChange={setPolicyFilter} />
          <BulkPolicyButton
            count={filtered.length}
            disabled={!connection || savingBulk || filtered.length === 0}
            onPick={policy => onBulkSet(filtered.map(tool => tool.slug), policy)}
          />
        </div>
      </SettingsTableToolbar>

      <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
        <div role="table" aria-label={`${team.name} permissions`} style={{ minWidth: 420 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Action</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Permission</SettingsTableHeaderCell>
          </SettingsTableHeader>
          {tools.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                This connector has no configurable tools yet.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No actions match your filters.
              </p>
            </div>
          ) : filtered.map(tool => {
            const saveKey = `${team.id}:${tool.slug}`
            return (
              <SettingsTableRow key={tool.slug} minHeight={56}>
                <SettingsTableCell>
                  <BodyText size={14} weight={500} color="var(--neutral-900)" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {humanizeAction(tool.slug, connectorSlug)}
                  </BodyText>
                </SettingsTableCell>
                <SettingsTableCell align="end">
                  <PolicySelect
                    value={tool.policy}
                    disabled={!connection || savingPermission === saveKey || savingBulk}
                    onChange={policy => onUpdateTool(tool, policy)}
                  />
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}
          <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)' }}>
            <BodyText size={12} color="var(--neutral-500)">
              {filtered.length} of {tools.length} action{tools.length === 1 ? '' : 's'}
            </BodyText>
          </SettingsTableFooter>
        </div>
      </div>
    </SettingsTable>
  )
}

const ADMIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'manage', label: 'Manage connectors' },
]

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kaya-scrollbar"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '64px 24px 48px',
      }}
    >
      <div style={{ width: 1040, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
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

function ConnectorIcon({ connector }: { connector: Pick<ConnectorCatalogEntry, 'slug' | 'display_name'> }) {
  const src = connectorLogoSrc(connector.slug)
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

function statusBadge(status: ConnectorRequestStatus) {
  if (status === 'approved') return <Badge label="Approved" color="Green" />
  if (status === 'denied') return <Badge label="Denied" color="Red" />
  return <Badge label="Pending" color="Yellow" />
}

function accountBadge(account: OrgConnectorAccount) {
  if (!account.connected) return <Badge label="Pending" color="Yellow" />
  if (account.status === 'active') return <Badge label="Active" color="Green" />
  if (account.status === 'disabled') return <Badge label="Disabled" color="Neutral" />
  return <Badge label="Expired" color="Red" />
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

async function loadTeamRequestIndex(orgId: string, teams: Team[]): Promise<TeamRequestIndex> {
  const entries = await Promise.all(
    teams.map(async team => {
      const requests = await listTeamConnectors(orgId, team.id)
      return [team.id, Object.fromEntries(requests.map(request => [request.connectorSlug, request]))] as const
    }),
  )
  return Object.fromEntries(entries)
}

const CONNECTOR_COLUMNS = 'minmax(240px, 1.4fr) 150px 140px 150px'

function CatalogTab({
  orgId,
  connectors,
  initialSearch,
  onCatalogUpdated,
}: {
  orgId: string
  connectors: ConnectorCatalogEntry[]
  initialSearch: string
  onCatalogUpdated: (connectors: ConnectorCatalogEntry[]) => void
}) {
  const { search, setSearch, filtered } = useConnectorSearch(connectors, initialSearch)
  const browse = useConnectorBrowse(filtered, connectorEntrySlug, { resetKey: search })
  const [busyOrgSlug, setBusyOrgSlug] = useState<string | null>(null)

  const enabledSlugs = useMemo(
    () => connectors.filter(connector => connector.org_enabled === true).map(connector => connector.slug),
    [connectors],
  )

  async function handleOrgToggle(connector: ConnectorCatalogEntry, checked: boolean) {
    setBusyOrgSlug(connector.slug)
    try {
      const nextSlugs = checked
        ? Array.from(new Set([...enabledSlugs, connector.slug]))
        : enabledSlugs.filter(slug => slug !== connector.slug)
      const next = await updateOrgCatalog(orgId, nextSlugs)
      onCatalogUpdated(next)
      toast.success(`${connector.display_name} ${checked ? 'enabled' : 'disabled'} for the organization`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update catalog')
    } finally {
      setBusyOrgSlug(null)
    }
  }

  return (
    <SettingsTable columns={CONNECTOR_COLUMNS} columnGap={24}>
      <SettingsTableToolbar title="Connector catalog" style={{ flexWrap: 'wrap' }}>
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
      </SettingsTableToolbar>

      <div style={{ padding: '0 24px 12px' }}>
        <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
      </div>

      <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Connector catalog" style={{ minWidth: 760 }}>
          <SettingsTableHeader>
            <SettingsTableHeaderCell>Connector</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Category</SettingsTableHeaderCell>
            <SettingsTableHeaderCell>Shared accounts</SettingsTableHeaderCell>
            <SettingsTableHeaderCell align="end">Organization</SettingsTableHeaderCell>
          </SettingsTableHeader>

          {browse.pageItems.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                {connectors.length === 0 ? 'No connectors available' : 'No connectors match your filters'}
              </p>
            </div>
          ) : browse.pageItems.map(connector => {
            const orgEnabled = connector.org_enabled === true
            const accountCount = connector.accounts?.length ?? 0
            return (
              <SettingsTableRow key={connector.slug} minHeight={72}>
                <SettingsTableCell>
                  <ConnectorTitle connector={connector} />
                </SettingsTableCell>
                <SettingsTableCell>
                  <BodyText size={14} color="var(--neutral-500)">{connectorCategory(connector.slug)}</BodyText>
                </SettingsTableCell>
                <SettingsTableCell>
                  {accountCount > 0 ? (
                    <BodyText size={14} color="var(--neutral-500)">{accountCount} shared</BodyText>
                  ) : (
                    <BodyText size={14} color="var(--neutral-400)">—</BodyText>
                  )}
                </SettingsTableCell>
                <SettingsTableCell align="end">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {busyOrgSlug === connector.slug && <Spinner />}
                    <BodyText size={12} color="var(--neutral-700)" style={{ width: 52, textAlign: 'right' }}>
                      {orgEnabled ? 'Org ON' : 'Org OFF'}
                    </BodyText>
                    <Switch
                      checked={orgEnabled}
                      disabled={busyOrgSlug === connector.slug}
                      onCheckedChange={checked => void handleOrgToggle(connector, checked)}
                    />
                  </div>
                </SettingsTableCell>
              </SettingsTableRow>
            )
          })}

          <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <BodyText size={12} color="var(--neutral-500)">
              {browse.total} connector{browse.total === 1 ? '' : 's'}
            </BodyText>
            <Pagination page={browse.page} pageCount={browse.pageCount} onChange={browse.setPage} />
          </SettingsTableFooter>
        </div>
      </div>
    </SettingsTable>
  )
}

function ApprovalRow({
  connector,
  title,
  subtitle,
  note,
  status,
  onApprove,
  onDeny,
}: {
  connector: ConnectorCatalogEntry | undefined
  title: string
  subtitle: string
  note?: string | null
  status: ConnectorRequestStatus
  onApprove: () => Promise<void>
  onDeny: () => Promise<void>
}) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)
  const fallbackConnector: ConnectorCatalogEntry = connector ?? {
    slug: title,
    display_name: title,
    auth_mode: 'oauth2',
    description: '',
    tools: [],
    api_key_fields: [],
    linked: false,
    workspace_linked: false,
    workspace_linked_by: null,
    shared_account_id: null,
    account_label: null,
    account_identifier: null,
    accounts: [],
    account_options: [],
    org_enabled: null,
    personal_access_status: null,
  }

  async function run(kind: 'approve' | 'deny', fn: () => Promise<void>) {
    setBusy(kind)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 14,
        boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <ConnectorIcon connector={fallbackConnector} />
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BodyText weight={500} color="var(--neutral-900)">{title}</BodyText>
          {statusBadge(status)}
        </div>
        <BodyText size={11}>{subtitle}</BodyText>
        {note && (
          <BodyText size={11} color="var(--neutral-600)" style={{ marginTop: 3, fontStyle: 'italic' }}>
            &ldquo;{note}&rdquo;
          </BodyText>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy != null}
          loading={busy === 'deny'}
          onClick={() => void run('deny', onDeny)}
        >
          Deny
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={busy != null}
          loading={busy === 'approve'}
          onClick={() => void run('approve', onApprove)}
        >
          Approve
        </Button>
      </div>
    </div>
  )
}

function PermissionsTab({
  orgId,
  connectors,
  teams,
  personalRequests,
  teamRequests,
  loading,
  onReload,
}: {
  orgId: string
  connectors: ConnectorCatalogEntry[]
  teams: Team[]
  personalRequests: PersonalConnectorRequest[]
  teamRequests: TeamRequestIndex
  loading: boolean
  onReload: () => Promise<void>
}) {
  const connectorBySlug = useMemo(
    () => Object.fromEntries(connectors.map(connector => [connector.slug, connector])),
    [connectors],
  )
  const teamById = useMemo(
    () => Object.fromEntries(teams.map(team => [team.id, team])),
    [teams],
  )
  const pendingTeamRequests = useMemo(
    () => Object.values(teamRequests).flatMap(bySlug => Object.values(bySlug)).filter(request => request.status === 'pending'),
    [teamRequests],
  )
  const pendingPersonal = personalRequests.filter(request => request.status === 'pending')

  if (loading) {
    return (
      <PageCard>
        <EmptyState title="Loading requests…" />
      </PageCard>
    )
  }

  async function approveTeam(request: TeamConnectorRequest) {
    await setTeamConnectorStatus(orgId, request.teamId, request.connectorSlug, 'approved')
    toast.success('Team connector approved')
    await onReload()
  }

  async function denyTeam(request: TeamConnectorRequest) {
    await setTeamConnectorStatus(orgId, request.teamId, request.connectorSlug, 'denied')
    toast.success('Team connector denied')
    await onReload()
  }

  async function reviewPersonal(request: PersonalConnectorRequest, status: 'approved' | 'denied') {
    await reviewPersonalRequest(orgId, request.id, status)
    toast.success(status === 'approved' ? 'Personal request approved' : 'Personal request denied')
    await onReload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageCard>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <WorkflowSquareTenIcon size={22} />
          <div>
            <BodyText size={16} weight={500} color="var(--neutral-900)">Team connector requests</BodyText>
            <BodyText size={12}>Approve connector access requested for a specific team.</BodyText>
          </div>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingTeamRequests.length === 0 ? (
            <EmptyState title="No pending team requests" />
          ) : (
            pendingTeamRequests.map(request => {
              const connector = connectorBySlug[request.connectorSlug]
              const team = teamById[request.teamId]
              return (
                <ApprovalRow
                  key={`${request.teamId}:${request.connectorSlug}`}
                  connector={connector}
                  title={connector?.display_name ?? request.connectorSlug}
                  subtitle={`${team?.name ?? 'Unknown team'} requested by ${request.requestedByName ?? request.requestedByEmail ?? 'a member'}`}
                  note={request.note}
                  status={request.status}
                  onApprove={() => approveTeam(request)}
                  onDeny={() => denyTeam(request)}
                />
              )
            })
          )}
        </div>
      </PageCard>

      <PageCard>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserIcon size={22} />
          <div>
            <BodyText size={16} weight={500} color="var(--neutral-900)">Personal connector requests</BodyText>
            <BodyText size={12}>Approve one user&apos;s personal connector exception.</BodyText>
          </div>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingPersonal.length === 0 ? (
            <EmptyState title="No pending personal requests" />
          ) : (
            pendingPersonal.map(request => {
              const connector = connectorBySlug[request.connectorSlug]
              return (
                <ApprovalRow
                  key={request.id}
                  connector={connector}
                  title={connector?.display_name ?? request.connectorSlug}
                  subtitle={`Requested by ${request.userName ?? request.userEmail ?? 'a member'}`}
                  note={request.note}
                  status={request.status}
                  onApprove={() => reviewPersonal(request, 'approved')}
                  onDeny={() => reviewPersonal(request, 'denied')}
                />
              )
            })
          )}
        </div>
      </PageCard>
    </div>
  )
}

function ConnectorCard({
  connector,
  onManage,
}: {
  connector: ConnectorCatalogEntry
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
          <Badge label={connector.org_enabled === true ? 'Org on' : 'Org off'} color={connector.org_enabled === true ? 'Green' : 'Neutral'} />
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
  initialSearch,
  onManage,
}: {
  connectors: ConnectorCatalogEntry[]
  initialSearch: string
  onManage: (connector: ConnectorCatalogEntry) => void
}) {
  const orgEnabled = useMemo(() => connectors.filter(connector => connector.org_enabled === true), [connectors])
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
          <EmptyState title="No connectors enabled yet" subtitle="Turn on connectors in the Catalog tab to manage shared accounts for them." />
        ) : browse.pageItems.length === 0 ? (
          <EmptyState title="No connectors found" subtitle="Try a different search or category." />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {browse.pageItems.map(connector => (
                <ConnectorCard key={connector.slug} connector={connector} onManage={onManage} />
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
          padding: 8,
        }}
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
  teams,
  onClose,
  onCreated,
}: {
  connector: ConnectorCatalogEntry
  orgId: string
  teams: Team[]
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const fields = credentialFields(connector)
  const [label, setLabel] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const canSubmit = label.trim().length > 0 && fields.every(field => !field.required || values[field.name]?.trim())

  function toggleSelectedTeam(teamId: string, checked: boolean) {
    setSelectedTeamIds(prev => checked
      ? Array.from(new Set([...prev, teamId]))
      : prev.filter(id => id !== teamId))
  }

  async function shareAccountWithTeams(accountId: string): Promise<string[]> {
    const selectedTeams = teams.filter(team => selectedTeamIds.includes(team.id))
    const failed: string[] = []
    for (const team of selectedTeams) {
      try {
        await requestTeamConnector(orgId, team.id, connector.slug)
        await attachSharedAccount(orgId, team.id, connector.slug, accountId)
      } catch {
        failed.push(team.name)
      }
    }
    return failed
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setBusy(true)
    let connected = connector.auth_mode !== 'oauth2'
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
        connected = true
      }

      if (res.redirectUrl) {
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (popup && !popup.closed) popup.location.href = res.redirectUrl
        else window.open(res.redirectUrl, '_blank', 'noopener')
        setPolling(true)
        try {
          await pollOrgConnectorAccountUntilConnected(orgId, connector.slug, res.sharedAccountId)
          connected = true
          popup?.close()
        } catch {
          connected = false
          popup?.close()
          toast.warning('OAuth flow timed out. The account was created; refresh the account list after finishing auth.')
        } finally {
          setPolling(false)
        }
      }

      if (connected && selectedTeamIds.length > 0) {
        const failedTeams = await shareAccountWithTeams(res.sharedAccountId)
        if (failedTeams.length > 0) {
          toast.warning(`Shared account created, but could not share with ${failedTeams.join(', ')}`)
        } else {
          toast.success('Shared account created and shared with selected teams')
        }
      } else {
        toast.success('Shared account created')
      }
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
      subtitle="Create an org-owned account, then choose which teams can use it."
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

        <PageCard>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <InformationCircleIcon size={18} style={{ marginTop: 2 }} />
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Share with teams</BodyText>
              <BodyText size={12}>
                Members only see this workspace connector after the shared account is attached to one of their teams.
              </BodyText>
            </div>
          </div>
          {teams.length === 0 ? (
            <EmptyState title="No teams yet" subtitle="Create a team before sharing this account with members." />
          ) : (
            teams.map((team, index) => {
              const checked = selectedTeamIds.includes(team.id)
              return (
                <div key={team.id}>
                  {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                  <div style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <BodyText weight={500} color="var(--neutral-900)">{team.name}</BodyText>
                      <BodyText size={11}>{checked ? 'Will be visible to this team' : 'Not visible to this team yet'}</BodyText>
                    </div>
                    <Switch checked={checked} disabled={busy} onCheckedChange={next => toggleSelectedTeam(team.id, next)} />
                  </div>
                </div>
              )
            })
          )}
          {teams.length > 0 && selectedTeamIds.length === 0 && (
            <div style={{ padding: '0 20px 16px' }}>
              <BodyText size={12}>No teams selected. This account will stay in the admin pool until you share it.</BodyText>
            </div>
          )}
        </PageCard>

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

const PERMISSION_COLUMNS = 'minmax(220px, 1fr) 170px'

function AccountDetailView({
  account,
  connector,
  orgId,
  teams,
  onBack,
  onChanged,
}: {
  account: OrgConnectorAccount
  connector: ConnectorCatalogEntry
  orgId: string
  teams: Team[]
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const [label, setLabel] = useState(account.accountLabel)
  const [version, setVersion] = useState(account.version)
  const [status, setStatus] = useState(account.status)
  const [teamIds, setTeamIds] = useState(account.teamIds)
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [teamConnections, setTeamConnections] = useState<Record<string, TeamConnectionEntry>>({})
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [savingPermission, setSavingPermission] = useState<string | null>(null)
  const [savingBulk, setSavingBulk] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const attachedTeams = useMemo(
    () => teams.filter(team => teamIds.includes(team.id)),
    [teams, teamIds],
  )

  const selectedTeam = attachedTeams.find(team => team.id === selectedTeamId) ?? attachedTeams[0] ?? null
  const selectedConnection = selectedTeam ? teamConnections[selectedTeam.id] : undefined
  const selectedTools = selectedConnection?.tools.length ? selectedConnection.tools : (connector.tools ?? [])

  const loadTeamPermissions = useCallback(async () => {
    if (teamIds.length === 0) {
      setTeamConnections({})
      return
    }

    setPermissionsLoading(true)
    try {
      const entries = await Promise.all(teamIds.map(async teamId => {
        const connections = await listTeamConnections(orgId, teamId)
        const connection = connections.find(item => item.slug === connector.slug && item.sharedAccountId === account.id)
          ?? connections.find(item => item.slug === connector.slug)
          ?? null
        return [teamId, connection] as const
      }))

      const next: Record<string, TeamConnectionEntry> = {}
      entries.forEach(([teamId, connection]) => {
        if (connection) next[teamId] = connection
      })
      setTeamConnections(next)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load team permissions')
    } finally {
      setPermissionsLoading(false)
    }
  }, [account.id, connector.slug, orgId, teamIds])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTeamPermissions() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTeamPermissions])

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

  async function toggleTeam(team: Team, checked: boolean) {
    setSaving(team.id)
    try {
      if (checked) {
        await requestTeamConnector(orgId, team.id, connector.slug)
        await attachSharedAccount(orgId, team.id, connector.slug, account.id)
        setTeamIds(prev => Array.from(new Set([...prev, team.id])))
        toast.success(`${account.accountLabel} shared with ${team.name}`)
      } else {
        await unlinkTeamConnection(orgId, team.id, connector.slug)
        setTeamIds(prev => prev.filter(id => id !== team.id))
        setTeamConnections(prev => {
          const next = { ...prev }
          delete next[team.id]
          return next
        })
        toast.success(`${account.accountLabel} removed from ${team.name}`)
      }
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update team sharing')
    } finally {
      setSaving(null)
    }
  }

  async function updateTeamPermission(team: Team, tool: ConnectorTool, policy: ConnectorTool['policy']) {
    const connection = teamConnections[team.id]
    if (!connection) {
      toast.error('Attach this shared account to the team before editing permissions')
      return
    }

    const sourceTools = connection.tools.length > 0 ? connection.tools : (connector.tools ?? [])
    const nextTools = sourceTools.map(item => item.slug === tool.slug ? { ...item, policy } : item)
    const saveKey = `${team.id}:${tool.slug}`
    setSavingPermission(saveKey)
    setTeamConnections(prev => ({
      ...prev,
      [team.id]: { ...connection, tools: nextTools },
    }))

    try {
      const updated = await updateTeamConnectionPermissions(orgId, team.id, connector.slug, nextTools)
      setTeamConnections(prev => ({ ...prev, [team.id]: updated }))
      toast.success(`${team.name} permissions updated`)
    } catch (error) {
      await loadTeamPermissions()
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions')
    } finally {
      setSavingPermission(null)
    }
  }

  async function bulkSetPermissions(team: Team, slugs: string[], policy: ConnectorTool['policy']) {
    const connection = teamConnections[team.id]
    if (!connection) {
      toast.error('Attach this shared account to the team before editing permissions')
      return
    }
    const target = new Set(slugs)
    const sourceTools = connection.tools.length > 0 ? connection.tools : (connector.tools ?? [])
    const nextTools = sourceTools.map(item => target.has(item.slug) ? { ...item, policy } : item)
    setSavingBulk(true)
    setTeamConnections(prev => ({ ...prev, [team.id]: { ...connection, tools: nextTools } }))
    try {
      const updated = await updateTeamConnectionPermissions(orgId, team.id, connector.slug, nextTools)
      setTeamConnections(prev => ({ ...prev, [team.id]: updated }))
      toast.success(`Set ${slugs.length} action${slugs.length === 1 ? '' : 's'} to ${POLICY_LABELS[policy]} for ${team.name}`)
    } catch (error) {
      await loadTeamPermissions()
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions')
    } finally {
      setSavingBulk(false)
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

  const canShare = account.connected && status === 'active'

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
              <BodyText size={12}>Disabled or expired accounts cannot run for teams.</BodyText>
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

        <PageCard>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <InformationCircleIcon size={18} style={{ marginTop: 2 }} />
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Shared with teams</BodyText>
              <BodyText size={12}>
                Attaching this account approves the connector for that team if needed, then links this shared account.
              </BodyText>
            </div>
          </div>
          {teams.length === 0 ? (
            <EmptyState title="No teams yet" />
          ) : (
            teams.map((team, index) => {
              const checked = teamIds.includes(team.id)
              const disabled = saving === team.id || (!checked && !canShare)
              return (
                <div key={team.id}>
                  {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                  <div style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <BodyText weight={500} color="var(--neutral-900)">{team.name}</BodyText>
                      <BodyText size={11}>{checked ? 'Using this shared account' : canShare ? 'Not attached' : 'Account must be active and connected first'}</BodyText>
                    </div>
                    <Switch checked={checked} disabled={disabled} onCheckedChange={next => void toggleTeam(team, next)} />
                  </div>
                </div>
              )
            })
          )}
        </PageCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <WorkflowSquareTenIcon size={18} style={{ marginTop: 2 }} />
            <div>
              <BodyText weight={500} color="var(--neutral-900)">Team permissions</BodyText>
              <BodyText size={12}>
                Control which connector actions this shared account can run for each attached team.
              </BodyText>
            </div>
          </div>

          {attachedTeams.length === 0 ? (
            <PageCard><EmptyState title="Attach to a team first" subtitle="Permissions appear after this account is shared with a team." /></PageCard>
          ) : permissionsLoading ? (
            <PageCard><EmptyState title="Loading permissions..." /></PageCard>
          ) : selectedTeam ? (
            <>
              {attachedTeams.length > 1 && (
                <Tabs value={selectedTeam.id} onValueChange={setSelectedTeamId}>
                  <Tabs.List>
                    {attachedTeams.map(team => (
                      <Tabs.Trigger key={team.id} value={team.id}>{team.name}</Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs>
              )}
              <TeamPermissionsTable
                key={selectedTeam.id}
                team={selectedTeam}
                connection={selectedConnection}
                tools={selectedTools}
                connectorSlug={connector.slug}
                savingPermission={savingPermission}
                savingBulk={savingBulk}
                onUpdateTool={(tool, policy) => void updateTeamPermission(selectedTeam, tool, policy)}
                onBulkSet={(slugs, policy) => void bulkSetPermissions(selectedTeam, slugs, policy)}
              />
            </>
          ) : null}
        </div>

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
  teams,
  onBack,
  onChanged,
}: {
  connector: ConnectorCatalogEntry
  orgId: string
  teams: Team[]
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
        teams={teams}
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
            <EmptyState title="No shared accounts" subtitle="Create an org shared account, then attach it to teams." />
          ) : (
            visibleAccounts.map((account, index) => (
              <div key={account.id}>
                {index > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />}
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, backgroundColor: 'white' }}>
                  <div style={{ flex: '1 0 0', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <BodyText weight={500} color="var(--neutral-900)">{account.accountLabel}</BodyText>
                      {accountBadge(account)}
                      <Badge label={`${account.teamIds.length} team${account.teamIds.length === 1 ? '' : 's'}`} color="Purple" />
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
          teams={teams}
          onClose={() => setAddOpen(false)}
          onCreated={refreshAll}
        />
      )}
    </PageShell>
  )
}

function TeamScopedAccountModal({
  connector,
  orgId,
  team,
  onClose,
  onCreated,
}: {
  connector: ConnectorCatalogEntry
  orgId: string
  team: Team
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const fields = credentialFields(connector)
  const [label, setLabel] = useState(`${team.name} ${connector.display_name}`)
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
      const res = await createTeamConnectionAccount(orgId, team.id, connector.slug, {
        accountLabel: label.trim(),
        accountIdentifier: identifier.trim() || undefined,
        initData: fieldPayload,
      })

      if (res.redirectUrl && res.sharedAccountId) {
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (popup && !popup.closed) popup.location.href = res.redirectUrl
        else window.open(res.redirectUrl, '_blank', 'noopener')
        setPolling(true)
        try {
          await pollOrgConnectorAccountUntilConnected(orgId, connector.slug, res.sharedAccountId)
          await attachSharedAccount(orgId, team.id, connector.slug, res.sharedAccountId)
          popup?.close()
        } catch {
          popup?.close()
          toast.warning('OAuth flow timed out. The account was created; retry after finishing auth.')
        } finally {
          setPolling(false)
        }
      }

      toast.success(`${connector.display_name} connected for ${team.name}`)
      await onCreated()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect team account')
    } finally {
      setBusy(false)
      setPolling(false)
    }
  }

  return (
    <ModalShell
      title={`Connect ${connector.display_name}`}
      subtitle={`This shared account will be scoped to ${team.name}.`}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageCard style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <InputField fluid label="Account label" value={label} onChange={setLabel} />
            <InputField fluid label="Account identifier" placeholder="support@example.com" value={identifier} onChange={setIdentifier} />
          </div>
        </PageCard>

        <PageCard style={{ padding: 16 }}>
          <BodyText weight={500} color="var(--neutral-900)">Team permission</BodyText>
          <BodyText size={12}>
            This connector must already be enabled and approved for {team.name}. The account will not be shared with other teams.
          </BodyText>
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
                    : 'Credentials are saved on this team shared account.'}
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
            {polling ? 'Waiting for auth...' : connector.auth_mode === 'oauth2' ? 'Start team OAuth' : 'Connect for team'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}

function MemberBrowseView({
  orgId,
  connectors,
  teams,
  initialSearch,
  onRequested,
}: {
  orgId: string
  connectors: ConnectorCatalogEntry[]
  teams: Team[]
  initialSearch: string
  onRequested: () => void
}) {
  const { search, setSearch, filtered } = useConnectorSearch(connectors, initialSearch)
  const browse = useConnectorBrowse(filtered, connectorEntrySlug, { resetKey: search })
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [teamConnections, setTeamConnections] = useState<TeamConnectionEntry[]>([])
  const [loadingTeamConnections, setLoadingTeamConnections] = useState(false)
  const [connectModal, setConnectModal] = useState<{ connector: ConnectorCatalogEntry; team: Team } | null>(null)

  const resolvedTeamId = selectedTeamId || teams[0]?.id || ''
  const selectedTeam = teams.find(team => team.id === resolvedTeamId) ?? null
  const connectionBySlug = useMemo(
    () => new Map(teamConnections.map(connection => [connection.slug, connection])),
    [teamConnections],
  )

  const loadSelectedTeamConnections = useCallback(async () => {
    if (!resolvedTeamId) {
      setTeamConnections([])
      return
    }
    setLoadingTeamConnections(true)
    try {
      const list = await listTeamConnections(orgId, resolvedTeamId)
      setTeamConnections(list)
    } catch {
      setTeamConnections([])
    } finally {
      setLoadingTeamConnections(false)
    }
  }, [orgId, resolvedTeamId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSelectedTeamConnections() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSelectedTeamConnections])

  async function requestForMe(connector: ConnectorCatalogEntry) {
    setBusySlug(connector.slug)
    try {
      await createPersonalRequest(orgId, connector.slug, `Personal access requested from org connector page.`)
      toast.success('Personal request sent')
      onRequested()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request')
    } finally {
      setBusySlug(null)
    }
  }

  async function requestForTeam(connector: ConnectorCatalogEntry) {
    if (!resolvedTeamId) return
    setBusySlug(connector.slug)
    try {
      await requestTeamConnector(orgId, resolvedTeamId, connector.slug, `Team access requested from org connector page.`)
      toast.success('Team request sent')
      onRequested()
      await loadSelectedTeamConnections()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send team request')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <PageCard>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <BodyText size={16} weight={500} color="var(--neutral-900)">Browse and request connectors</BodyText>
          <BodyText size={12}>Team editors can connect a shared account after an admin approves that connector for the team.</BodyText>
        </div>
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {teams.length > 0 && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BodyText weight={500} color="var(--neutral-900)">Team request target</BodyText>
          <select
            value={resolvedTeamId}
            onChange={event => setSelectedTeamId(event.target.value)}
            style={{
              height: 34,
              border: 'none',
              borderRadius: 8,
              backgroundColor: 'white',
              boxShadow: '0px 0px 0px 1px var(--neutral-100)',
              padding: '0 10px',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--neutral-900)',
            }}
          >
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ padding: '14px 24px 0' }}>
        <CategoryFilter value={browse.category} categories={browse.availableCategories} onChange={browse.setCategory} />
      </div>

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {browse.pageItems.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState title="No connectors found" subtitle="Try a different search or category." />
          </div>
        ) : browse.pageItems.map(connector => {
          const teamConnection = connectionBySlug.get(connector.slug)
          const approvedForTeam = Boolean(teamConnection)
          const connectedForTeam = Boolean(teamConnection?.workspaceLinked)
          return (
            <div key={connector.slug} style={{ backgroundColor: 'white', borderRadius: 16, boxShadow: '0px 2px 2.8px 0px var(--neutral-200), 0px 0px 0px 1px var(--neutral-200)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ConnectorTitle connector={connector} />
              <BodyText size={11} style={{ minHeight: 34 }}>{connector.description || 'No description available.'}</BodyText>
              {approvedForTeam && (
                <Badge
                  label={connectedForTeam ? `Connected for ${selectedTeam?.name ?? 'team'}` : `Approved for ${selectedTeam?.name ?? 'team'}`}
                  color={connectedForTeam ? 'Green' : 'Blue'}
                />
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button variant="outline" size="sm" disabled={busySlug === connector.slug} onClick={() => void requestForMe(connector)}>
                  Request for me
                </Button>
                {approvedForTeam && selectedTeam ? (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={loadingTeamConnections || busySlug === connector.slug || connectedForTeam}
                    onClick={() => setConnectModal({ connector, team: selectedTeam })}
                  >
                    {connectedForTeam ? 'Connected' : 'Connect for team'}
                  </Button>
                ) : (
                  <Button variant="default" size="sm" disabled={!resolvedTeamId || busySlug === connector.slug} onClick={() => void requestForTeam(connector)}>
                    Request for team
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '0 24px 20px' }}>
        <Pagination page={browse.page} pageCount={browse.pageCount} onChange={browse.setPage} />
      </div>

      {connectModal && (
        <TeamScopedAccountModal
          connector={connectModal.connector}
          orgId={orgId}
          team={connectModal.team}
          onClose={() => setConnectModal(null)}
          onCreated={async () => {
            await loadSelectedTeamConnections()
            onRequested()
          }}
        />
      )}
    </PageCard>
  )
}


function OrgConnectorsPageContent() {
  const { org, orgReady, currentUserRole, teams, teamsLoading } = useOrg()
  const activeTeams = teams.filter(t => !t.archived)
  const router = useRouter()
  const params = useSearchParams()
  const initialSearch = params.get('q') ?? ''
  const isAdminView = currentUserRole === 'admin'
  const VALID_TABS: MainTab[] = ['catalog', 'permissions', 'manage']
  const tabParam = params.get('tab') as MainTab | null
  const [tab, setTab] = useState<MainTab>(tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'catalog')

  function handleTabChange(next: MainTab) {
    setTab(next)
    const sp = new URLSearchParams(params.toString())
    sp.set('tab', next)
    router.replace(`?${sp.toString()}`)
  }
  const [connectors, setConnectors] = useState<ConnectorCatalogEntry[]>([])
  const [personalRequests, setPersonalRequests] = useState<PersonalConnectorRequest[]>([])
  const [teamRequests, setTeamRequests] = useState<TeamRequestIndex>({})
  const [loading, setLoading] = useState(true)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [detailConnector, setDetailConnector] = useState<ConnectorCatalogEntry | null>(null)

  const pendingCount = useMemo(() => {
    const pendingTeam = Object.values(teamRequests).flatMap(bySlug => Object.values(bySlug)).filter(request => request.status === 'pending').length
    const pendingPersonal = personalRequests.filter(request => request.status === 'pending').length
    return pendingTeam + pendingPersonal
  }, [teamRequests, personalRequests])

  // Mount load: only the catalog, which is all the Catalog/Manage tabs need.
  // The Permissions tab's data (per-team + personal requests) is loaded lazily
  // when that tab is first opened — the per-team fan-out is the slow part.
  const loadPageData = useCallback(async () => {
    if (!org.id) return
    setLoading(true)
    try {
      const catalog = isAdminView ? await listOrgCatalog(org.id) : await listConnectors()
      setConnectors(catalog)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load connector page')
    } finally {
      setLoading(false)
    }
  }, [org.id, isAdminView])

  const loadPermissionsData = useCallback(async () => {
    if (!org.id || !isAdminView) return
    setPermissionsLoading(true)
    try {
      const [personal, teamIndex] = await Promise.all([
        listPersonalRequests(org.id),
        activeTeams.length > 0 ? loadTeamRequestIndex(org.id, activeTeams) : Promise.resolve<TeamRequestIndex>({}),
      ])
      setPersonalRequests(personal)
      setTeamRequests(teamIndex)
      setPermissionsLoaded(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load permissions')
    } finally {
      setPermissionsLoading(false)
    }
  }, [org.id, isAdminView, teams])

  useEffect(() => {
    if (!orgReady || teamsLoading || !org.id) return
    const timer = window.setTimeout(() => { void loadPageData() }, 0)
    return () => window.clearTimeout(timer)
  }, [orgReady, teamsLoading, org.id, loadPageData])

  useEffect(() => {
    if (!orgReady || teamsLoading || !org.id || !isAdminView) return
    if (tab !== 'permissions' || permissionsLoaded || permissionsLoading) return
    const timer = window.setTimeout(() => { void loadPermissionsData() }, 0)
    return () => window.clearTimeout(timer)
  }, [tab, permissionsLoaded, permissionsLoading, orgReady, teamsLoading, org.id, isAdminView, loadPermissionsData])

  if (!orgReady || teamsLoading || loading) {
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
        teams={activeTeams}
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
            teams={activeTeams}
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
              Manage organization connector availability, access approvals, and shared accounts for teams.
            </BodyText>
          </div>
          <Tabs.List>
            {ADMIN_TABS.map(item => (
              <Tabs.Trigger key={item.id} value={item.id}>
                {item.id === 'permissions' && pendingCount > 0 ? (
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
        <Tabs.Content value="catalog">
          <CatalogTab
            orgId={org.id}
            connectors={connectors}
            initialSearch={initialSearch}
            onCatalogUpdated={setConnectors}
          />
        </Tabs.Content>
        <Tabs.Content value="permissions">
          <PermissionsTab
            orgId={org.id}
            connectors={connectors}
            teams={activeTeams}
            personalRequests={personalRequests}
            teamRequests={teamRequests}
            loading={permissionsLoading && !permissionsLoaded}
            onReload={loadPermissionsData}
          />
        </Tabs.Content>
        <Tabs.Content value="manage">
          <ManageConnectorsTab
            connectors={connectors}
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
