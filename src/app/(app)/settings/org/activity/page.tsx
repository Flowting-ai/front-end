'use client'

import React, { useState } from 'react'
import { Avatar }  from '@/components/Avatar'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Divider } from '@/components/Divider'

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType =
  | 'connector_connected' | 'connector_disconnected'
  | 'automation_run'      | 'settings_changed'
  | 'member_invited'      | 'member_removed' | 'role_changed'
  | 'team_created'        | 'team_archived'  | 'persona_published'

interface ActivityEntry {
  id:         string
  timestamp:  string
  memberId:   string
  memberName: string
  actionType: ActionType
  detail:     string
}

// Badge color per action type — DECISIONS.md (may-day)
const ACTION_BADGE: Record<ActionType, { color: BadgeColor; label: string }> = {
  connector_connected:    { color: 'Blue',    label: 'Connector' },
  connector_disconnected: { color: 'Blue',    label: 'Connector' },
  automation_run:         { color: 'Purple',  label: 'Automation' },
  settings_changed:       { color: 'Neutral', label: 'Settings' },
  member_invited:         { color: 'Yellow',  label: 'Member' },
  member_removed:         { color: 'Yellow',  label: 'Member' },
  role_changed:           { color: 'Yellow',  label: 'Member' },
  team_created:           { color: 'Green',   label: 'Team' },
  team_archived:          { color: 'Green',   label: 'Team' },
  persona_published:      { color: 'Purple',  label: 'Persona' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const ms   = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Mock data — replaced by API when available ────────────────────────────────

const MOCK: ActivityEntry[] = [
  { id: 'a01', timestamp: new Date(Date.now() - 2*3600000).toISOString(),   memberId: 'u1', memberName: 'Chai Landge',  actionType: 'connector_connected',    detail: 'Connected GitHub workspace connector' },
  { id: 'a02', timestamp: new Date(Date.now() - 5*3600000).toISOString(),   memberId: 'u2', memberName: 'Alex Rivera',  actionType: 'persona_published',      detail: 'Published "Brand Voice" to Marketing team' },
  { id: 'a03', timestamp: new Date(Date.now() - 8*3600000).toISOString(),   memberId: 'u1', memberName: 'Chai Landge',  actionType: 'member_invited',         detail: 'Invited sam@acmeinc.com as Member' },
  { id: 'a04', timestamp: new Date(Date.now() - 12*3600000).toISOString(),  memberId: 'u2', memberName: 'Alex Rivera',  actionType: 'automation_run',         detail: 'Brain run: Weekly content brief' },
  { id: 'a05', timestamp: new Date(Date.now() - 24*3600000).toISOString(),  memberId: 'u1', memberName: 'Chai Landge',  actionType: 'settings_changed',       detail: 'Updated HITL threshold to Ask Tier 3+' },
  { id: 'a06', timestamp: new Date(Date.now() - 26*3600000).toISOString(),  memberId: 'u3', memberName: 'Jordan Kim',   actionType: 'connector_connected',    detail: 'Connected Linear personal connector' },
  { id: 'a07', timestamp: new Date(Date.now() - 48*3600000).toISOString(),  memberId: 'u1', memberName: 'Chai Landge',  actionType: 'team_created',           detail: 'Created team "Design"' },
  { id: 'a08', timestamp: new Date(Date.now() - 52*3600000).toISOString(),  memberId: 'u2', memberName: 'Alex Rivera',  actionType: 'role_changed',           detail: 'Changed Jordan Kim from Member to Editor' },
  { id: 'a09', timestamp: new Date(Date.now() - 72*3600000).toISOString(),  memberId: 'u1', memberName: 'Chai Landge',  actionType: 'connector_disconnected', detail: 'Disconnected Salesforce connector' },
  { id: 'a10', timestamp: new Date(Date.now() - 96*3600000).toISOString(),  memberId: 'u2', memberName: 'Alex Rivera',  actionType: 'automation_run',         detail: 'Brain run: Competitor analysis' },
  { id: 'a11', timestamp: new Date(Date.now() - 120*3600000).toISOString(), memberId: 'u1', memberName: 'Chai Landge',  actionType: 'member_removed',         detail: 'Removed former contractor from workspace' },
  { id: 'a12', timestamp: new Date(Date.now() - 144*3600000).toISOString(), memberId: 'u1', memberName: 'Chai Landge',  actionType: 'team_archived',          detail: 'Archived team "Temp Project"' },
]

const MEMBERS = [
  { id: 'all', name: 'All members' },
  { id: 'u1',  name: 'Chai Landge' },
  { id: 'u2',  name: 'Alex Rivera' },
  { id: 'u3',  name: 'Jordan Kim' },
]

const ACTION_TYPES = [
  { id: 'all',                    label: 'All actions' },
  { id: 'connector_connected',    label: 'Connector connected' },
  { id: 'connector_disconnected', label: 'Connector disconnected' },
  { id: 'automation_run',         label: 'Automation run' },
  { id: 'settings_changed',       label: 'Settings changed' },
  { id: 'member_invited',         label: 'Member invited' },
  { id: 'member_removed',         label: 'Member removed' },
  { id: 'role_changed',           label: 'Role changed' },
  { id: 'team_created',           label: 'Team created' },
  { id: 'persona_published',      label: 'Persona published' },
]

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
  // TODO: derive isAdmin from useWorkspace() when auth context is wired
  const isAdmin = true
  const CURRENT_USER_ID = 'u1'

  const [filterMember, setFilterMember] = useState('all')
  const [filterAction, setFilterAction] = useState('all')

  const entries = MOCK
    .filter(e => isAdmin || e.memberId === CURRENT_USER_ID)
    .filter(e => filterMember === 'all' || e.memberId === filterMember)
    .filter(e => filterAction === 'all' || e.actionType === filterAction)

  const hasFilters = filterMember !== 'all' || filterAction !== 'all'

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
          {isAdmin && (
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              style={SELECT_STYLE}
            >
              {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={SELECT_STYLE}
          >
            {ACTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterMember('all'); setFilterAction('all') }}
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
              Clear filters
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
              display:    'flex',
              alignItems: 'center',
              padding:    '6px 24px 8px',
              borderBottom: '1px solid var(--neutral-100)',
              gap:        0,
            }}
          >
            <span style={{ width: 90,  flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Time</span>
            {isAdmin && <span style={{ width: 160, flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Member</span>}
            <span style={{ width: 100, flexShrink: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Action</span>
            <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>Detail</span>
          </div>

          {/* Rows */}
          {entries.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-400)', margin: 0 }}>
                No activity recorded yet in this workspace
              </p>
            </div>
          ) : entries.map((entry, i) => {
            const badge = ACTION_BADGE[entry.actionType]
            return (
              <React.Fragment key={entry.id}>
                {i > 0 && <Divider decorative style={{ backgroundColor: 'var(--neutral-100)', margin: 0 }} />}
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px', gap: 0 }}>
                  <span
                    title={entry.timestamp}
                    style={{
                      width:         90,
                      flexShrink:    0,
                      fontFamily:    'var(--font-body)',
                      fontSize:      'var(--font-size-caption)',
                      color:         'var(--neutral-500)',
                      cursor:        'default',
                    }}
                  >
                    {relativeTime(entry.timestamp)}
                  </span>
                  {isAdmin && (
                    <div style={{ width: 160, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <Avatar name={entry.memberName} size="sm" />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.memberName}
                      </span>
                    </div>
                  )}
                  <div style={{ width: 100, flexShrink: 0 }}>
                    <Badge color={badge.color} label={badge.label} />
                  </div>
                  <p style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.detail}
                  </p>
                </div>
              </React.Fragment>
            )
          })}

          {/* Footer */}
          <div style={{ padding: '10px 24px', borderTop: '1px solid var(--neutral-100)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--font-size-caption)', color: 'var(--neutral-400)', margin: 0 }}>
              Activity log retains 90 days of history
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
