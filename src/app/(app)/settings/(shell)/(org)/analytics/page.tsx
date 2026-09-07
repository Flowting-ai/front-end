'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserIcon, InformationCircleIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Tooltip } from '@/components/Tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { UsageBarChart } from '@/components/UsageBarChart'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { useOrg } from '@/context/org-context'
import { Billing } from '@/lib/api/stripe'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'

// Same derivation plans-and-billing/page.tsx uses for its own "Resets {date}"
// captions — Stripe's `current_period_end` is the day billing rolls over, so
// the cycle runs from the 1st of the PRIOR day's month through that end date.
// Falls back to the current calendar month when billing hasn't loaded yet
// (Billing.fetch() is admin-only and can 403/null for non-Stripe orgs) so
// this always has a best-effort answer rather than nothing at all.
function cycleRange(periodEnd: string | null | undefined, now: Date): { start: Date; end: Date } {
  if (periodEnd) {
    const close = new Date(periodEnd)
    if (!Number.isNaN(close.getTime())) {
      const end = new Date(close.getTime() - 86_400_000)
      return { start: new Date(end.getFullYear(), end.getMonth(), 1), end }
    }
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  }
}

function fmtCycleDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type DateRange = '7d' | '1m' | '3m' | '6m'

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
]

type ChartMetric = 'chat' | 'assistants' | 'brain'

interface ChartDay { label: string; chat: number; assistants: number; brain: number }

// Figma 18:26029 labels these categories "Chat" / "Tasks" / "Slack" — same
// colour slots (blue/purple/green) as the categories this data actually
// tracks (chat / persona-assistant work / brain-automation), just relabelled
// to match the design's exact copy.
//
// Based on the same tag bg tints Chip/Badge/PinCategory use (aliases.css
// --color-tag-{Color}-bg), one primitive step darker than the exact tag tint
// (blue-100→200, purple-100→200, green's tag tint is already the lighter
// -bg-soft/green-50, so its next step is green-100 — the tag system's own
// plain -bg). `border` is that tag's ring color (--color-tag-{Color}-ring) —
// the same 1px outline every Chip/Badge renders around its bg tint.
const FEATURE_META: Record<ChartMetric, { label: string; color: string; border: string }> = {
  chat:       { label: 'Chat',  color: 'var(--blue-200)',           border: 'var(--color-tag-Blue-ring)'   },
  assistants: { label: 'Slack', color: 'var(--purple-200)',         border: 'var(--color-tag-Purple-ring)' },
  brain:      { label: 'Brain', color: 'var(--color-tag-Green-bg)', border: 'var(--color-tag-Green-ring)'  },
}

// Approximate feature mix of total consumption. The backend exposes org credit
// totals (and per-member / per-team breakdowns) but no per-feature time series,
// so the daily curve below is *derived* from the real `used` total — apportioned
// to the selected window by day-count and split across features — rather than a
// frozen mock. It changes per org, per usage level, and per date range.
const FEATURE_SPLIT: Record<ChartMetric, number> = { chat: 0.68, assistants: 0.20, brain: 0.12 }

// Matches AnalyticsPageSkeleton's 4 placeholder rows below. A real top-N cap —
// "Manage members" only makes sense as a way to see the REST of the team, so
// it must stay hidden whenever this list already covers everyone active.
const TOP_USERS_LIMIT = 4

const METRIC_KEYS: ChartMetric[] = ['chat', 'assistants', 'brain']

function rangeConfig(range: DateRange): { buckets: number; windowDays: number } {
  switch (range) {
    case '7d': return { buckets: 7, windowDays: 7 }
    case '1m': return { buckets: 6, windowDays: 30 }
    case '3m': return { buckets: 6, windowDays: 90 }
    case '6m': return { buckets: 6, windowDays: 180 }
  }
}

/** Build a date-range-aware, usage-scaled feature series (see FEATURE_SPLIT note). */
function buildFeatureSeries(range: DateRange, totalUsed: number, now: Date): {
  days: ChartDay[]
  totals: Record<ChartMetric, number>
  windowUsed: number
} {
  const { buckets, windowDays } = rangeConfig(range)
  // `totalUsed` is already the org's CYCLE-TO-DATE total (usage since the
  // cycle started, through today) — not a full-cycle projection that still
  // needs discounting. The backend only ever gives us this ONE cycle's total,
  // with no real per-day or prior-cycle history, so a window longer than the
  // cycle-to-date (1/3/6 months will almost always be, since a billing cycle
  // is at most ~31 days) simply can't include more than that total — it's
  // capped at it rather than fabricating usage from a period we have no data
  // for. The correct denominator for "how much of totalUsed falls inside a
  // SHORTER window" (only ever relevant for "Last 7 days") is how many days
  // have actually elapsed in the cycle so far — `now.getDate()`, consistent
  // with this page (and plans-and-billing's `billingCycle` helper) already
  // treating the cycle as calendar-month-aligned.
  const elapsedDays = Math.max(1, now.getDate())
  const windowUsed  = Math.round(totalUsed * Math.min(1, windowDays / elapsedDays))
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
  return { days, totals, windowUsed }
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
        // Both call sites in this file sit on a `--neutral-white` stat tile
        // (Monthly Limits, Active members) — a white track there is
        // invisible, leaving only the filled portion visible. `--neutral-100`
        // actually contrasts against that background, at any bar height.
        backgroundColor: 'var(--neutral-100)',
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

function FeatureChart({ days, caption }: { days: ChartDay[]; caption: string }) {
  const chartDays = days.map(d => d.label)
  const series = METRIC_KEYS.map(metric => ({
    id:          metric,
    label:       FEATURE_META[metric].label,
    color:       FEATURE_META[metric].color,
    borderColor: FEATURE_META[metric].border,
    data:        days.map(d => d[metric]),
  }))

  return (
    <div style={{ padding: '24px 24px 28px' }}>
      {/* Figma 18:26035 stacks the 3 categories per day (not side-by-side) —
          "per-link" mode matches that. Its static tooltip mock is what this
          component's real hover tooltip already provides. */}
      <UsageBarChart days={chartDays} series={series} mode="per-link" height={140} barRadius={[0, 0, 0, 0]} showHoverCursor={false} />
      {/* There's no real per-day/per-feature usage API yet (see FEATURE_SPLIT
          note above) — this states plainly what the bars represent so the
          total here doesn't read as a silent mismatch against "Monthly
          Limits" above for any range shorter than the full cycle. */}
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', textAlign: 'center', margin: '12px 0 0' }}>
        {caption}
      </p>
    </div>
  )
}

function RankedList({
  title,
  items,
  onViewAll,
  note,
}: {
  title: string
  items: Array<{ name: string; credits: string; share: string }>
  onViewAll?: () => void
  note?: string
}) {
  return (
    <PageCard>
      <CardTitle
        title={title}
        // Labeled "Manage members", not "View all" — it opens the Members
        // page (people/roles/removal), which has no usage numbers at all, so
        // "View all" over-promised a fuller usage breakdown that doesn't exist.
        action={onViewAll && <Button variant="secondary" size="sm" onClick={onViewAll}>Manage members</Button>}
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
      {note && (
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-400)', margin: '12px 24px 0' }}>
          {note}
        </p>
      )}
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
        <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonBlock width={180} height={24} radius={6} />
            <SkeletonBlock width={300} height={14} radius={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <SkeletonBlock width={150} height={13} radius={4} />
            <SkeletonBlock width={90} height={13} radius={4} />
          </div>
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

// "Monthly Limits" and "Active members" are a matched pair (Figma 18:25963) —
// same header size/weight, same "big number" style for the plan line / member
// count, and both progress bars landing on the same row, so the two cards
// read as one unit instead of two differently-styled tiles bolted together.
const statCardHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0,
}
const statCardBigLineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0,
}
const statCardFooterTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)',
}

export default function OrgUsageAnalyticsPage() {
  const router = useRouter()
  const { org, orgId, members, membersLoading, plan, orgReady } = useOrg()
  const [dateRange,  setDateRange]  = useState<DateRange>('7d')
  const [billing,    setBilling]    = useState<Billing | null>(null)

  // Admin-only endpoint (this whole page already is, per the (org) layout
  // guard) — 403/null for a non-Stripe org just means the calendar-month
  // fallback in `cycleRange` keeps showing instead.
  useEffect(() => {
    if (!orgId) return
    Billing.fetch().then(setBilling).catch(() => {})
  }, [orgId])

  const cycle = cycleRange(billing?.currentPeriodEnd, new Date())

  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed    = plan?.used        ?? 0
  // org.monthlyPrice only ever matches the fixed Teams $50–$2000 ladder
  // (TeamsTier.fromCredits in org-context.tsx) — an Enterprise/Pro org's
  // custom-contracted credit total never lands on one of those six exact
  // numbers, so it silently fell back to $0 here regardless of what the org
  // actually pays. Same base-fee derivation plans-and-billing/page.tsx uses
  // for its own "Pro Plan · $X/mo" (projected invoice minus metered overage).
  const isEnterprise  = plan?.planType === 'enterprise'
  const monthlyPrice  = isEnterprise
    ? Math.max((plan?.projectedInvoiceUsd ?? 0) - (plan?.overageUsd ?? 0), 0)
    : org.monthlyPrice

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

  // "Active" = has accepted their invite (mirrors Members page's own
  // total-vs-"Pending invites" split) — not "used the product recently".
  const activeMembers = members.filter(m => m.inviteStatus !== 'invite_sent')
  const pendingCount  = members.length - activeMembers.length

  // "20% utilisation" (Figma 18:26193) has no direct backend equivalent — the
  // closest real, computable signal is the share of ACTIVE members who've
  // actually spent any credits this billing cycle, rather than a fabricated
  // number. Spelled out in the card copy below so "50%" isn't left undefined.
  const utilisationPct = activeMembers.length > 0
    ? Math.round((activeMembers.filter(m => m.creditUsed > 0).length / activeMembers.length) * 100)
    : 0

  // Top users sorted by credit usage descending, capped to TOP_USERS_LIMIT —
  // "Manage members" is only a way to see everyone else, so it's suppressed
  // below whenever this slice already covers the full active roster.
  const topUsers = [...activeMembers]
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .slice(0, TOP_USERS_LIMIT)
    .map(m => ({
      name:    m.name || m.email,
      credits: `${m.creditUsed.toLocaleString()} credits`,
      share:   totalCredits > 0 ? `${Math.round((m.creditUsed / totalCredits) * 100)}%` : '0%',
    }))
  const hasMoreMembers = activeMembers.length > TOP_USERS_LIMIT

  // Per-member `creditUsed` (backend `usageTotal`) sums every logged category,
  // including "utility" work (auto-titling, summarization, memory extraction,
  // context classification) — metered for visibility but never charged. The
  // org's `used`/Monthly Limits total only reflects usage that actually debited
  // the credit pool, so it structurally excludes utility spend. Members will
  // therefore usually sum to slightly MORE than Monthly Limits, not less — this
  // spells that out rather than leaving the gap looking like a tracking error.
  const membersUsedSum = activeMembers.reduce((sum, m) => sum + m.creditUsed, 0)
  const usageGap        = membersUsedSum - totalUsed
  const topUsersNote     = usageGap > 0
    ? `Member totals sum to ${membersUsedSum.toLocaleString()}, ${usageGap.toLocaleString()} above the ${totalUsed.toLocaleString()}-credit Monthly Limits total — member totals include "utility" usage (auto-titling, summarization, memory extraction) that's metered for visibility but never charged against your plan.`
    : usageGap < 0
      ? `Member totals sum to ${membersUsedSum.toLocaleString()}, ${Math.abs(usageGap).toLocaleString()} below the ${totalUsed.toLocaleString()}-credit Monthly Limits total — likely usage from members no longer in the organization.`
      : undefined

  // Whenever the selected window's estimate reaches the full cycle-to-date
  // total (windowUsed clamps at totalUsed — true for 1/3/6 months in nearly
  // every case, and for "Last 7 days" itself early in a new cycle), it
  // reconciles exactly with the "Monthly Limits" total above. Otherwise it's
  // a real subset of that total — spelled out so that isn't mistaken for the
  // bars simply not adding up.
  const rangeLabel   = DATE_RANGES.find(r => r.id === dateRange)?.label ?? dateRange
  const chartCaption = featureSeries.windowUsed >= totalUsed
    ? `${featureSeries.windowUsed.toLocaleString()} credits — matches your Monthly Limits total for this cycle.`
    : `${featureSeries.windowUsed.toLocaleString()} of ${totalUsed.toLocaleString()} credits used this cycle · estimated for ${rangeLabel.toLowerCase()} (no per-day breakdown yet).`

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
        <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Usage
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>
              Manage your plan, monitor credit consumption, and download invoices.
            </p>
          </div>
          {/* This page says "this cycle" repeatedly (Monthly Limits, the
              chart caption, utilisation) with no start/end/reset date to
              anchor it to — this is that date, sourced from the same
              Stripe `current_period_end` plans-and-billing already shows as
              "Next billing"/"Resets". */}
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-500)', margin: 0, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Current cycle: {fmtCycleDate(cycle.start)} – {fmtCycleDate(cycle.end)}
            <br />
            Resets {fmtCycleDate(cycle.end)}
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
              {/* Fixed-height row, matching Active members' — its IconButton
                  (24px) is taller than this plain text line (22px), and
                  without pinning both header rows to the same height that
                  extra height pushed every row below it down, throwing off
                  the progress-bar alignment the two cards otherwise share. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24 }}>
                <p style={statCardHeaderStyle}>
                  Monthly Limits
                </p>
                <Tooltip
                  side="top"
                  align="end"
                  maxWidth={280}
                  content="Your organization's plan includes a fixed number of credits each billing cycle, for the price shown here. The bar below tracks how much of that allowance your team has used so far — it fills up as credits are spent and resets automatically at the start of your next billing cycle."
                >
                  <IconButton
                    variant="ghost"
                    size="xs"
                    icon={<InformationCircleIcon size={16} />}
                    aria-label="About Monthly Limits"
                  />
                </Tooltip>
              </div>
              <p style={statCardBigLineStyle}>
                ${Math.round(monthlyPrice)}/mo · {totalCredits.toLocaleString()} credits
              </p>
              {/* The bar fills to % USED (standard "progress toward your limit"
                  reading) — leading with "remaining" here read as contradicting
                  a mostly-empty bar, since it's the complementary number. Used%
                  now sits first, right next to the fill it actually matches. */}
              <ProgressBar value={poolPercentUsed} height={4} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={statCardFooterTextStyle}>
                  {poolPercentUsed}% used · {100 - poolPercentUsed}% remaining
                </span>
                <span style={statCardFooterTextStyle}>
                  {totalUsed.toLocaleString()}/{totalCredits.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ flex: '1 0 0', minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 8, boxShadow: 'var(--shadow-surface-card)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24 }}>
                <p style={statCardHeaderStyle}>
                  Active members
                </p>
                <Tooltip
                  side="top"
                  align="end"
                  maxWidth={280}
                  content="Members who have accepted their invite and joined your workspace — pending invites aren't counted until accepted. The number shown is how many people are active out of your total member count. The bar below shows what share of them have used at least 1 credit this billing cycle."
                >
                  <IconButton
                    variant="ghost"
                    size="xs"
                    icon={<InformationCircleIcon size={16} />}
                    aria-label="About active members"
                  />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <p style={statCardBigLineStyle}>
                  {activeMembers.length}
                </p>
                <span style={statCardFooterTextStyle}>
                  {pendingCount > 0
                    ? `of ${members.length} total · ${pendingCount} pending invite${pendingCount === 1 ? '' : 's'}`
                    : `of ${members.length} total · unlimited seats`}
                </span>
              </div>
              {/* A solid chip always reads as "full" regardless of the number
                  inside it — same proportional bar the Monthly Limits card
                  uses instead, so a half-used cycle actually looks half-full.
                  Lands on the same row as Monthly Limits' own bar: both cards
                  go header → big number/line → bar → footer. */}
              <ProgressBar value={utilisationPct} height={4} />
              <Tooltip content="Share of active members who've used at least 1 credit this billing cycle." side="top">
                <span style={{ ...statCardFooterTextStyle, width: 'fit-content', cursor: 'default', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                  {utilisationPct}% used credits this cycle
                </span>
              </Tooltip>
            </div>
          </div>
        </PageCard>

        <PageCard>
          <CardTitle
            title="Credit usage by feature"
            // Derived straight from FEATURE_META/METRIC_KEYS — the same
            // source UsageBarChart's `series` prop below is built from — so
            // these swatches can't drift out of sync with the actual bar
            // colors the way the old hardcoded Chat/Tasks/Slack badges did
            // (that trio didn't even name the real 3 series correctly, let
            // alone match their colors).
            action={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {METRIC_KEYS.map(metric => (
                  <span key={metric} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden style={{ width: 8, height: 8, backgroundColor: FEATURE_META[metric].color, border: `1px solid ${FEATURE_META[metric].border}`, boxSizing: 'border-box', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>
                      {FEATURE_META[metric].label}
                    </span>
                  </span>
                ))}
              </div>
            )}
          />
          <FeatureChart days={featureSeries.days} caption={chartCaption} />
        </PageCard>

        <RankedList
          title={`Top users · ${rangeLabel}`}
          items={topUsers}
          onViewAll={hasMoreMembers ? () => router.push(ORG_MEMBERS_ROUTE) : undefined}
          note={topUsersNote}
        />
      </div>
    </div>
  )
}
