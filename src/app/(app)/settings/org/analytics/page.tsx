'use client'

import React, { useEffect, useState } from 'react'
import {
  FilterMailIcon,
  PlusSignIcon,
  SearchOneIcon,
  UserIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
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

const CHART_DAYS = [
  { label: 'May 6',  chat: 116, assistants: 18, brain: 10 },
  { label: 'May 7',  chat: 94,  assistants: 22, brain: 14 },
  { label: 'May 8',  chat: 142, assistants: 28, brain: 18 },
  { label: 'May 9',  chat: 72,  assistants: 16, brain: 8  },
  { label: 'May 10', chat: 158, assistants: 34, brain: 20 },
  { label: 'May 11', chat: 104, assistants: 24, brain: 12 },
  { label: 'May 12', chat: 132, assistants: 30, brain: 16 },
]

type ChartMetric = 'chat' | 'assistants' | 'brain'

const CHART_METRICS: Record<ChartMetric, { label: string; color: string; value: string }> = {
  chat:       { label: 'Chat',          color: 'var(--blue-600)',   value: '300 credits' },
  assistants: { label: 'AI Assistants', color: 'var(--purple-500)', value: '90 credits'  },
  brain:      { label: 'Brain',         color: 'var(--green-500)',  value: '40 credits'  },
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
}: {
  title: string
  value: string
  helper?: string
  badge?: React.ReactNode
  wide?: boolean
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
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap' }}>
                41,200 / 60,000
              </p>
            </div>
            <ProgressBar value={51.25} height={4} />
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

function FeatureChart() {
  const [hovered, setHovered] = useState<{ day: string; metric: ChartMetric; x: number; y: number } | null>(null)
  const tooltip = hovered ? CHART_METRICS[hovered.metric] : null
  const chartWidth = 760
  const chartHeight = 184
  const chartPaddingX = 28
  const chartPaddingY = 18
  const plotWidth = chartWidth - chartPaddingX * 2
  const maxValue = Math.max(...CHART_DAYS.flatMap(day => [day.chat, day.assistants, day.brain]))
  const metrics = Object.keys(CHART_METRICS) as ChartMetric[]

  const getPoint = (dayIndex: number, metric: ChartMetric) => {
    const day = CHART_DAYS[dayIndex]
    const value = day[metric]
    const x = chartPaddingX + (plotWidth / (CHART_DAYS.length - 1)) * dayIndex
    const y = chartHeight - chartPaddingY - (value / maxValue) * (chartHeight - chartPaddingY * 2)

    return { x, y, value, day: day.label }
  }

  const makeWavePath = (metric: ChartMetric) => {
    const points = CHART_DAYS.map((_, index) => getPoint(index, metric))

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
        {hovered && tooltip && (
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
            <span style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: tooltip.color, flexShrink: 0 }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 500 }}>{tooltip.label}</span>
              <span style={{ fontWeight: 400 }}>{tooltip.value}</span>
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
              stroke={CHART_METRICS[metric].color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hovered && hovered.metric !== metric ? 0.35 : 1}
            />
          ))}

          {metrics.map(metric => (
            <g key={`${metric}-points`}>
              {CHART_DAYS.map((_, index) => {
                const point = getPoint(index, metric)

                return (
                  <g key={`${metric}-${point.day}`}>
                    {hovered?.day === point.day && hovered.metric === metric && (
                      <circle cx={point.x} cy={point.y} r={5} fill={CHART_METRICS[metric].color} stroke="var(--neutral-white)" strokeWidth={2} />
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={10}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHovered({ day: point.day, metric, x: point.x, y: point.y })}
                    />
                  </g>
                )
              })}
            </g>
          ))}
        </svg>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 18 }}>
          {CHART_DAYS.map(day => (
            <span
              key={day.label}
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
              <span style={{ width: 16, height: 3, borderRadius: 999, backgroundColor: CHART_METRICS[metric].color }} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)' }}>
                {CHART_METRICS[metric].label}
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
          <FeatureChart />
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
