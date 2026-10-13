'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Tooltip } from '@/components/Tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { UsageBarChart } from '@/components/UsageBarChart'
import { Avatar } from '@/components/Avatar'
import { UsageMeter } from '@/components/UsageMeter'
import { SettingsTable, SettingsTableCell, SettingsTableHeader, SettingsTableHeaderCell, SettingsTableRow, SettingsTableToolbar } from '@/components/SettingsTable'
import { Button, IconButton } from '@/components/ui/button'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'

type DateRange = '7d' | '1m' | '3m' | '6m'

const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
]

type ChartMetric = 'chat' | 'assistants' | 'automation'

interface ChartDay { label: string; chat: number; assistants: number; automation: number }

// Figma 18:26029 colour slots (blue/purple/green) for the Chat / Slack /
// Automations categories this data tracks.
//
// Based on the same tag bg tints Chip/Badge/PinCategory use (aliases.css
// --color-tag-{Color}-bg), one primitive step darker than the exact tag tint
// (blue-100→200, purple-100→200, green's tag tint is already the lighter
// -bg-soft/green-50, so its next step is green-100 — the tag system's own
// plain -bg). `border` is that tag's ring color (--color-tag-{Color}-ring) —
// the same 1px outline every Chip/Badge renders around its bg tint.
const FEATURE_META: Record<ChartMetric, { label: string; color: string }> = {
  assistants: { label: 'Slack',       color: 'var(--chart-slack)' },
  automation: { label: 'Automations', color: 'var(--chart-automation)' },
  chat:       { label: 'Chat',        color: 'var(--chart-chat)' },
}

// Approximate feature mix of total consumption. The backend exposes org credit
// totals (and per-member / per-team breakdowns) but no per-feature time series,
// so the daily curve below is *derived* from the real `used` total — apportioned
// to the selected window by day-count and split across features — rather than a
// frozen mock. It changes per org, per usage level, and per date range.
const FEATURE_SPLIT: Record<ChartMetric, number> = { chat: 0.68, assistants: 0.20, automation: 0.12 }

// Matches AnalyticsPageSkeleton's 4 placeholder rows below. A real top-N cap —
// "Manage members" only makes sense as a way to see the REST of the team, so
// it must stay hidden whenever this list already covers everyone active.
const TOP_USERS_LIMIT = 4

const METRIC_KEYS: ChartMetric[] = ['assistants', 'automation', 'chat']

function rangeConfig(range: DateRange): { buckets: number; windowDays: number } {
  switch (range) {
    case '7d': return { buckets: 7, windowDays: 7 }
    case '1m': return { buckets: 6, windowDays: 30 }
    case '3m': return { buckets: 6, windowDays: 90 }
    case '6m': return { buckets: 6, windowDays: 180 }
  }
}

/** Build a date-range-aware, usage-scaled feature series (see FEATURE_SPLIT note). */
function buildFeatureSeries(range: DateRange, totalUsed: number, now: Date, elapsedDays: number): {
  days: ChartDay[]
  totals: Record<ChartMetric, number>
  windowUsed: number
} {
  const { buckets, windowDays } = rangeConfig(range)
  // `totalUsed` is the cycle-to-date total, so a window longer than the cycle
  // so far is capped at it; a shorter window takes its share of elapsed days.
  const windowUsed  = Math.round(totalUsed * Math.min(1, windowDays / elapsedDays))
  const bucketSpan = windowDays / buckets

  // Deterministic per-bucket weights (stable across renders — no Math.random).
  const weights: Record<ChartMetric, number[]> = { chat: [], assistants: [], automation: [] }
  METRIC_KEYS.forEach((metric, fi) => {
    const raw = Array.from({ length: buckets }, (_, i) =>
      Math.max(0.2, 1 + 0.55 * Math.sin(i * 1.3 + fi * 2.1) + 0.25 * Math.cos(i * 0.7 + fi)))
    const sum = raw.reduce((a, b) => a + b, 0)
    weights[metric] = raw.map(w => w / sum)
  })

  const days:   ChartDay[]                 = []
  const totals: Record<ChartMetric, number> = { chat: 0, assistants: 0, automation: 0 }
  for (let i = 0; i < buckets; i++) {
    const offsetDays = Math.round((buckets - 1 - i) * bucketSpan)
    const d = new Date(now)
    d.setDate(now.getDate() - offsetDays)
    const day: ChartDay = {
      label:      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      chat:       Math.round(windowUsed * FEATURE_SPLIT.chat       * weights.chat[i]),
      assistants: Math.round(windowUsed * FEATURE_SPLIT.assistants * weights.assistants[i]),
      automation: Math.round(windowUsed * FEATURE_SPLIT.automation * weights.automation[i]),
    }
    days.push(day)
    totals.chat += day.chat; totals.assistants += day.assistants; totals.automation += day.automation
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
        border:          '1px solid var(--border-default)',
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


function FeatureCard({ days, totals, windowUsed, rangeLabel, caption }: {
  days: ChartDay[]
  totals: Record<ChartMetric, number>
  windowUsed: number
  rangeLabel: string
  caption: string
}) {
  const sum = METRIC_KEYS.reduce((acc, metric) => acc + totals[metric], 0)
  const series = METRIC_KEYS.map(metric => ({
    id:    metric,
    label: FEATURE_META[metric].label,
    color: FEATURE_META[metric].color,
    data:  days.map(d => d[metric]),
  }))

  return (
    <PageCard padding={0}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
              Credit usage by feature
            </h2>
            <Tooltip
              side="top"
              maxWidth={280}
              content="The total is your real credit use. How it splits across Slack, Automations and Chat, and day by day, is estimated until per-feature reporting is available."
            >
              <span style={{ display: 'inline-flex', cursor: 'default' }}><Badge label="Estimated split" color="Neutral" /></span>
            </Tooltip>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: '2px 0 0' }}>
            {windowUsed.toLocaleString()} credits · {rangeLabel}
          </p>
        </div>
      </div>

      {/* One tile per feature: what it cost, its share, and a thin bar in its chart colour. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, padding: '20px 24px 0' }}>
        {METRIC_KEYS.map(metric => {
          const value = totals[metric]
          const share = sum > 0 ? value / sum : 0
          return (
            <div key={metric} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12, background: 'var(--neutral-white)', boxShadow: 'var(--shadow-surface-card)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: FEATURE_META[metric].color, flexShrink: 0 }} />
                {FEATURE_META[metric].label}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, lineHeight: '30px', color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }}>
                  {value.toLocaleString()}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(share * 100)}%
                </span>
              </span>
              <span aria-hidden style={{ height: 4, borderRadius: 999, background: 'var(--neutral-100)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, minWidth: share > 0 ? 4 : 0, borderRadius: 999, background: FEATURE_META[metric].color }} />
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '20px 24px 20px' }}>
        <UsageBarChart days={days.map(d => d.label)} series={series} mode="per-link" height={200} barRadius={[4, 4, 0, 0]} segmentGap="var(--neutral-50)" showHoverCursor />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: '12px 0 0' }}>
          {caption}
        </p>
      </div>
    </PageCard>
  )
}

// Same table language as /settings/members. Member usage is a billing-cycle total from the backend (it
// does not follow the date range above), so the table says "this cycle" and each share is of the team's
// total, which adds up to 100%, rather than of the plan allowance.
const TOP_USER_COLUMNS = 'minmax(0, 1fr) 96px 112px 168px'

const MEMBER_ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', service: 'Bot' }

interface TopUser {
  id: string
  name: string
  email: string
  role: string
  credits: number
  share: number
  you: boolean
}

function TopUsersTable({ users, shownOf, onViewAll, note }: {
  users: TopUser[]
  shownOf: number
  onViewAll?: () => void
  note?: string
}) {
  return (
    <SettingsTable columns={TOP_USER_COLUMNS} columnGap={0}>
      <SettingsTableToolbar
        title={
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span>Top users this cycle</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
              {users.length < shownOf ? `Top ${users.length} of ${shownOf} active members` : `${shownOf} active ${shownOf === 1 ? 'member' : 'members'}`} · ranked by credits
            </span>
          </span>
        }
      >
        {onViewAll && <Button variant="secondary" size="sm" onClick={onViewAll}>View all members</Button>}
      </SettingsTableToolbar>
      <div role="table" aria-label="Top users by credits this cycle">
        <SettingsTableHeader>
          <SettingsTableHeaderCell>Member</SettingsTableHeaderCell>
          <SettingsTableHeaderCell>Role</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">Credits</SettingsTableHeaderCell>
          <SettingsTableHeaderCell align="end">Share of team</SettingsTableHeaderCell>
        </SettingsTableHeader>
        {users.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)', margin: 0 }}>No usage yet this cycle</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', margin: '4px 0 0' }}>Members show up here once they start chatting or running automations.</p>
          </div>
        ) : users.map((user, index) => (
          <SettingsTableRow key={user.id} minHeight={68}>
            <SettingsTableCell>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span
                  aria-label={`Rank ${index + 1}`}
                  style={{
                    width: 22, height: 22, flexShrink: 0, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: index === 0 ? 'var(--neutral-900)' : 'var(--neutral-100)', color: index === 0 ? 'var(--neutral-50)' : 'var(--neutral-600)',
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {index + 1}
                </span>
                <Avatar name={user.name} seed={user.id} size="md" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </span>
                    {user.you && <Badge label="You" color="Blue" />}
                  </span>
                  {user.email && user.email !== user.name && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </SettingsTableCell>
            <SettingsTableCell>
              <Badge label={MEMBER_ROLE_LABEL[user.role] ?? 'Member'} color="Neutral" />
            </SettingsTableCell>
            <SettingsTableCell align="end">
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }}>
                {user.credits.toLocaleString()}
              </span>
            </SettingsTableCell>
            <SettingsTableCell align="end">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 140 }}>
                <UsageMeter value={user.share * 100} label={`${user.name}'s share of team credits`} height={4} />
                <span style={{ width: 36, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-600)', fontVariantNumeric: 'tabular-nums' }}>
                  {user.share > 0 && user.share < 0.01 ? '<1%' : `${Math.round(user.share * 100)}%`}
                </span>
              </div>
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </div>
      {note && (
        <p style={{ display: 'flex', gap: 6, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: '0 24px' }}>
          <InformationCircleIcon size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{note}</span>
        </p>
      )}
    </SettingsTable>
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
      <div style={{ flex: '1 0 0', minWidth: 0, maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

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
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: 12 }}>
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
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: CARD_SHADOW, overflow: 'hidden', backgroundColor: 'var(--neutral-50)', padding: '12px 0' }}>
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
        <section style={{ border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: CARD_SHADOW, background: 'var(--neutral-50)', overflow: 'hidden', padding: '12px 0' }}>
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
  const { members, membersLoading, plan, orgReady } = useOrg()
  const { user } = useAuth()
  const [dateRange,  setDateRange]  = useState<DateRange>('7d')

  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed    = plan?.used        ?? 0
  const isEnterprise = plan?.isEnterprise ?? false
  const monthlyPrice = plan?.monthlyPrice ?? 0
  const daysIntoCycle = plan?.daysIntoCycle ?? 1

  // Feature-usage series — derived from real `used` credits + selected range.
  const featureSeries = React.useMemo(
    () => buildFeatureSeries(dateRange, totalUsed, new Date(), daysIntoCycle),
    [dateRange, totalUsed, daysIntoCycle],
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
  const teamUsedSum = activeMembers.reduce((sum, m) => sum + m.creditUsed, 0)
  const topUsers = [...activeMembers]
    .filter(m => m.creditUsed > 0)
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .slice(0, TOP_USERS_LIMIT)
    .map(m => ({
      id:      m.id,
      name:    m.name || m.email,
      email:   m.email,
      role:    m.orgRole,
      credits: m.creditUsed,
      share:   teamUsedSum > 0 ? m.creditUsed / teamUsedSum : 0,
      you:     !!user?.email && m.email === user.email,
    }))

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
    ? `Member totals include background work (chat titles, summaries, memory) that is not charged to your plan, so together they come to ${membersUsedSum.toLocaleString()} credits, ${usageGap.toLocaleString()} more than the ${totalUsed.toLocaleString()} used above.`
    : usageGap < 0
      ? `Member totals come to ${membersUsedSum.toLocaleString()} credits, ${Math.abs(usageGap).toLocaleString()} less than the ${totalUsed.toLocaleString()} used above. The difference is usage from people who have left the workspace.`
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

  const avgPerMember = activeMembers.length > 0 ? Math.round(totalUsed / activeMembers.length) : 0
  const remaining = Math.max(0, totalCredits - totalUsed)
  const kpiLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }
  const kpiValue: React.CSSProperties = { fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0, fontVariantNumeric: 'tabular-nums' }
  const kpiHint: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }
  const kpiTile: React.CSSProperties = { minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, boxShadow: 'var(--shadow-surface-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }

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
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          maxWidth:      908,
          padding:       '0 24px',
          boxSizing:     'border-box',
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
        }}
      >
        {/* Header: title on the left, the date range it controls on the right. */}
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Usage
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
              How your workspace is using its credits{plan?.cycleEndLabel && plan.cycleEndLabel !== '—' ? `, this cycle ${isEnterprise ? 'billed' : 'resets'} ${plan.cycleEndLabel}` : ''}.
            </p>
          </div>
          <Tabs value={dateRange} onValueChange={value => setDateRange(value as DateRange)}>
            <TabsList size="small" aria-label="Usage date range">
              {DATE_RANGES.map(range => (
                <TabsTrigger key={range.id} value={range.id}>{range.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Four headline numbers, the plan meter spanning under the first two. */}
        <PageCard padding={12}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ ...kpiTile, gridColumn: 'span 2' }}>
              <span style={kpiLabel}>
                {isEnterprise ? 'Spend this cycle' : 'Credits used this cycle'}
                <Tooltip side="top" maxWidth={280} content="Your plan includes a fixed number of credits each billing cycle. This tracks how much of that your team has used; it resets at the start of the next cycle.">
                  <IconButton variant="ghost" size="xs" icon={<InformationCircleIcon size={14} />} aria-label="About credits used" />
                </Tooltip>
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <p style={kpiValue}>{totalUsed.toLocaleString()}</p>
                <span style={kpiHint}>
                  {isEnterprise ? (plan?.budgetLabel ?? 'Unlimited') : `of ${totalCredits.toLocaleString()} · $${Math.round(monthlyPrice)}/mo plan`}
                </span>
              </div>
              <UsageMeter
                value={isEnterprise ? Math.round(plan?.budgetUsedPct ?? 0) : poolPercentUsed}
                label="Plan credits used"
                trailing={isEnterprise ? (plan?.budgetUsd == null ? 'No limit' : `${Math.round(plan.budgetUsedPct)}%`) : `${poolPercentUsed}%`}
                caption={plan?.cycleLabel && plan.cycleLabel !== '—' ? `Cycle ${plan.cycleLabel}` : undefined}
              />
            </div>
            <div style={kpiTile}>
              <span style={kpiLabel}>{isEnterprise ? 'Credits used' : 'Remaining'}</span>
              <p style={kpiValue}>{(isEnterprise ? totalUsed : remaining).toLocaleString()}</p>
              <p style={kpiHint}>{isEnterprise ? 'billed for usage' : `${100 - poolPercentUsed}% of the plan left`}</p>
            </div>
            <div style={kpiTile}>
              <span style={kpiLabel}>
                Active members
                <Tooltip side="top" maxWidth={260} content="Members who accepted their invite. Pending invites are not counted.">
                  <IconButton variant="ghost" size="xs" icon={<InformationCircleIcon size={14} />} aria-label="About active members" />
                </Tooltip>
              </span>
              <p style={kpiValue}>{activeMembers.length}</p>
              <p style={kpiHint}>
                {utilisationPct}% used credits{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
              </p>
            </div>
          </div>
          <p style={{ ...kpiHint, margin: '10px 4px 0' }}>
            About {avgPerMember.toLocaleString()} credits per active member this cycle.
          </p>
        </PageCard>

        <FeatureCard days={featureSeries.days} totals={featureSeries.totals} windowUsed={featureSeries.windowUsed} rangeLabel={rangeLabel} caption={chartCaption} />

        <TopUsersTable
          users={topUsers}
          shownOf={activeMembers.length}
          onViewAll={() => router.push(ORG_MEMBERS_ROUTE)}
          note={topUsersNote}
        />
      </div>
    </div>
  )
}
