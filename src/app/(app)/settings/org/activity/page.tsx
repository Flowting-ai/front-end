'use client'

import React, { useEffect, useState } from 'react'
import { Divider } from '@/components/Divider'
import { useOrg } from '@/context/org-context'
import { listAudit } from '@/lib/api/organization'
import type { AuditLogEntry } from '@/types/teams'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const ms   = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgActivityPage() {
  const { orgId, currentUserRole } = useOrg()
  const isAdmin = currentUserRole === 'admin'

  const [entries,      setEntries]      = useState<AuditLogEntry[]>([])
  const [loading,      setLoading]      = useState(false)
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    listAudit(orgId, { limit: 100 })
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orgId])

  // Collect unique action types for filter dropdown
  const actionTypes = ['all', ...Array.from(new Set(entries.map(e => e.action))).sort()]

  const filtered = entries.filter(e => filterAction === 'all' || e.action === filterAction)

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
                  title={entry.createdAt}
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
                <span style={{ width: 180, flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.actorUserId}
                </span>
                <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{entry.action}</span>
                  {entry.targetType && (
                    <span style={{ color: 'var(--neutral-500)' }}> · {entry.targetType}{entry.targetId ? ` ${entry.targetId}` : ''}</span>
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
