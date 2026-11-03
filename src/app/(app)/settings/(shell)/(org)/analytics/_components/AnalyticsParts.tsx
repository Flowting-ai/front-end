'use client'

// Presentational parts of the org Usage page: card shell, top-users table, skeleton.

import React from 'react'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { UsageMeter } from '@/components/UsageMeter'
import {
  SettingsTable,
  SettingsTableCell,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableToolbar,
} from '@/components/SettingsTable'
import { Button } from '@/components/ui/button'

// AnalyticsPageSkeleton draws this table's chrome too. A real top-N cap —
// "Manage members" only makes sense as a way to see the REST of the team, so
// it must stay hidden whenever this list already covers everyone active.

export function PageCard({
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
export const TOP_USER_COLUMNS = 'minmax(0, 1fr) 96px 112px 168px'

export const MEMBER_ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', service: 'Bot' }

interface TopUser {
  id: string
  name: string
  email: string
  role: string
  credits: number
  share: number
  you: boolean
}

export function TopUsersTable({ users, shownOf, onViewAll, note }: {
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

export function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <span style={{
      display: 'block', width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'analyticsSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

/** A bone vertically centred in a text line box, so stacked lines keep the real line-heights. */
function SkeletonLine({ width, lineHeight, height, radius = 4 }: { width: string | number; lineHeight: number; height: number; radius?: number }) {
  return (
    <span style={{ height: lineHeight, display: 'flex', alignItems: 'center' }}>
      <SkeletonBlock width={width} height={height} radius={radius} />
    </span>
  )
}

const SKELETON_TILE: React.CSSProperties = { minWidth: 0, backgroundColor: 'var(--neutral-white)', borderRadius: 12, boxShadow: 'var(--shadow-surface-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }

/** Mirrors page.tsx top to bottom: header + Export, date-range tabs, KPI card, feature card, top-users table. */
export function AnalyticsPageSkeleton() {
  return (
    <>
      <style>{`@keyframes analyticsSkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div aria-busy="true" style={{ flex: '1 0 0', minWidth: 0, maxWidth: 908, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header: title + description, Export CSV at the right end */}
        <div style={{ paddingLeft: 4, marginBottom: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <SkeletonLine width={90} lineHeight={32} height={22} radius={6} />
            <SkeletonLine width={250} lineHeight={22} height={14} />
          </div>
          <SkeletonBlock width={117} height={32} radius={8} />
        </div>

        {/* Date-range tabs + note */}
        <div style={{ paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SkeletonBlock width={302} height={38} radius={11} />
          <SkeletonLine width={265} lineHeight={18} height={12} />
        </div>

        {/* KPI card: wide plan tile + Remaining + Active members, caption below */}
        <PageCard padding={12}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ ...SKELETON_TILE, gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <SkeletonLine width={162} lineHeight={24} height={13} />
                <SkeletonBlock width={94} height={22} radius={999} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SkeletonLine width={86} lineHeight={34} height={24} radius={6} />
                <SkeletonBlock width={126} height={16} radius={4} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <SkeletonLine width={250} lineHeight={20} height={13} />
                  <SkeletonLine width={26} lineHeight={20} height={13} />
                </div>
                <SkeletonBlock width="100%" height={6} radius={999} />
              </div>
            </div>
            {[{ label: 70, hint: 110 }, { label: 96, hint: 100 }].map((t, i) => (
              <div key={i} style={SKELETON_TILE}>
                <SkeletonLine width={t.label} lineHeight={i === 0 ? 20 : 24} height={13} />
                <SkeletonLine width={i === 0 ? 72 : 20} lineHeight={34} height={24} radius={6} />
                <SkeletonLine width={t.hint} lineHeight={16} height={11} />
              </div>
            ))}
          </div>
          <div style={{ margin: '10px 4px 0' }}><SkeletonLine width={270} lineHeight={20} height={13} /></div>
        </PageCard>

        {/* Credit usage by feature: header + Mine/Organization toggle, total, note box, chart frame */}
        <PageCard padding={0}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <SkeletonLine width={170} lineHeight={22} height={16} />
              <div style={{ marginTop: 2 }}><SkeletonLine width={220} lineHeight={20} height={13} /></div>
            </div>
            <SkeletonBlock width={147} height={38} radius={11} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SkeletonLine width={86} lineHeight={34} height={24} radius={6} />
              <SkeletonBlock width={122} height={16} radius={4} />
            </div>
            <SkeletonBlock width="100%" height={60} radius={10} />
            <div>
              <div style={{ position: 'relative', height: 200 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, borderTop: `1px ${i === 4 ? 'solid' : 'dashed'} var(--neutral-200)` }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SkeletonBlock width={289} height={36} radius={10} />
                </div>
              </div>
              <div aria-hidden style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                {[0, 1, 2, 3, 4, 5, 6].map(i => <SkeletonLine key={i} width={32} lineHeight={16} height={10} />)}
              </div>
            </div>
          </div>
        </PageCard>

        {/* Top users: same SettingsTable chrome as TopUsersTable */}
        <SettingsTable columns={TOP_USER_COLUMNS} columnGap={0}>
          <SettingsTableToolbar
            title={
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <SkeletonLine width={150} lineHeight={22} height={16} />
                <SkeletonLine width={215} lineHeight={20} height={13} />
              </span>
            }
          >
            <SkeletonBlock width={140} height={32} radius={8} />
          </SettingsTableToolbar>
          <div>
            <SettingsTableHeader>
              <SettingsTableHeaderCell><SkeletonLine width={56} lineHeight={22} height={13} /></SettingsTableHeaderCell>
              <SettingsTableHeaderCell><SkeletonLine width={32} lineHeight={22} height={13} /></SettingsTableHeaderCell>
              <SettingsTableHeaderCell align="end"><span style={{ display: 'flex', justifyContent: 'flex-end' }}><SkeletonLine width={46} lineHeight={22} height={13} /></span></SettingsTableHeaderCell>
              <SettingsTableHeaderCell align="end"><span style={{ display: 'flex', justifyContent: 'flex-end' }}><SkeletonLine width={92} lineHeight={22} height={13} /></span></SettingsTableHeaderCell>
            </SettingsTableHeader>
            {[0, 1].map(row => (
              <SettingsTableRow key={row} minHeight={68}>
                <SettingsTableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <SkeletonBlock width={22} height={22} radius={6} />
                    <SkeletonBlock width={32} height={32} radius={999} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <SkeletonLine width={row === 0 ? 80 : 74} lineHeight={22} height={14} />
                      <SkeletonLine width={row === 0 ? 93 : 170} lineHeight={16} height={10} />
                    </div>
                  </div>
                </SettingsTableCell>
                <SettingsTableCell><SkeletonBlock width={row === 0 ? 41 : 51} height={20} radius={6} /></SettingsTableCell>
                <SettingsTableCell align="end"><SkeletonLine width={46} lineHeight={22} height={14} /></SettingsTableCell>
                <SettingsTableCell align="end">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 140 }}>
                    <div style={{ flex: '1 0 0', minWidth: 0 }}><SkeletonBlock width="100%" height={4} radius={999} /></div>
                    <div style={{ width: 36, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><SkeletonBlock width={28} height={13} radius={4} /></div>
                  </div>
                </SettingsTableCell>
              </SettingsTableRow>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '0 24px' }}>
            <div style={{ marginTop: 1 }}><SkeletonBlock width={14} height={14} radius={999} /></div>
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <SkeletonLine width="100%" lineHeight={16} height={10} />
              <SkeletonLine width="45%" lineHeight={16} height={10} />
            </div>
          </div>
        </SettingsTable>

      </div>
    </>
  )
}

/** The page's scroll region (shared with loading.tsx). */
export function AnalyticsScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
      {children}
    </div>
  )
}
