'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { usageQuery } from '@/lib/billing/billing-queries'
import { orgUsageQuery } from '@/lib/org/org-queries'
import { ApiError } from '@/lib/api/client'
import type { OrgUsageBucket, OrgUsageByCategory } from '@/types/teams'
import { orgScope } from '@/lib/query-keys'
import { PageCard } from './AnalyticsParts'

// Credit usage by feature — measured numbers only.
//
// "Mine": the viewer's own spend this billing period by feature, from GET /stripe/usage (by_category:
// chat + agent sub-tasks, Slack, automations). "Organization": the whole workspace over the chosen
// range, from GET /organizations/{id}/plan/usage, which reports the same categories plus a per-bucket
// series. That endpoint is admin-only, so a member gets a 403 and keeps the cycle total alone.
//
// The chart draws that series: one stacked bar per bucket, day or week as the response says.

type Scope = 'mine' | 'org'

export type DateRange = '7d' | '1m' | '3m' | '6m'

export const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
]

/** A bucket's start as a short date, e.g. "Nov 5". */
function bucketLabel(start: string): string {
  const d = new Date(start)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** At most `max` labels across the axis, so a 30- or 90-bucket series stays readable. */
function labelledIndexes(count: number, max = 6): Set<number> {
  if (count <= max) return new Set(Array.from({ length: count }, (_, i) => i))
  const step = (count - 1) / (max - 1)
  return new Set(Array.from({ length: max }, (_, i) => Math.round(i * step)))
}

const FEATURES = [
  { key: 'chat',       label: 'Chat',        color: 'var(--chart-chat)' },
  { key: 'slack',      label: 'Slack',       color: 'var(--chart-slack)' },
  { key: 'automation', label: 'Automations', color: 'var(--chart-automation)' },
] as const

/** A share as a whole percent, without showing a used feature as "0%" or a near-total as "100%". */
function sharePct(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '0%'
  const pct = (value / total) * 100
  if (pct < 1) return '<1%'
  if (pct > 99 && value < total) return '>99%'
  return `${Math.round(pct)}%`
}

/** A notice in the chart's frame, for when there is no series to draw. */
function ChartNotice({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div style={{ position: 'relative', height: 200 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, borderTop: `1px ${i === 4 ? 'solid' : 'dashed'} var(--neutral-200)` }} />
        ))}
        <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--card-bg)', boxShadow: 'inset 0 0 0 1px var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
            <InformationCircleIcon size={16} />
            {children}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Credits per bucket, stacked by feature. The buckets are whatever the backend
 * chose for the range (days for the short ones, weeks for the long), so the bars
 * follow the series rather than a window this component works out for itself.
 */
function UsageChart({ series, bucket }: { series: OrgUsageBucket[]; bucket: 'day' | 'week' }) {
  const totals = series.map(s => s.chat + s.slack + s.automation + s.subtask)
  const peak = Math.max(...totals, 0)
  const labelled = labelledIndexes(series.length)
  const unit = bucket === 'week' ? 'week of' : ''

  // Every bucket is empty: bars would all be zero-height, which reads as broken.
  if (peak <= 0) return <ChartNotice>No credits were used in this period</ChartNotice>

  return (
    <div>
      <div style={{ position: 'relative', height: 200 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, borderTop: `1px ${i === 4 ? 'solid' : 'dashed'} var(--neutral-200)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: series.length > 40 ? 1 : 3 }}>
          {series.map((s, i) => {
            const total = totals[i]
            const label = `${unit ? `${unit} ` : ''}${bucketLabel(s.start)}: ${total.toLocaleString()} credits`
            return (
              <div
                key={s.start}
                title={label}
                style={{ flex: '1 1 0', minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
              >
                {/* Stacked top-down in the same order as the legend below. */}
                <div style={{ height: `${(total / peak) * 100}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: 3, overflow: 'hidden', minHeight: total > 0 ? 2 : 0 }}>
                  {FEATURES.map(f => {
                    const value = f.key === 'chat' ? s.chat + s.subtask : f.key === 'slack' ? s.slack : s.automation
                    if (value <= 0) return null
                    return <span key={f.key} style={{ height: `${(value / total) * 100}%`, background: f.color, flexShrink: 0 }} />
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div aria-hidden style={{ display: 'flex', gap: series.length > 40 ? 1 : 3, marginTop: 8 }}>
        {series.map((s, i) => (
          <span key={s.start} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
            {labelled.has(i) ? bucketLabel(s.start) : ' '}
          </span>
        ))}
      </div>
    </div>
  )
}

/** How the footer names the window the organization numbers cover. */
const RANGE_CAPTION: Record<DateRange, string> = {
  '7d': 'the last 7 days',
  '1m': 'the last month',
  '3m': 'the last 3 months',
  '6m': 'the last 6 months',
}

const caption: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }
const strong: React.CSSProperties = { fontWeight: 500, color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }

type FeatureKey = (typeof FEATURES)[number]['key']

/** The proportion bar and the three figures — the same for one person and for the workspace. */
function FeatureSplit({ values, total }: { values: Record<FeatureKey, number>; total: number }) {
  return (
    <>
      {/* One bar, split by each feature's real share of the spend. */}
      <div aria-hidden style={{ display: 'flex', gap: 2, height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--neutral-100)' }}>
        {total > 0 && FEATURES.map(f => values[f.key] > 0 && (
          <span key={f.key} style={{ width: `${(values[f.key] / total) * 100}%`, background: f.color }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {FEATURES.map(f => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12, background: 'var(--neutral-white)', boxShadow: 'var(--shadow-surface-card)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, ...caption }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: f.color, flexShrink: 0 }} />
              {f.label}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, lineHeight: '30px', color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }}>
                {values[f.key].toLocaleString()}
              </span>
              <span style={{ ...caption, fontVariantNumeric: 'tabular-nums' }}>{sharePct(values[f.key], total)}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

/** The three legend features from a category split; chat carries its agent sub-tasks. */
function featureValues(c: OrgUsageByCategory): Record<(typeof FEATURES)[number]['key'], number> {
  return { chat: c.chat + c.subtask, slack: c.slack, automation: c.automation }
}

export function FeatureUsageCard({ orgId, orgTotal, range }: { orgId: string | null | undefined; orgTotal: number; range: DateRange }) {
  const [scope, setScope] = useState<Scope>('org')
  const usageQ = useQuery(usageQuery(orgScope(orgId)))
  const spend = usageQ.data?.byCategory
  const values = spend
    ? { chat: spend.chatCredits, slack: spend.slackCredits, automation: spend.automationCredits }
    : null
  const mine = values ? values.chat + values.slack + values.automation : 0

  // The workspace breakdown for the chosen range. Admin-only: a member's 403 leaves
  // `breakdown` undefined and the organization view falls back to the cycle total.
  const breakdownQ = useQuery(orgUsageQuery(orgId ?? null, range))
  const breakdown = breakdownQ.data
  const orgValues = breakdown ? featureValues(breakdown.byCategory) : null
  const orgRangeTotal = orgValues ? orgValues.chat + orgValues.slack + orgValues.automation : 0
  // A member is refused outright rather than this being a transient failure, so it is
  // worth saying which it was.
  const breakdownForbidden = breakdownQ.error instanceof ApiError && breakdownQ.error.status === 403

  return (
    <PageCard padding={0}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Credit usage by feature
          </h2>
          <p style={{ ...caption, margin: '2px 0 0' }}>
            {scope === 'mine' ? 'Your own usage this billing period.' : `Everyone in the workspace, ${RANGE_CAPTION[range]}.`}
          </p>
        </div>
        <Tabs value={scope} onValueChange={value => setScope(value as Scope)}>
          <TabsList size="small" aria-label="Whose usage">
            <TabsTrigger value="mine">Mine</TabsTrigger>
            <TabsTrigger value="org">Organization</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {scope === 'mine' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
          {!values ? (
            <p style={caption}>{usageQ.isError ? 'Could not load your usage. Try again in a moment.' : 'Loading your usage…'}</p>
          ) : (
            <>
              <FeatureSplit values={values} total={mine} />
              {/* The series the backend reports is the workspace's, not one person's, so
                  the chart belongs to the organization view until a per-member one exists. */}
              <ChartNotice>Day-by-day usage isn&apos;t reported for one person yet</ChartNotice>
              <p style={caption}>
                <span style={strong}>{mine.toLocaleString()}</span> credits used by you
                {orgTotal > 0 && <> · <span style={strong}>{sharePct(Math.min(mine, orgTotal), orgTotal)}</span> of the workspace</>}
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
          {/* The range, not the cycle — everything else in this card is the range, and the
              cycle total is the page's first figure above. */}
          <p style={{ fontFamily: 'var(--font-title)', fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {(breakdown ? orgRangeTotal : orgTotal).toLocaleString()}{' '}
            <span style={{ fontSize: 16, lineHeight: '24px', color: 'var(--neutral-500)' }}>
              {breakdown ? `credits over ${RANGE_CAPTION[range]}` : 'credits this cycle'}
            </span>
          </p>
          {breakdown && orgValues ? (
            <>
              <FeatureSplit values={orgValues} total={orgRangeTotal} />
              <UsageChart series={breakdown.series} bucket={breakdown.bucket} />
              <p style={caption}>
                <span style={strong}>{orgTotal.toLocaleString()}</span> credits this billing cycle
                {' · '}chart {breakdown.bucket === 'week' ? 'by week' : 'by day'}
              </p>
            </>
          ) : breakdownQ.isPending ? (
            <ChartNotice>Loading the workspace breakdown…</ChartNotice>
          ) : (
            <>
              <p style={{ ...caption, padding: '10px 12px', borderRadius: 10, background: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)' }}>
                {breakdownForbidden
                  ? 'Only workspace admins can see the breakdown by feature and day, so only the cycle total is shown here. See each member’s share in the table below.'
                  : 'Could not load the workspace breakdown. Try again in a moment.'}
              </p>
              <ChartNotice>{breakdownForbidden ? 'Admins only' : 'Accurate data can’t be fetched right now'}</ChartNotice>
            </>
          )}
        </div>
      )}
    </PageCard>
  )
}
