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

// Matches AnalyticsPageSkeleton's 4 placeholder rows below. A real top-N cap —
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
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'analyticsSkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

export function AnalyticsPageSkeleton() {
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



/** The page's scroll region (shared with loading.tsx). */
export function AnalyticsScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
      {children}
    </div>
  )
}
