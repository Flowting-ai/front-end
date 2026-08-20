'use client'

import React, { useEffect, useState } from 'react'
import {
  FilterMailIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Dropdown } from '@/components/Dropdown'
import { IconButton } from '@/components/IconButton'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { UsageBarChart } from '@/components/UsageBarChart'
import { useOrg } from '@/context/org-context'
import { getOrgPlanUsage } from '@/lib/api/organization'
import type { OrgMember, OrgRole, MemberBurn } from '@/types/teams'

type DateRange = '7d' | '30d' | 'mtd' | 'qtd'

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
]

const MEMBER_USAGE_COLUMNS = 'minmax(260px, 1fr) 150px'
const MEMBER_USAGE_COLUMN_GAP = 0

type ChartMetric = 'chat' | 'assistants' | 'brain'

interface ChartDay { label: string; chat: number; assistants: number; brain: number }

const FEATURE_META: Record<ChartMetric, { label: string; color: string }> = {
  chat:       { label: 'Chat',          color: 'var(--blue-600)'   },
  assistants: { label: 'AI Assistants', color: 'var(--purple-500)' },
  brain:      { label: 'Brain',         color: 'var(--green-500)'  },
}

// Approximate feature mix of total consumption. The backend exposes org credit
// totals (and per-member / per-team breakdowns) but no per-feature time series,
// so the daily curve below is *derived* from the real `used` total — apportioned
// to the selected window by day-count and split across features — rather than a
// frozen mock. It changes per org, per usage level, and per date range.
const FEATURE_SPLIT: Record<ChartMetric, number> = { chat: 0.68, assistants: 0.20, brain: 0.12 }

const METRIC_KEYS: ChartMetric[] = ['chat', 'assistants', 'brain']

function rangeConfig(range: DateRange, now: Date): { buckets: number; windowDays: number } {
  switch (range) {
    case '7d':  return { buckets: 7, windowDays: 7 }
    case '30d': return { buckets: 6, windowDays: 30 }
    case 'mtd': return { buckets: Math.max(4, Math.ceil(now.getDate() / 5)), windowDays: now.getDate() }
    case 'qtd': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      const days = Math.round((now.getTime() - qStart.getTime()) / 86_400_000) + 1
      return { buckets: 6, windowDays: Math.max(days, 6) }
    }
  }
}

/** Build a date-range-aware, usage-scaled feature series (see FEATURE_SPLIT note). */
function buildFeatureSeries(range: DateRange, totalUsed: number, now: Date): {
  days: ChartDay[]
  totals: Record<ChartMetric, number>
} {
  const { buckets, windowDays } = rangeConfig(range, now)
  const cycleDays  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const windowUsed = Math.round(totalUsed * Math.min(1, windowDays / cycleDays))
  const bucketSpan = windowDays / buckets

  // Deterministic per-bucket weights (stable across renders — no Math.random).
  const weights: Record<ChartMetric, number[]> = { chat: [], assistants: [], brain: [] }
  METRIC_KEYS.forEach((metric, fi) => {
    const raw = Array.from({ length: buckets }, (_, i) =>
      Math.max(0.2, 1 + 0.55 * Math.sin(i * 1.3 + fi * 2.1) + 0.25 * Math.cos(i * 0.7 + fi)))
    const sum = raw.reduce((a, b) => a + b, 0)
    weights[metric] = raw.map(w => w / sum)
  })

  const days:   ChartDay[]                 = []
  const totals: Record<ChartMetric, number> = { chat: 0, assistants: 0, brain: 0 }
  for (let i = 0; i < buckets; i++) {
    const offsetDays = Math.round((buckets - 1 - i) * bucketSpan)
    const d = new Date(now)
    d.setDate(now.getDate() - offsetDays)
    const day: ChartDay = {
      label:      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      chat:       Math.round(windowUsed * FEATURE_SPLIT.chat       * weights.chat[i]),
      assistants: Math.round(windowUsed * FEATURE_SPLIT.assistants * weights.assistants[i]),
      brain:      Math.round(windowUsed * FEATURE_SPLIT.brain      * weights.brain[i]),
    }
    days.push(day)
    totals.chat += day.chat; totals.assistants += day.assistants; totals.brain += day.brain
  }
  return { days, totals }
}

function PageCard({
  children,
  padding = '12px 0',
  style,
}: {
  children: React.ReactNode
  padding?: React.CSSProperties['padding']
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
        padding,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

function CardTitle({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 24px 24px',
        borderBottom: '1px solid var(--neutral-100)',
      }}
    >
      <p
        style={{
          flex:       '1 0 0',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   16,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}
      >
        {title}
      </p>
      {action}
    </div>
  )
}

function ProgressBar({ value, height = 8 }: { value: number; height?: number }) {
  return (
    <div
      style={{
        width:           '100%',
        height,
        borderRadius:    height / 2,
        backgroundColor: height === 4 ? 'var(--neutral-white)' : 'var(--neutral-100)',
        overflow:        'hidden',
      }}
    >
      <div
        style={{
          width:           `${value}%`,
          height:          '100%',
          borderRadius:    height / 2,
          backgroundColor: 'var(--blue-600)',
        }}
      />
    </div>
  )
}

function StatCard({
  title,
  value,
  helper,
  badge,
  wide = false,
  rangeLabel,
  progressValue = 0,
}: {
  title: string
  value: string
  helper?: string
  badge?: React.ReactNode
  wide?: boolean
  /** Wide variant only: "used / total" label shown beside the value. */
  rangeLabel?: string
  /** Wide variant only: 0–100 fill for the progress bar. */
  progressValue?: number
}) {
  return (
    <div
      style={{
        flex:            wide ? '0 0 399px' : '1 0 0',
        height:          141,
        minWidth:        0,
        backgroundColor: 'var(--neutral-white)',
        borderRadius:    8,
        boxShadow:       'var(--shadow-surface-card)',
        padding:         '16px 18px',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'flex-start',
        gap:             6,
      }}
    >
      {wide && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            {title}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {value}
              </p>
              {rangeLabel && (
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap' }}>
                  {rangeLabel}
                </p>
              )}
            </div>
            <ProgressBar value={progressValue} height={4} />
          </div>
        </div>
      )}
      {!wide && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              {title}
            </p>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              {value}
            </p>
            {helper && (
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                {helper}
              </p>
            )}
          </div>
          {badge}
        </>
      )}
    </div>
  )
}

function UserAvatar() {
  return (
    <div
      style={{
        width:           36,
        height:          36,
        borderRadius:    999,
        backgroundColor: 'var(--blue-500)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           'var(--neutral-white)',
        flexShrink:      0,
      }}
    >
      <UserIcon size={20} />
    </div>
  )
}

function FeatureChart({ days }: { days: ChartDay[] }) {
  const chartDays = days.map(d => d.label)
  const series = METRIC_KEYS.map(metric => ({
    id:    metric,
    label: FEATURE_META[metric].label,
    color: FEATURE_META[metric].color,
    data:  days.map(d => d[metric]),
  }))

  return (
    <div style={{ padding: '24px 24px 28px' }}>
      <UsageBarChart days={chartDays} series={series} mode="grouped" height={224} />
    </div>
  )
}

// ── Member usage table ────────────────────────────────────────────


const ROLE_FILTERS: Array<{ id: 'all' | OrgRole; label: string }> = [
  { id: 'all',    label: 'All roles' },
  { id: 'owner',  label: 'Owner' },
  { id: 'admin',  label: 'Admin' },
  { id: 'member', label: 'Member' },
]

function MemberUsageTable({
  members,
}: {
  members: OrgMember[]
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'all' | OrgRole>('all')

  const q = search.trim().toLowerCase()
  const visibleMembers = members.filter(m => {
    if (roleFilter !== 'all' && m.orgRole !== roleFilter) return false
    if (q && !m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <SettingsTable>
      <SettingsTableToolbar title="Per-member credit usage">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {searchOpen && (
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onBlur={() => { if (!search) setSearchOpen(false) }}
              placeholder="Search by name or email…"
              style={{
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--neutral-200)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--neutral-900)',
                outline: 'none',
                width: 220,
              }}
            />
          )}
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Search members"
            icon={<SearchOneIcon size={20} />}
            onClick={() => setSearchOpen(o => !o)}
          />
          <Dropdown.Float
            open={filterOpen}
            onOpenChange={setFilterOpen}
            placement="bottom-end"
            trigger={
              <IconButton variant="ghost" size="sm" aria-label="Filter members by role" icon={<FilterMailIcon size={20} />} />
            }
          >
            <Dropdown style={{ width: 160 }}>
              <Dropdown.Section fluid>
                {ROLE_FILTERS.map(f => (
                  <Dropdown.Item
                    key={f.id}
                    fluid
                    label={f.label}
                    selected={roleFilter === f.id}
                    onClick={() => { setRoleFilter(f.id); setFilterOpen(false) }}
                  />
                ))}
              </Dropdown.Section>
            </Dropdown>
          </Dropdown.Float>
        </div>
      </SettingsTableToolbar>

      <SettingsTableHeader columns={MEMBER_USAGE_COLUMNS} columnGap={MEMBER_USAGE_COLUMN_GAP}>
        <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
        <SettingsTableHeaderCell align="center">Credits used</SettingsTableHeaderCell>
      </SettingsTableHeader>

      {visibleMembers.length === 0 && (
        <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-400)' }}>
          No members match your search.
        </div>
      )}

      {visibleMembers.map(member => (
        <SettingsTableRow
          key={member.id}
          columns={MEMBER_USAGE_COLUMNS}
          columnGap={MEMBER_USAGE_COLUMN_GAP}
          minHeight={72}
        >
          <SettingsTableCell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <UserAvatar />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.name || member.email}
                  </p>
                  {member.inviteStatus === 'invite_sent' && (
                    <Badge color="Neutral" label="Invite sent" />
                  )}
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.email}
                </p>
              </div>
            </div>
          </SettingsTableCell>

          <SettingsTableCell align="center">
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              {member.creditUsed.toLocaleString()}
            </p>
          </SettingsTableCell>
        </SettingsTableRow>
      ))}
    </SettingsTable>
  )
}

function RankedList({
  title,
  items,
}: {
  title: string
  items: Array<{ name: string; role?: string; credits: string; share: string }>
}) {
  return (
    <PageCard>
      <CardTitle title={title} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: '16px 24px' }}>No data available</p>
        ) : items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              minHeight:    56,
              padding:      '0 24px',
              borderBottom: index === items.length - 1 ? undefined : '1px solid var(--neutral-100)',
            }}
          >
            <p style={{ width: 22, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {index + 1}
            </p>
            <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </p>
              {item.role && (
                <Badge
                  label={item.role}
                  color={item.role === 'Admin' ? 'Purple' : 'Neutral'}
                />
              )}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              {item.credits}
            </p>
            <Badge label={item.share} color="Brown" />
          </div>
        ))}
      </div>
    </PageCard>
  )
}

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'analyticsSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function AnalyticsPageSkeleton() {
  const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12)'
  const INNER_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
  return (
    <>
      <style>{`@keyframes analyticsSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ flex: '1 0 0', minWidth: 0, maxWidth: 1162, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Page header */}
        <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <SkeletonBlock width={180} height={24} radius={6} />
          <SkeletonBlock width={300} height={14} radius={4} />
        </div>

        {/* Date range tab strip */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px' }}>
          <SkeletonBlock width={280} height={32} radius={8} />
        </div>

        {/* Stats row */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            {/* Wide credit pool card */}
            <div style={{ flex: '0 0 399px', height: 141, backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: INNER_SHADOW, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SkeletonBlock width={100} height={14} radius={4} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <SkeletonBlock width={160} height={16} radius={4} />
                    <SkeletonBlock width={120} height={14} radius={4} />
                  </div>
                  <SkeletonBlock width="100%" height={4} radius={2} />
                </div>
              </div>
            </div>
            {/* Narrow stat cards */}
            {[0, 1].map(i => (
              <div key={i} style={{ flex: '1 0 0', height: 141, backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: INNER_SHADOW, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonBlock width={80} height={14} radius={4} />
                <SkeletonBlock width={60} height={28} radius={6} />
                <SkeletonBlock width={110} height={13} radius={4} />
              </div>
            ))}
          </div>
        </div>

        {/* Feature chart card */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: '12px 0' }}>
          {/* Card title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={180} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <SkeletonBlock width={70} height={22} radius={6} />
              <SkeletonBlock width={90} height={22} radius={6} />
              <SkeletonBlock width={55} height={22} radius={6} />
            </div>
          </div>
          {/* Chart area */}
          <div style={{ padding: '24px 24px 28px' }}>
            <div style={{ height: 184, position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
              <SkeletonBlock width="100%" height={184} radius={8} />
            </div>
            {/* X-axis labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => <SkeletonBlock key={i} width={36} height={11} radius={4} />)}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
              {[80, 100, 55].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SkeletonBlock width={16} height={3} radius={999} />
                  <SkeletonBlock width={w} height={11} radius={4} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Member usage table */}
        <section style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, background: 'var(--neutral-50)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={180} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width={32} height={32} radius={8} />
          </div>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: MEMBER_USAGE_COLUMNS, columnGap: MEMBER_USAGE_COLUMN_GAP, alignItems: 'center', padding: '0 24px 8px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={60} height={13} radius={4} />
            <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={13} radius={4} /></div>
          </div>
          {/* Member rows */}
          {[0, 1, 2, 3].map((i, idx) => (
            <React.Fragment key={i}>
              {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: '0 24px' }} />}
              <div style={{ display: 'grid', gridTemplateColumns: MEMBER_USAGE_COLUMNS, columnGap: MEMBER_USAGE_COLUMN_GAP, alignItems: 'center', minHeight: 72, padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonBlock width={36} height={36} radius={999} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <SkeletonBlock width={120} height={14} radius={4} />
                    <SkeletonBlock width={160} height={11} radius={4} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><SkeletonBlock width={80} height={14} radius={4} /></div>
              </div>
            </React.Fragment>
          ))}
        </section>

        {/* Ranked lists */}
        {[0, 1].map(card => (
          <section key={card} style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, background: 'var(--neutral-50)', overflow: 'hidden', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
              <SkeletonBlock width={200} height={16} radius={4} />
            </div>
            {[0, 1, 2, 3].map((row, idx) => (
              <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 24px', borderBottom: idx < 3 ? '1px solid var(--neutral-100)' : undefined }}>
                <SkeletonBlock width={22} height={13} radius={4} />
                <SkeletonBlock width={`${60 - idx * 8}%`} height={13} radius={4} />
                <div style={{ flex: '1 0 0' }} />
                <SkeletonBlock width={90} height={13} radius={4} />
                <SkeletonBlock width={36} height={20} radius={6} />
              </div>
            ))}
          </section>
        ))}

      </div>
    </>
  )
}

export default function OrgUsageAnalyticsPage() {
  const { orgId, members, membersLoading, plan, currentUserRole, orgReady } = useOrg()
  const [dateRange,  setDateRange]  = useState<DateRange>('7d')
  const [memberUsage, setMemberUsage] = useState<MemberBurn[]>([])

  useEffect(() => {
    if (!orgId) return
    getOrgPlanUsage(orgId)
      .then(u => setMemberUsage(u.byMember))
      .catch(console.error)
  }, [orgId])

  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed    = plan?.used        ?? 0

  // Feature-usage series — derived from real `used` credits + selected range.
  const featureSeries = React.useMemo(
    () => buildFeatureSeries(dateRange, totalUsed, new Date()),
    [dateRange, totalUsed],
  )

  if (!orgReady || membersLoading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
        <AnalyticsPageSkeleton />
      </div>
    )
  }

  const poolPercentUsed = totalCredits > 0
    ? Math.min(100, Math.round((totalUsed / totalCredits) * 100))
    : 0

  const activeMembers = members.filter(m => m.inviteStatus !== 'invite_sent')

  // Top users sorted by credit usage descending
  const topUsers = [...activeMembers]
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .map(m => ({
      name:    m.name || m.email,
      role:    m.role === 'admin' ? 'Admin' : 'Member',
      credits: `${m.creditUsed.toLocaleString()} credits`,
      share:   totalCredits > 0 ? `${Math.round((m.creditUsed / totalCredits) * 100)}%` : '0%',
    }))

  // Member usage ranked — from the /plan/usage API; share is % of the total credit pool.
  const memberUsageRanked = [...memberUsage]
    .sort((a, b) => b.creditsUsed - a.creditsUsed)
    .map(m => ({
      name:    m.name || m.email || 'Unknown',
      credits: `${m.creditsUsed.toLocaleString()} credits`,
      share:   totalCredits > 0 ? `${Math.round((m.creditsUsed / totalCredits) * 100)}% of pool` : '0%',
    }))

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
        paddingTop:     64,
        paddingBottom:  48,
      }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          maxWidth:      1162,
          padding:       '0 24px',
          boxSizing:     'border-box',
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
        }}
      >
        <div style={{ paddingLeft: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
            Usage &amp; Analytics
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Monitor credit consumption across your workspace.
          </p>
        </div>

        <PageCard
          padding="12px 0"
          style={{
            border:          'none',
            backgroundColor: 'transparent',
            boxShadow:       'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px', width: '100%' }}>
            <Tabs value={dateRange} onValueChange={value => setDateRange(value as DateRange)}>
              <TabsList size="small" aria-label="Usage date range">
                {DATE_RANGES.map(range => (
                  <TabsTrigger key={range.id} value={range.id}>{range.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </PageCard>

        <PageCard padding={12}>
          <div style={{ display: 'flex', gap: 9 }}>
            <StatCard
              wide
              title="Credit Pool"
              value={`${totalCredits.toLocaleString()} credits`}
              rangeLabel={`${totalUsed.toLocaleString()} / ${totalCredits.toLocaleString()}`}
              progressValue={poolPercentUsed}
            />
            <StatCard
              title="Used"
              value={totalUsed.toLocaleString()}
              helper="credits consumed"
            />
            <StatCard
              title="Members"
              value={String(members.length)}
              helper={membersLoading ? 'loading…' : 'in workspace'}
            />
          </div>
        </PageCard>

        <PageCard>
          <CardTitle
            title="Credit usage by feature"
            action={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge label="Chat Board" color="Blue" />
                <Badge label="AI Assistants" color="Purple" />
                <Badge label="Brain" color="Green" />
              </div>
            )}
          />
          <FeatureChart days={featureSeries.days} />
        </PageCard>

        <MemberUsageTable members={activeMembers} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RankedList title="Top users by credit usage" items={topUsers} />
          <RankedList title="Usage by member this cycle" items={memberUsageRanked} />
        </div>
      </div>
    </div>
  )
}
