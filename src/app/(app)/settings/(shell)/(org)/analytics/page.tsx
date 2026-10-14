'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { DownloadOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { BlockErrorBoundary } from '@/components/chat/BlockErrorBoundary'
import { Tooltip } from '@/components/Tooltip'
import { UsageMeter } from '@/components/UsageMeter'
import { Button, IconButton } from '@/components/ui/button'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'
import { AnalyticsPageSkeleton, AnalyticsScroll, PageCard, TopUsersTable } from './_components/AnalyticsParts'
import { useOrgUsage } from './use-org-usage'

// Data: use-org-usage.ts (lib/analytics/org-usage.ts derives every number).

const kpiLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }
const kpiValue: React.CSSProperties = { fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 26, lineHeight: '34px', color: 'var(--neutral-900)', margin: 0, fontVariantNumeric: 'tabular-nums' }
const kpiHint: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }
const kpiTile: React.CSSProperties = { minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, boxShadow: 'var(--shadow-surface-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }

export default function OrgUsageAnalyticsPage() {
  const router = useRouter()
  const { ready, plan, summary, exportCsv } = useOrgUsage()

  if (!ready) {
    return <AnalyticsScroll><AnalyticsPageSkeleton /></AnalyticsScroll>
  }

  const {
    totalCredits, totalUsed, remaining, isEnterprise, monthlyPrice, poolPercentUsed,
    activeCount, pendingCount, utilisationPct, avgPerMember, topUsers, topUsersNote,
  } = summary

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
        {/* Header. There is no date range: the backend reports this cycle's
            totals and per-member credits only, with no per-day or per-feature
            series for an organization. A chart returns when one exists. */}
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Usage
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
              How your workspace is using its credits{plan?.cycleEndLabel && plan.cycleEndLabel !== '—' ? `, this cycle ${isEnterprise ? 'billed' : 'resets'} ${plan.cycleEndLabel}` : ''}.
            </p>
          </div>
          {activeCount > 0 && (
            <Button variant="secondary" size="sm" leftIcon={<DownloadOneIcon size={14} />} onClick={exportCsv}>Export CSV</Button>
          )}
        </div>

        {/* A render error in one card shows a notice instead of blanking the page. */}
        <BlockErrorBoundary label="usage summary">
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
              <p style={kpiValue}>{activeCount}</p>
              <p style={kpiHint}>
                {utilisationPct}% used credits{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
              </p>
            </div>
          </div>
          <p style={{ ...kpiHint, margin: '10px 4px 0' }}>
            About {avgPerMember.toLocaleString()} credits per active member this cycle.
          </p>
        </PageCard>
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
