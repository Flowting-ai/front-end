'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Tooltip } from '@/components/Tooltip'
import { Avatar } from '@/components/Avatar'
import { UsageMeter } from '@/components/UsageMeter'
import { SettingsTable, SettingsTableCell, SettingsTableHeader, SettingsTableHeaderCell, SettingsTableRow, SettingsTableToolbar } from '@/components/SettingsTable'
import { Button, IconButton } from '@/components/ui/button'
import { useOrg } from '@/context/org-context'
import { useAuth } from '@/context/auth-context'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'

// Matches AnalyticsPageSkeleton's 4 placeholder rows below. A real top-N cap —
// "Manage members" only makes sense as a way to see the REST of the team, so
// it must stay hidden whenever this list already covers everyone active.
const TOP_USERS_LIMIT = 4

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


// Same table language as /settings/members. Member usage is a billing-cycle total from the backend,
// so the table says "this cycle" and each share is of the team's
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

  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed    = plan?.used        ?? 0
  const isEnterprise = plan?.isEnterprise ?? false
  const monthlyPrice = plan?.monthlyPrice ?? 0

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
