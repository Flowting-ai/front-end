'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { BlockErrorBoundary } from '@/components/chat/BlockErrorBoundary'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { Tooltip } from '@/components/Tooltip'
import { UsageMeter } from '@/components/UsageMeter'
import { Button, IconButton } from '@/components/ui/button'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'
import { AnalyticsPageSkeleton, AnalyticsScroll, PageCard, TopUsersTable } from './_components/AnalyticsParts'
import { useOrgUsage } from './use-org-usage'
import { DATE_RANGES, FeatureUsageCard, type DateRange } from './_components/FeatureUsageCard'
import { useOrgIdentity } from '@/context/org-context'

// Data: use-org-usage.ts (lib/analytics/org-usage.ts derives every number).

const kpiLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }
const kpiValue: React.CSSProperties = { fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0, fontVariantNumeric: 'tabular-nums' }
const kpiHint: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }
const planPill: React.CSSProperties = { flexShrink: 0, padding: '1px 8px', borderRadius: 999, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '20px', color: 'var(--neutral-700)', whiteSpace: 'nowrap' }
const kpiTile: React.CSSProperties = { minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, boxShadow: 'var(--shadow-surface-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }

export default function OrgUsageAnalyticsPage() {
  const router = useRouter()
  const { ready, plan, summary, exportCsv } = useOrgUsage()
  const { orgId } = useOrgIdentity()
  const [dateRange, setDateRange] = useState<DateRange>('7d')

  if (!ready) {
    return <AnalyticsScroll><AnalyticsPageSkeleton /></AnalyticsScroll>
  }

  const {
    totalCredits, totalUsed, remaining, isEnterprise, monthlyPrice, poolPercentUsed,
    activeCount, pendingCount, utilisationPct, avgPerMember, topUsers, topUsersNote,
  } = summary

  // The billing cycle beside the date range: "Oct 16 – Nov 16, 2026 · Day 18 of 31".
  const cycleDays = plan?.cycleStart && plan.cycleEnd
    ? Math.max(1, Math.round((plan.cycleEnd.getTime() - plan.cycleStart.getTime()) / 86_400_000))
    : null
  const cycleRange = plan?.cycleLabel && plan.cycleLabel !== '—' ? plan.cycleLabel : null
  const cycleDay = cycleDays ? Math.min(plan?.daysIntoCycle ?? 1, cycleDays) : null
  // One formatting for the cycle wherever it shows: muted label, the range stronger, the day muted.
  const cycleText = cycleRange && (
    <span>
      <span style={{ color: 'var(--neutral-500)' }}>{isEnterprise ? 'Billing cycle' : 'Cycle'}</span>{' '}
      <span style={{ fontWeight: 500, color: 'var(--neutral-900)' }}>{cycleRange}</span>
      {cycleDay && (
        <span style={{ color: 'var(--neutral-500)', fontVariantNumeric: 'tabular-nums' }}>{' · '}Day {cycleDay} of {cycleDays}</span>
      )}
    </span>
  )
  // Unlimited enterprise usage has nothing to fill a meter against.
  const showMeter = !(isEnterprise && plan?.budgetUsd == null)

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
        {/* Header: title and description on the left (the cycle shows in the first card); Export at the right end. */}
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
                Usage
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
                How your workspace is using its credits.
              </p>
            </div>
          </div>
          {activeCount > 0 && (
            <Button variant="default" size="sm" leftIcon={<DownloadOneIcon size={14} />} onClick={exportCsv} style={{ flexShrink: 0 }}>Export CSV</Button>
          )}
        </div>

        {/* The window the feature chart covers — GET /organizations/{id}/plan/usage takes
            the same four, and picks days or weeks per range. */}
        <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Tabs value={dateRange} onValueChange={value => setDateRange(value as DateRange)}>
            <TabsList size="small" aria-label="Usage date range">
              {DATE_RANGES.map(range => (
                <TabsTrigger key={range.id} value={range.id}>{range.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-500)' }}>
            Applies to the workspace chart below.
          </span>
        </div>

        {/* A render error in one card shows a notice instead of blanking the page. */}
        <BlockErrorBoundary label="usage summary">
        {/* Four headline numbers, the plan meter spanning under the first two. */}
        <PageCard padding={12}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ ...kpiTile, gridColumn: 'span 2' }}>
              {/* Label on the left, the plan (price, or Unlimited / budget for enterprise) as a pill on the right. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={kpiLabel}>
                  {isEnterprise ? 'Spend this cycle' : 'Credits used this cycle'}
                  <Tooltip side="top" maxWidth={280} content="Your plan includes a fixed number of credits each billing cycle. This tracks how much of that your team has used; it resets at the start of the next cycle.">
                    <IconButton variant="ghost" size="xs" icon={<InformationCircleIcon size={14} />} aria-label="About credits used" />
                  </Tooltip>
                </span>
                <span style={planPill}>
                  {isEnterprise ? (plan?.budgetLabel ?? 'Unlimited') : `$${Math.round(monthlyPrice)}/mo plan`}
                </span>
              </div>
              {/* "46,767 / 108,696 credits": used, then the plan's allowance, smaller. */}
              <p style={{ ...kpiValue, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span>{totalUsed.toLocaleString()}</span>
                <span style={{ fontSize: 16, lineHeight: '24px', color: 'var(--neutral-500)' }}>
                  {isEnterprise ? 'credits' : `/ ${totalCredits.toLocaleString()} credits`}
                </span>
              </p>
              {showMeter ? (
                <UsageMeter
                  value={isEnterprise ? Math.round(plan?.budgetUsedPct ?? 0) : poolPercentUsed}
                  label="Plan credits used"
                  trailing={isEnterprise ? `${Math.round(plan?.budgetUsedPct ?? 0)}%` : `${poolPercentUsed}%`}
                  caption={cycleText || undefined}
                />
              ) : cycleText && (
                <p style={{ ...kpiHint, fontSize: 13, lineHeight: '20px' }}>{cycleText}</p>
              )}
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
              <p style={kpiValue}>{activeCount}</p>
              <p style={kpiHint}>
                {utilisationPct}% used credits{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
              </p>
            </div>
          </div>
          <p style={{ margin: '10px 4px 0', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>
            <span style={{ fontWeight: 500, color: 'var(--neutral-900)', fontVariantNumeric: 'tabular-nums' }}>~{avgPerMember.toLocaleString()}</span> credits per active member this cycle
          </p>
        </PageCard>
        </BlockErrorBoundary>

        <BlockErrorBoundary label="usage by feature">
          <FeatureUsageCard orgId={orgId} orgTotal={totalUsed} range={dateRange} />
        </BlockErrorBoundary>

        <BlockErrorBoundary label="top users">
          <TopUsersTable
            users={topUsers}
            shownOf={activeCount}
            onViewAll={() => router.push(ORG_MEMBERS_ROUTE)}
            note={topUsersNote}
          />
        </BlockErrorBoundary>
      </div>
    </div>
  )
}
