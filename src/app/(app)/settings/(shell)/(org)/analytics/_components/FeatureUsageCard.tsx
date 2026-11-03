'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { usageQuery } from '@/lib/billing/billing-queries'
import { orgScope } from '@/lib/query-keys'
import { PageCard } from './AnalyticsParts'

// Credit usage by feature — measured numbers only.
//
// "Mine": the viewer's own spend this billing period by feature, from GET /stripe/usage (by_category:
// chat + agent sub-tasks, Slack, automations). "Organization": the workspace's real total this cycle;
// the backend reports no per-feature (or per-day) split for an organization yet, so the card says so
// instead of estimating one. When it does, fill the organization view from it.
// The daily bar chart stays in place in both views, but there is no per-day series from the backend
// (for a person or an organization), so it shows its frame with "Accurate data can't be fetched right now"
// rather than invented bars. Feed DailyChart real days once an endpoint reports them.

type Scope = 'mine' | 'org'

export type DateRange = '7d' | '1m' | '3m' | '6m'

export const DATE_RANGES: Array<{ id: DateRange; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
]

/** The chart's x-axis for a range: every day for 7 days, otherwise 6 evenly spaced dates. */
function axisFor(range: DateRange): string[] {
  const { buckets, windowDays } = range === '7d' ? { buckets: 7, windowDays: 7 }
    : range === '1m' ? { buckets: 6, windowDays: 30 }
    : range === '3m' ? { buckets: 6, windowDays: 90 }
    : { buckets: 6, windowDays: 180 }
  const step = windowDays / buckets
  return Array.from({ length: buckets }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - Math.round((buckets - 1 - i) * step))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
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

/** The chart's frame for the chosen range — gridlines and dates — with a notice in place of bars. */
function DailyChart({ range }: { range: DateRange }) {
  const days = axisFor(range)
  return (
    <div>
      <div style={{ position: 'relative', height: 200 }}>
        {/* Gridlines, as the chart draws them. */}
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, borderTop: `1px ${i === 4 ? 'solid' : 'dashed'} var(--neutral-200)` }} />
        ))}
        <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--card-bg)', boxShadow: 'inset 0 0 0 1px var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
            <InformationCircleIcon size={16} />
            Accurate data can&apos;t be fetched right now
          </span>
        </div>
      </div>
      <div aria-hidden style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
        {days.map(day => (
          <span key={day} style={{ fontFamily: 'var(--font-body)', fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)' }}>{day}</span>
        ))}
      </div>
    </div>
  )
}

const caption: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)', margin: 0 }
const strong: React.CSSProperties = { fontWeight: 500, color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }

export function FeatureUsageCard({ orgId, orgTotal, range }: { orgId: string | null | undefined; orgTotal: number; range: DateRange }) {
  const [scope, setScope] = useState<Scope>('org')
  const usageQ = useQuery(usageQuery(orgScope(orgId)))
  const spend = usageQ.data?.byCategory
  const values = spend
    ? { chat: spend.chatCredits, slack: spend.slackCredits, automation: spend.automationCredits }
    : null
  const mine = values ? values.chat + values.slack + values.automation : 0

  return (
    <PageCard padding={0}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
            Credit usage by feature
          </h2>
          <p style={{ ...caption, margin: '2px 0 0' }}>
            {scope === 'mine' ? 'Your own usage this billing period.' : 'Everyone in the workspace this cycle.'}
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
              {/* One bar, split by each feature's real share of your spend. */}
              <div aria-hidden style={{ display: 'flex', gap: 2, height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--neutral-100)' }}>
                {mine > 0 && FEATURES.map(f => values[f.key] > 0 && (
                  <span key={f.key} style={{ width: `${(values[f.key] / mine) * 100}%`, background: f.color }} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {FEATURES.map(f => {
                  const value = values[f.key]
                  return (
                    <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12, background: 'var(--neutral-white)', boxShadow: 'var(--shadow-surface-card)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, ...caption }}>
                        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: f.color, flexShrink: 0 }} />
                        {f.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, lineHeight: '30px', color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }}>
                          {value.toLocaleString()}
                        </span>
                        <span style={{ ...caption, fontVariantNumeric: 'tabular-nums' }}>{sharePct(value, mine)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <DailyChart range={range} />
              <p style={caption}>
                <span style={strong}>{mine.toLocaleString()}</span> credits used by you
                {orgTotal > 0 && <> · <span style={strong}>{sharePct(Math.min(mine, orgTotal), orgTotal)}</span> of the workspace</>}
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px' }}>
          <p style={{ fontFamily: 'var(--font-title)', fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {orgTotal.toLocaleString()} <span style={{ fontSize: 16, lineHeight: '24px', color: 'var(--neutral-500)' }}>credits this cycle</span>
          </p>
          <p style={{ ...caption, padding: '10px 12px', borderRadius: 10, background: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)' }}>
            A per-feature breakdown for the whole workspace isn&apos;t reported yet, so only the total is shown. See each member&apos;s share in the table below.
          </p>
          <DailyChart range={range} />
        </div>
      )}
    </PageCard>
  )
}
