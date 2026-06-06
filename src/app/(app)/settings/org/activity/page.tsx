'use client'

import React, { useState } from 'react'
import { SearchOneIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'

type AuditFilter = 'all' | 'last30'

const AUDIT_ROWS: Array<{
  actor: string
  badge: string
  badgeColor: BadgeColor
  action: string
  timestamp: string
}> = [
  {
    actor:      'Harsh Kirdolia',
    badge:      'SETTINGS',
    badgeColor: 'Blue',
    action:     'Published "Brand Voice" to Marketing team',
    timestamp:  'Today, 09:14 PM',
  },
  {
    actor:      'Harsh Kirdolia',
    badge:      'PERSONA',
    badgeColor: 'Purple',
    action:     'Approved persona "Legal Reviewer" submitted by Harsh Kirdolia',
    timestamp:  'Yesterday, 06:14 AM',
  },
  {
    actor:      'Harsh Kirdolia',
    badge:      'CONNECTOR',
    badgeColor: 'Green',
    action:     'Connected workspace integration: Google Drive',
    timestamp:  'Today, 9:14 PM',
  },
  {
    actor:      'Harsh Kirdolia',
    badge:      'MEMBER',
    badgeColor: 'Yellow',
    action:     'Invited designer@partnerco.com to workspace as Member',
    timestamp:  'Today, 9:14 PM',
  },
  {
    actor:      'System',
    badge:      'SETTINGS',
    badgeColor: 'Blue',
    action:     'Workspace plan renewed - Team $150 charged to Mastercard ••••9239',
    timestamp:  'Today, 9:14 PM',
  },
]

function PageCard({
  children,
  muted = false,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <section
      style={{
        width:           '100%',
        border:          '1px solid var(--neutral-200)',
        borderRadius:    16,
        boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
        overflow:        'hidden',
        backgroundColor: muted ? '#f9f5f1' : 'var(--neutral-50)',
      }}
    >
      {children}
    </section>
  )
}

function SmallTabs({
  value,
  onChange,
}: {
  value: AuditFilter
  onChange: (value: AuditFilter) => void
}) {
  const tabs: Array<{ id: AuditFilter; label: string }> = [
    { id: 'all',    label: 'All actions' },
    { id: 'last30', label: 'Last 30 days' },
  ]

  return (
    <div
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             2,
        padding:         1,
        borderRadius:    8,
        backgroundColor: 'rgba(247,242,237,0.5)',
        boxShadow:       'inset 0px -1px 0px rgba(255,255,255,0.9), inset 0px 1px 0px var(--neutral-100), inset 0px 0px 4px rgba(209,198,189,0.5)',
      }}
    >
      {tabs.map(tab => {
        const selected = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border:          'none',
              borderRadius:    8,
              padding:         7,
              backgroundColor: selected ? 'white' : 'transparent',
              boxShadow:       selected ? '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px rgba(38,33,30,0.1)' : undefined,
              color:           selected ? 'var(--neutral-700)' : 'var(--neutral-500)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        11,
              lineHeight:      '16px',
              whiteSpace:      'nowrap',
              cursor:          'pointer',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function OrgActivityPage() {
  const [filter, setFilter] = useState<AuditFilter>('all')

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
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', paddingLeft: 4 }}>
            <h1 style={{ flex: '1 0 0', fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Audit Log
            </h1>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '5px 6px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Complete, immutable record of all workspace events. Member changes, settings updates, persona approvals, and billing actions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PageCard muted>
            <div style={{ padding: '12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Admin only
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '6px 0 0' }}>
                Immutable record of all workspace activity. Logs retained for 90 days on Team plan.
              </p>
            </div>
          </PageCard>

          <PageCard>
            <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div
                style={{
                  flex:            '1 0 0',
                  minWidth:        0,
                  height:          38,
                  borderRadius:    10,
                  backgroundColor: 'white',
                  boxShadow:       '0px 1px 1.5px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                  padding:         '0 10px',
                  display:         'flex',
                  alignItems:      'center',
                  gap:             2,
                }}
              >
                <SearchOneIcon size={16} color="var(--neutral-600)" />
                <span style={{ flex: '1 0 0', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', padding: '0 2px' }}>
                  Filter by ACTOR(member)...
                </span>
              </div>
              <SmallTabs value={filter} onChange={setFilter} />
            </div>
          </PageCard>

          <PageCard>
            <div style={{ padding: '12px 24px 0' }}>
              <div
                style={{
                  display:             'grid',
                  gridTemplateColumns: 'minmax(136px, 1fr) minmax(360px, 649px) minmax(150px, 1fr)',
                  alignItems:          'center',
                  padding:             '6px 24px 24px 0',
                  borderBottom:        '1px solid var(--neutral-100)',
                }}
              >
                {['ACTOR', 'ACTION', 'TIMESTAMP'].map((heading, index) => (
                  <p key={heading} style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, textAlign: index === 2 ? 'center' : 'left' }}>
                    {heading}
                  </p>
                ))}
              </div>
              {AUDIT_ROWS.map(row => (
                <div
                  key={`${row.actor}-${row.action}`}
                  style={{
                    display:             'grid',
                    gridTemplateColumns: 'minmax(136px, 1fr) minmax(360px, 649px) minmax(150px, 1fr)',
                    alignItems:          'center',
                    minHeight:           96,
                    paddingRight:        24,
                    borderBottom:        '1px solid var(--neutral-100)',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                    {row.actor}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
                    <Badge label={row.badge} color={row.badgeColor} />
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0, minWidth: 0 }}>
                      {row.action}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0, textAlign: 'center' }}>
                    {row.timestamp}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'center' }}>
              <Button variant="outline" size="sm">Load more events</Button>
            </div>
          </PageCard>

          <PageCard muted>
            <div style={{ padding: '12px 24px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>
                Team plan : 90-day log retention
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '6px 0 0' }}>
                Enterprise includes unlimited retention, real-time webhook export to your SIEM, and per-user activity drilldowns.
              </p>
            </div>
          </PageCard>
        </div>
      </div>
    </div>
  )
}
