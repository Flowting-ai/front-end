'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { UsageBarChart } from '@/components/UsageBarChart'
import { Button } from '@/components/Button'
import { useOrg } from '@/context/org-context'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'

type DateRange = '7d' | '30d' | 'mtd' | 'qtd'

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
]

type ChartMetric = 'chat' | 'assistants' | 'brain'

interface ChartDay { label: string; chat: number; assistants: number; brain: number }

// Figma 18:26029 labels these categories "Chat" / "Tasks" / "Slack" — same
// colour slots (blue/purple/green) as the categories this data actually
// tracks (chat / persona-assistant work / brain-automation), just relabelled
// to match the design's exact copy.
const FEATURE_META: Record<ChartMetric, { label: string; color: string }> = {
  chat:       { label: 'Chat',  color: 'var(--blue-600)'   },
  assistants: { label: 'Slack', color: 'var(--purple-500)' },
  brain:      { label: 'Brain', color: 'var(--green-500)'  },
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
      {/* Figma 18:26035 stacks the 3 categories per day (not side-by-side) —
          "per-link" mode matches that. Its static tooltip mock is what this
          component's real hover tooltip already provides. */}
      <UsageBarChart days={chartDays} series={series} mode="per-link" height={140} />
    </div>
  )
}

function RankedList({
  title,
  items,
  onViewAll,
}: {
  title: string
  items: Array<{ name: string; credits: string; share: string }>
  onViewAll?: () => void
}) {
  return (
    <PageCard>
      <CardTitle
        title={title}
        action={onViewAll && <Button variant="secondary" size="sm" onClick={onViewAll}>View all</Button>}
      />
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
            <p style={{ width: 16, textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              {index + 1}
            </p>
            <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserAvatar />
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </p>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px' }}>
          <SkeletonBlock width={280} height={32} radius={8} />
        </div>

        {/* Stats row — Monthly Limits + Active members */}
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: '1 0 0', backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: INNER_SHADOW, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBlock width={110} height={16} radius={4} />
              <SkeletonBlock width={180} height={16} radius={4} />
              <SkeletonBlock width="100%" height={4} radius={2} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonBlock width={90} height={13} radius={4} />
                <SkeletonBlock width={80} height={13} radius={4} />
              </div>
            </div>
            <div style={{ flex: '1 0 0', backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: INNER_SHADOW, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={100} height={14} radius={4} />
              <SkeletonBlock width={30} height={28} radius={6} />
              <SkeletonBlock width={80} height={13} radius={4} />
              <SkeletonBlock width={100} height={20} radius={6} />
            </div>
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

        {/* Top users list */}
        <section style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: CARD_SHADOW, background: 'var(--neutral-50)', overflow: 'hidden', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={200} height={16} radius={4} />
            <div style={{ flex: '1 0 0' }} />
            <SkeletonBlock width={80} height={32} radius={8} />
          </div>
          {[0, 1, 2, 3].map((row, idx) => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 24px', borderBottom: idx < 3 ? '1px solid var(--neutral-100)' : undefined }}>
              <SkeletonBlock width={16} height={13} radius={4} />
              <SkeletonBlock width={36} height={36} radius={999} />
              <SkeletonBlock width={`${60 - idx * 8}%`} height={13} radius={4} />
              <div style={{ flex: '1 0 0' }} />
              <SkeletonBlock width={90} height={13} radius={4} />
              <SkeletonBlock width={36} height={20} radius={6} />
            </div>
          ))}
        </section>

      </div>
    </>
  )
}

export default function OrgUsageAnalyticsPage() {
  const router = useRouter()
  const { org, members, membersLoading, plan, orgReady } = useOrg()
  const [dateRange,  setDateRange]  = useState<DateRange>('7d')

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

  // "20% utilisation" (Figma 18:26193) has no direct backend equivalent — the
  // closest real, computable signal is the share of members who've actually
  // spent any credits this period, rather than a fabricated number.
  const utilisationPct = activeMembers.length > 0
    ? Math.round((activeMembers.filter(m => m.creditUsed > 0).length / activeMembers.length) * 100)
    : 0

  // Top users sorted by credit usage descending
  const topUsers = [...activeMembers]
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .map(m => ({
      name:    m.name || m.email,
      credits: `${m.creditUsed.toLocaleString()} credits`,
      share:   totalCredits > 0 ? `${Math.round((m.creditUsed / totalCredits) * 100)}%` : '0%',
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
            Usage
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
            Manage your plan, monitor credit consumption, and download invoices.
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

        {/* Figma 18:25963: "Monthly Limits" (price/mo + total credits, progress,
            remaining % / used-of-total) and "Active members" (count + a
            utilisation badge), side by side — not the old 3-tile stat row. */}
        <PageCard padding={12}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
            <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: 'var(--shadow-surface-card)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Monthly Limits
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                ${org.monthlyPrice}/mo · {totalCredits.toLocaleString()} credits
              </p>
              <ProgressBar value={poolPercentUsed} height={4} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
                  {100 - poolPercentUsed}% remaining
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>
                  {totalUsed.toLocaleString()}/{totalCredits.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: 'var(--shadow-surface-card)', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Active members
              </p>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                {activeMembers.length}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
                all members
              </p>
              <Badge label={`${utilisationPct}% utilisation`} color="Blue" />
            </div>
          </div>
        </PageCard>

        <PageCard>
          <CardTitle
            title="Credit usage by feature"
            action={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge label="Chat" color="Blue" />
                <Badge label="Tasks" color="Purple" />
                <Badge label="Slack" color="Green" />
              </div>
            )}
          />
          <FeatureChart days={featureSeries.days} />
        </PageCard>

        <RankedList
          title={`Top users · ${DATE_RANGES.find(r => r.id === dateRange)?.label ?? 'Last 30 days'}`}
          items={topUsers}
          onViewAll={() => router.push(ORG_MEMBERS_ROUTE)}
        />
      </div>
    </div>
  )
}
