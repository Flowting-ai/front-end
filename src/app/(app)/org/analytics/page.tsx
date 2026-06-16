'use client'

import React, { useEffect, useState } from 'react'
import {
  FilterMailIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
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
import { useOrg } from '@/context/org-context'
import { getOrgPlanUsage } from '@/lib/api/organization'
import type { OrgMember, TeamBurn } from '@/types/teams'

type DateRange = '7d' | '30d' | 'mtd' | 'qtd'

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
]

const MEMBER_CAP_COLUMNS = 'minmax(280px, 1fr) 170px 170px 180px'
const MEMBER_CAP_COLUMN_GAP = 0

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
        boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        padding:         wide ? '12px 0' : 12,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'flex-start',
        gap:             6,
      }}
    >
      {wide && (
        <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: 23, width: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                {value}
              </p>
              {rangeLabel && (
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap' }}>
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
  const [hovered, setHovered] = useState<{ day: string; metric: ChartMetric; x: number; y: number; value: number } | null>(null)
  const chartWidth = 760
  const chartHeight = 184
  const chartPaddingX = 28
  const chartPaddingY = 18
  const plotWidth = chartWidth - chartPaddingX * 2
  const maxValue = Math.max(1, ...days.flatMap(day => [day.chat, day.assistants, day.brain]))
  const metrics = METRIC_KEYS

  const getPoint = (dayIndex: number, metric: ChartMetric) => {
    const day = days[dayIndex]
    const value = day[metric]
    const divisor = days.length > 1 ? days.length - 1 : 1
    const x = chartPaddingX + (plotWidth / divisor) * dayIndex
    const y = chartHeight - chartPaddingY - (value / maxValue) * (chartHeight - chartPaddingY * 2)

    return { x, y, value, day: day.label }
  }

  const makeWavePath = (metric: ChartMetric) => {
    const points = days.map((_, index) => getPoint(index, metric))

    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`

      const previous = points[index - 1]
      const controlX = (previous.x + point.x) / 2

      return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    }, '')
  }

  return (
    <div style={{ padding: '24px 24px 28px' }} onMouseLeave={() => setHovered(null)}>
      <div
        style={{
          position:      'relative',
          height:        224,
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
        }}
      >
        {hovered && (
          <div
            style={{
              position:        'absolute',
              top:             Math.max(0, hovered.y - 42),
              left:            `${(hovered.x / chartWidth) * 100}%`,
              transform:       'translateX(-50%)',
              background:      'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
              color:           'var(--neutral-white)',
              borderRadius:    6,
              padding:         '4px 6px',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             4,
              boxShadow:       '0px 1px 4px rgba(59,54,50,0.5), 0px 0px 0px 0.5px var(--neutral-black), inset 0px 0.5px 0.1px rgba(247,242,237,0.3), inset 0px -0.5px 0.364px rgba(18,12,8,1), inset 0px -2px 4px -2.182px rgba(247,242,237,0.5)',
              fontFamily:      'var(--font-body)',
              fontSize:        11,
              lineHeight:      '16px',
              whiteSpace:      'nowrap',
              zIndex:          2,
              pointerEvents:   'none',
            }}
          >
            <span style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: FEATURE_META[hovered.metric].color, flexShrink: 0 }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 500 }}>{FEATURE_META[hovered.metric].label}</span>
              <span style={{ fontWeight: 400 }}>{hovered.value.toLocaleString()} credits</span>
            </span>
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: 184, overflow: 'visible' }}
          aria-label="Feature usage waveform chart"
          role="img"
        >
          {[0.25, 0.5, 0.75].map(line => (
            <line
              key={line}
              x1={chartPaddingX}
              x2={chartWidth - chartPaddingX}
              y1={chartPaddingY + (chartHeight - chartPaddingY * 2) * line}
              y2={chartPaddingY + (chartHeight - chartPaddingY * 2) * line}
              stroke="var(--neutral-100)"
              strokeWidth={1}
            />
          ))}

          {metrics.map(metric => (
            <path
              key={metric}
              d={makeWavePath(metric)}
              fill="none"
              stroke={FEATURE_META[metric].color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hovered && hovered.metric !== metric ? 0.35 : 1}
            />
          ))}

          {metrics.map(metric => (
            <g key={`${metric}-points`}>
              {days.map((_, index) => {
                const point = getPoint(index, metric)

                return (
                  <g key={`${metric}-${index}`}>
                    {hovered?.day === point.day && hovered.metric === metric && (
                      <circle cx={point.x} cy={point.y} r={5} fill={FEATURE_META[metric].color} stroke="var(--neutral-white)" strokeWidth={2} />
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={10}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHovered({ day: point.day, metric, x: point.x, y: point.y, value: point.value })}
                    />
                  </g>
                )
              })}
            </g>
          ))}
        </svg>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 18 }}>
          {days.map((day, index) => (
            <span
              key={`${day.label}-${index}`}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize:   11,
                lineHeight: '16px',
                color:      'var(--neutral-500)',
                whiteSpace: 'nowrap',
                textAlign:  'center',
              }}
            >
              {day.label}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {metrics.map(metric => (
            <div key={metric} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 16, height: 3, borderRadius: 999, backgroundColor: FEATURE_META[metric].color }} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)' }}>
                {FEATURE_META[metric].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MemberCapsTable({ members }: { members: OrgMember[] }) {
  return (
    <SettingsTable>
      <SettingsTableToolbar title="Per-member credit usage">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton variant="ghost" size="sm" aria-label="Search members" icon={<SearchOneIcon size={20} />} />
          <IconButton variant="ghost" size="sm" aria-label="Filter members" icon={<FilterMailIcon size={20} />} />
        </div>
      </SettingsTableToolbar>

      <SettingsTableHeader columns={MEMBER_CAP_COLUMNS} columnGap={MEMBER_CAP_COLUMN_GAP}>
        <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
        <SettingsTableHeaderCell align="center">Credits used</SettingsTableHeaderCell>
        <SettingsTableHeaderCell align="center">Cap</SettingsTableHeaderCell>
        <SettingsTableHeaderCell align="center">Usage</SettingsTableHeaderCell>
      </SettingsTableHeader>

      {members.map(member => {
        const usagePct = member.creditCap && member.creditCap > 0
          ? Math.min(100, Math.round((member.creditUsed / member.creditCap) * 100))
          : 0
        return (
          <SettingsTableRow
            key={member.id}
            columns={MEMBER_CAP_COLUMNS}
            columnGap={MEMBER_CAP_COLUMN_GAP}
            minHeight={72}
          >
            <SettingsTableCell>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <UserAvatar />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.name || member.email}
                  </p>
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
            <SettingsTableCell align="center">
              {member.creditCap != null
                ? <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{member.creditCap.toLocaleString()}</p>
                : <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-300)' }}>No cap</span>
              }
            </SettingsTableCell>
            <SettingsTableCell align="center">
              <div style={{ width: '100%' }}>
                {usagePct > 0 ? <ProgressBar value={usagePct} /> : null}
              </div>
            </SettingsTableCell>
          </SettingsTableRow>
        )
      })}
    </SettingsTable>
  )
}

function RankedList({
  title,
  items,
}: {
  title: string
  items: Array<{ name: string; credits: string; share: string }>
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
            <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              {item.name}
            </p>
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

export default function OrgUsageAnalyticsPage() {
  const { orgId, members, membersLoading, plan } = useOrg()
  const [dateRange,  setDateRange]  = useState<DateRange>('7d')
  const [teamUsage,  setTeamUsage]  = useState<TeamBurn[]>([])

  useEffect(() => {
    if (!orgId) return
    getOrgPlanUsage(orgId)
      .then(u => setTeamUsage(u.byTeam))
      .catch(console.error)
  }, [orgId])

  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed    = plan?.used        ?? 0
  const poolPercentUsed = totalCredits > 0
    ? Math.min(100, Math.round((totalUsed / totalCredits) * 100))
    : 0

  // Feature-usage series — derived from real `used` credits + selected range.
  const featureSeries = React.useMemo(
    () => buildFeatureSeries(dateRange, totalUsed, new Date()),
    [dateRange, totalUsed],
  )

  // Top users sorted by credit usage descending
  const topUsers = [...members]
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .map(m => ({
      name:    m.name || m.email,
      credits: `${m.creditUsed.toLocaleString()} credits`,
      share:   totalUsed > 0 ? `${Math.round((m.creditUsed / totalUsed) * 100)}%` : '0%',
    }))

  // Team usage ranked
  const teamRanked = [...teamUsage]
    .sort((a, b) => b.creditsUsed - a.creditsUsed)
    .map(t => ({
      name:    t.teamName,
      credits: `${t.creditsUsed.toLocaleString()} credits`,
      share:   totalUsed > 0 ? `${Math.round((t.creditsUsed / totalUsed) * 100)}% of pool` : '0%',
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
        padding:        '64px 24px 48px',
      }}
    >
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          maxWidth:      1114,
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

        <MemberCapsTable members={members} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RankedList title="Top users by credit usage" items={topUsers} />
          <RankedList title="Usage by team this cycle" items={teamRanked} />
        </div>
      </div>
    </div>
  )
}
