'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Divider } from '@/components/Divider'
import { useOrg } from '@/context/org-context'
import { listAudit } from '@/lib/api/organization'
import { parseServerDate, formatServerDateTime } from '@/lib/utils/format-utils'
import type { AuditLogEntry } from '@/types/teams'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Backend timestamps are UTC, often without a 'Z' suffix — parseServerDate
// normalises them so we don't get negative ("future") deltas from the local-time
// misparse. Always uses Date.now() minus the parsed instant.
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

// "invite_sent" → "Invite sent"
function humanizeAction(action: string): string {
  const spaced = action.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const SELECT_STYLE: React.CSSProperties = {
  height:          32,
  borderRadius:    8,
  border:          'none',
  boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
  padding:         '0 8px',
  fontFamily:      'var(--font-body)',
  fontSize:        'var(--font-size-caption)',
  color:           'var(--neutral-700)',
  outline:         'none',
  backgroundColor: 'white',
  cursor:          'pointer',
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

const SKELETON_ROWS: Array<{ actor: number; action: number }> = [
  { actor: 130, action: 200 },
  { actor: 110, action: 160 },
  { actor: 145, action: 220 },
  { actor: 100, action: 180 },
  { actor: 135, action: 195 },
  { actor: 115, action: 170 },
  { actor: 150, action: 210 },
  { actor: 105, action: 155 },
]

function ActivityPageSkeleton() {
  return (
    <>
      <style>{`@keyframes activitySkeletonShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Page header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock width={140} height={28} radius={6} />
          <SkeletonBlock width={260} height={14} radius={4} />
        </div>

        {/* Filter bar */}
        <SkeletonBlock width={140} height={32} radius={8} />

        {/* Table card */}
        <div style={{ borderRadius: 16, border: '1px solid var(--neutral-200)', backgroundColor: '#f9f5f1', boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 24px 8px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ width: 90,  flexShrink: 0 }}><SkeletonBlock width={40} height={12} radius={4} /></div>
            <div style={{ width: 180, flexShrink: 0 }}><SkeletonBlock width={45} height={12} radius={4} /></div>
            <div style={{ flex: '1 0 0' }}><SkeletonBlock width={55} height={12} radius={4} /></div>
          </div>

          {/* Skeleton rows */}
          {SKELETON_ROWS.map((row, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <div style={{ width: 90,  flexShrink: 0 }}><SkeletonBlock width={60} height={12} radius={4} /></div>
                <div style={{ width: 180, flexShrink: 0 }}><SkeletonBlock width={row.actor} height={12} radius={4} /></div>
                <div style={{ flex: '1 0 0' }}><SkeletonBlock width={row.action} height={12} radius={4} /></div>
              </div>
            </React.Fragment>
          ))}

          {/* Footer */}
          <div style={{ padding: '10px 24px', borderTop: '1px solid var(--neutral-100)' }}>
            <SkeletonBlock width={280} height={12} radius={4} />
          </div>
        </div>

      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgActivityPage() {
  const { orgId, currentUserRole, members, teams } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [entries,      setEntries]      = useState<AuditLogEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterAction, setFilterAction] = useState('all')

  // user_id → display name (fall back to email, then a generic label — never a raw id).
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      if (m.id) map.set(m.id, m.name?.trim() || m.email?.trim() || 'A member')
    }
    return map
  }, [members])

  // team id → team name, to resolve target ids in the Action column.
  const teamNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams) map.set(t.id, t.name)
    return map
  }, [teams])

  const actorLabel = (id: string): string => memberNameById.get(id) ?? 'A member'

  // Resolve a target id to a human label when we can (currently teams). When we
  // can't, return '' so we show just the target type — never a raw id.
  const targetLabel = (type: string | null, id: string): string => {
    if (type === 'team') return teamNameById.get(id) ?? ''
    return ''
  }

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    listAudit(orgId, { limit: 100 })
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId])

  // Collect unique action types for filter dropdown
  const actionTypes = ['all', ...Array.from(new Set(entries.map(e => e.action))).sort()]

  const filtered = entries.filter(e => filterAction === 'all' || e.action === filterAction)

  if (loading) {
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <ActivityPageSkeleton />
      </div>
    )
  }

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
        padding:        '64px 24px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Page header */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 28, lineHeight: '36px', color: 'var(--neutral-900)', margin: 0 }}>
            Activity Log
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            {isAdmin ? 'All workspace actions across all members.' : 'Your activity in this workspace.'}
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={SELECT_STYLE}
          >
            {actionTypes.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All actions' : t}</option>
            ))}
          </select>
          {filterAction !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterAction('all')}
              style={{
                background:    'none',
                border:        'none',
                cursor:        'pointer',
                fontFamily:    'var(--font-body)',
                fontSize:      'var(--font-size-caption)',
                color:         'var(--neutral-400)',
                textDecoration: 'underline',
                padding:       0,
              }}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Table card */}
        <div
          style={{
            borderRadius:    16,
            border:          '1px solid var(--neutral-200)',
            backgroundColor: '#f9f5f1',
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)',
            overflow:        'hidden',
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display:      'flex',
              alignItems:   'center',
              padding:      '6px 24px 8px',
              borderBottom: '1px solid var(--neutral-100)',
            }}
          >
            <span style={{ width: 90,  flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Time</span>
            <span style={{ width: 180, flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Actor</span>
            <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Action</span>
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                Loading activity…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No activity recorded yet in this workspace
              </p>
            </div>
          ) : filtered.map((entry, i) => (
            <React.Fragment key={entry.id}>
              {i > 0 && <Divider decorative style={{ backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px' }}>
                <span
                  title={formatServerDateTime(entry.createdAt, entry.createdAt)}
                  style={{
                    width:      90,
                    flexShrink: 0,
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    color:      'var(--neutral-500)',
                    cursor:     'default',
                  }}
                >
                  {relativeTime(entry.createdAt)}
                </span>
                <span
                  title={actorLabel(entry.actorUserId)}
                  style={{ width: 180, flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}
                >
                  {actorLabel(entry.actorUserId)}
                </span>
                <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{humanizeAction(entry.action)}</span>
                  {entry.targetType && (
                    <span style={{ color: 'var(--neutral-500)' }}> · {entry.targetType}{entry.targetId && targetLabel(entry.targetType, entry.targetId) ? ` ${targetLabel(entry.targetType, entry.targetId)}` : ''}</span>
                  )}
                </p>
              </div>
            </React.Fragment>
          ))}

          {/* Footer */}
          <div style={{ padding: '10px 24px', borderTop: '1px solid var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-400)', margin: 0 }}>
              Activity log retains 90 days of history · showing {filtered.length} entries
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
