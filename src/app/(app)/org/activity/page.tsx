'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { SearchOneIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import type { BadgeColor } from '@/components/Badge'
import { InputField } from '@/components/InputField'
import {
  SettingsTable,
  SettingsTableToolbar,
  SettingsTableHeader,
  SettingsTableHeaderCell,
  SettingsTableRow,
  SettingsTableCell,
  SettingsTableFooter,
} from '@/components/SettingsTable'
import { useOrg } from '@/context/org-context'
import { listAudit } from '@/lib/api/organization'
import { parseServerDate, formatServerDateTime } from '@/lib/utils/format-utils'
import type { AuditLogEntry } from '@/types/teams'

const ACTIVITY_COLUMNS = '120px minmax(220px, 1.3fr) 200px minmax(200px, 1.2fr)'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Backend timestamps are UTC, often without a 'Z' suffix — parseServerDate
// normalises them so we don't get negative ("future") deltas from the local-time
// misparse.
function relativeTime(ts: string): string {
  const d = parseServerDate(ts)
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// "invite_sent" / "connector.account.added" → "Invite sent" / "Connector account added"
function humanizeAction(action: string): string {
  const spaced = action.replace(/[._]/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Colour the action badge by family so the log is scannable at a glance.
function actionColor(action: string): BadgeColor {
  if (/(removed|deleted|unlinked|denied|revoked)/.test(action)) return 'Red'
  if (/(created|added|accepted|published|linked|granted|approved)/.test(action)) return 'Green'
  if (/(requested|sent|pending)/.test(action)) return 'Yellow'
  if (/(role|cap|ownership|status|catalog|settings|updated|changed)/.test(action)) return 'Blue'
  return 'Neutral'
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height, radius = 8 }: { width?: string | number; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-50) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'activitySkeletonShimmer 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  )
}

function ActivityPageSkeleton() {
  return (
    <>
      <style>{`@keyframes activitySkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 1008, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={140} height={28} radius={6} />
          <SkeletonBlock width={300} height={14} radius={4} />
        </div>
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 16, boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12)', background: 'var(--neutral-50)', overflow: 'hidden', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={110} height={18} radius={6} />
            <SkeletonBlock width={220} height={34} radius={10} />
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', minHeight: 72, borderBottom: '1px solid var(--neutral-100)' }}>
              <SkeletonBlock width={60} height={12} radius={4} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 0 0' }}>
                <SkeletonBlock width={32} height={32} radius={16} />
                <SkeletonBlock width={130} height={12} radius={4} />
              </div>
              <SkeletonBlock width={120} height={22} radius={8} />
              <SkeletonBlock width={140} height={12} radius={4} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgActivityPage() {
  const { orgId, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [entries,      setEntries]      = useState<AuditLogEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterAction, setFilterAction] = useState('all')
  const [search,       setSearch]       = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!orgId) { setLoading(false); return }
      setLoading(true)
      listAudit(orgId, { limit: 100 })
        .then(rows => { if (!cancelled) setEntries(rows) })
        .catch(console.error)
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [orgId])

  const actionTypes = useMemo(
    () => ['all', ...Array.from(new Set(entries.map(e => e.action))).sort()],
    [entries],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filterAction !== 'all' && e.action !== filterAction) return false
      if (!q) return true
      return (
        humanizeAction(e.action).toLowerCase().includes(q)
        || (e.actorName ?? '').toLowerCase().includes(q)
        || (e.actorEmail ?? '').toLowerCase().includes(q)
        || (e.targetName ?? '').toLowerCase().includes(q)
        || (e.targetType ?? '').toLowerCase().includes(q)
      )
    })
  }, [entries, filterAction, search])

  if (loading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}>
        <ActivityPageSkeleton />
      </div>
    )
  }

  return (
    <div
      className="kaya-scrollbar"
      style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingBottom: 48 }}
    >
      {/* Horizontal padding lives here, not on the scrolling element above —
          keeps the scrollbar flush with the container's edge. */}
      <div style={{ width: '100%', maxWidth: 1008, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
            Activity Log
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            {isAdmin ? 'All workspace actions across all members.' : 'Your activity in this workspace.'}
          </p>
        </div>

        <SettingsTable columns={ACTIVITY_COLUMNS} columnGap={24}>
          <SettingsTableToolbar title="Recent activity" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, maxWidth: '100%' }}>
              <div style={{ width: 220, maxWidth: '100%', flexShrink: 1 }}>
                <InputField
                  label="Search activity"
                  showLabel={false}
                  showSubtitle={false}
                  size="small"
                  fluid
                  leftIcon={<SearchOneIcon size={16} />}
                  placeholder="Search activity"
                  value={search}
                  onChange={setSearch}
                />
              </div>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                style={{ height: 32, borderRadius: 8, border: 'none', boxShadow: '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)', padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-700)', outline: 'none', backgroundColor: 'var(--text-field-bg)', cursor: 'pointer' }}
              >
                {actionTypes.map(t => (
                  <option key={t} value={t}>{t === 'all' ? 'All actions' : humanizeAction(t)}</option>
                ))}
              </select>
            </div>
          </SettingsTableToolbar>

          <div className="kaya-scrollbar" style={{ overflowX: 'auto' }}>
            <div role="table" aria-label="Activity log" style={{ minWidth: 820 }}>
              <SettingsTableHeader>
                <SettingsTableHeaderCell>When</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Actor</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Action</SettingsTableHeaderCell>
                <SettingsTableHeaderCell>Target</SettingsTableHeaderCell>
              </SettingsTableHeader>

              {filtered.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                    {entries.length === 0 ? 'No activity recorded yet in this workspace' : 'No activity matches your filters'}
                  </p>
                </div>
              ) : filtered.map(entry => {
                const actor = entry.actorName || entry.actorEmail || 'A member'
                return (
                  <SettingsTableRow key={entry.id} minHeight={72}>
                    <SettingsTableCell>
                      <span title={formatServerDateTime(entry.createdAt, entry.createdAt)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neutral-500)', cursor: 'default' }}>
                        {relativeTime(entry.createdAt)}
                      </span>
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Avatar name={actor} size="md" />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {actor}
                          </p>
                          {entry.actorEmail && entry.actorName && (
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-500)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.actorEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </SettingsTableCell>
                    <SettingsTableCell>
                      <Badge label={humanizeAction(entry.action)} color={actionColor(entry.action)} />
                    </SettingsTableCell>
                    <SettingsTableCell>
                      {entry.targetName || entry.targetType ? (
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.targetName || '—'}
                          </p>
                          {entry.targetType && (
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--neutral-500)', margin: 0, textTransform: 'capitalize' }}>
                              {entry.targetType}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)' }}>—</span>
                      )}
                    </SettingsTableCell>
                  </SettingsTableRow>
                )
              })}

              <SettingsTableFooter style={{ borderTop: '1px solid var(--neutral-100)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                  Retains 90 days of history · showing {filtered.length} of {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                </span>
              </SettingsTableFooter>
            </div>
          </div>
        </SettingsTable>
      </div>
    </div>
  )
}
