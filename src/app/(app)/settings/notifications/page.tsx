'use client'

import React, { useState } from 'react'
import { Switch }   from '@/components/Switch'
import { Checkbox } from '@/components/Checkbox'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotifState { inApp: boolean; email: boolean }
type NotifMap = Record<string, NotifState>

// ── Initial defaults (matches Figma design) ───────────────────────────────────

const DEFAULTS: NotifMap = {
  // Activity – Automations
  'automation-complete': { inApp: true,  email: true  },
  'automation-failed':   { inApp: true,  email: true  },
  // Activity – Content
  'pin-created':         { inApp: true,  email: false },
  'file-processed':      { inApp: true,  email: false },
  'memory-updated':      { inApp: false, email: true  },
  // Activity – Usage
  'budget-alert':        { inApp: true,  email: false },
  // Team & Collaboration
  'team-invite':         { inApp: true,  email: true  },
  'persona-invite':      { inApp: true,  email: true  },
  'workflow-invite':     { inApp: true,  email: true  },
  // Billing (locked email-on)
  'payment-successful':  { inApp: true,  email: true  },
  'payment-failed':      { inApp: true,  email: true  },
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: 'transparent',
        boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  )
}

// Column labels + switch cells share this spacing contract:
// each cell is 43px wide (centred), gap between cells is 32px.
const COL_W   = 43
const COL_GAP = 32

function ColHeaders() {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      paddingLeft:  24,
      paddingRight: 48,
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }} />
      <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'center' }}>
        {['In-app', 'Email'].map(label => (
          <div key={label} style={{ width: COL_W, display: 'flex', justifyContent: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize:   14,
              lineHeight: '22px',
              color:      'var(--neutral-900)',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily:    'var(--font-body)',
      fontWeight:    500,
      fontSize:      14,
      lineHeight:    '22px',
      color:         'var(--neutral-900)',
      margin:        0,
      letterSpacing: '0.03em',
      whiteSpace:    'nowrap',
    }}>
      {children}
    </p>
  )
}

function NotifRow({
  id,
  label,
  description,
  prefs,
  onChange,
  divider,
  emailLocked,
}: {
  id:           string
  label:        string
  description:  string
  prefs:        NotifMap
  onChange:     (id: string, field: 'inApp' | 'email', val: boolean) => void
  divider?:     boolean
  emailLocked?: boolean
}) {
  const state = prefs[id] ?? { inApp: false, email: false }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          12,
      padding:      '6px 0 12px',
      borderBottom: divider ? '1px solid var(--neutral-100)' : undefined,
    }}>
      {/* Label + description */}
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}>
          {label}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   11,
          lineHeight: '16px',
          color:      'var(--neutral-500)',
          margin:     0,
        }}>
          {description}
        </p>
      </div>

      {/* Switch columns */}
      <div style={{ display: 'flex', gap: COL_GAP, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: COL_W, display: 'flex', justifyContent: 'center' }}>
          <Switch
            checked={state.inApp}
            onCheckedChange={v => onChange(id, 'inApp', v)}
          />
        </div>
        <div style={{ width: COL_W, display: 'flex', justifyContent: 'center' }}>
          <Switch
            checked={state.email}
            disabled={emailLocked}
            onCheckedChange={v => !emailLocked && onChange(id, 'email', v)}
          />
        </div>
      </div>
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function NotifCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border:        '1px solid var(--neutral-200)',
      borderRadius:  16,
      boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
      overflow:      'hidden',
      paddingTop:    12,
    }}>
      {children}
    </div>
  )
}

function CardHeader({
  title,
  onEnableAll,
  onMuteAll,
}: {
  title:       string
  onEnableAll: () => void
  onMuteAll:   () => void
}) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          4,
      padding:      '12px 24px 24px',
      borderBottom: '1px solid var(--neutral-100)',
    }}>
      <p style={{
        flex:         '1 0 0',
        minWidth:     0,
        fontFamily:   'var(--font-body)',
        fontWeight:   500,
        fontSize:     16,
        lineHeight:   '22px',
        color:        'var(--neutral-900)',
        margin:       0,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {title}
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <GhostButton onClick={onEnableAll}>Enable all</GhostButton>
        <GhostButton onClick={onMuteAll}>Mute all</GhostButton>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotifMap>(DEFAULTS)

  const [budgetAlerts, setBudgetAlerts] = useState({
    pct65:  true,
    pct90:  true,
    pct100: false,
  })

  const handleChange = (id: string, field: 'inApp' | 'email', val: boolean) => {
    setPrefs(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  const enableGroup = (ids: string[]) =>
    setPrefs(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = { inApp: true, email: true } })
      return next
    })

  const muteGroup = (ids: string[]) =>
    setPrefs(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = { inApp: false, email: false } })
      return next
    })

  const ACTIVITY_IDS  = ['automation-complete', 'automation-failed', 'pin-created', 'file-processed', 'memory-updated', 'budget-alert']
  const TEAM_IDS      = ['team-invite', 'persona-invite', 'workflow-invite']
  const BILLING_IDS   = ['payment-successful', 'payment-failed']

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
        padding:        '96px 155px 48px',
      }}
    >
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Page header ── */}
        <div style={{ paddingLeft: 4, marginBottom: 4 }}>
          <h1 style={{
            fontFamily:   'var(--font-title)',
            fontWeight:   400,
            fontSize:     24,
            lineHeight:   '32px',
            color:        'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Notifications
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     0,
          }}>
            Choose which events trigger in-app alerts and email notifications.
          </p>
        </div>

        {/* ── Activity card ── */}
        <NotifCard>
          <CardHeader
            title="Activity"
            onEnableAll={() => enableGroup(ACTIVITY_IDS)}
            onMuteAll={()   => muteGroup(ACTIVITY_IDS)}
          />

          <ColHeaders />

          {/* AUTOMATIONS section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 24px' }}>
            <SectionLabel>AUTOMATIONS</SectionLabel>
            <NotifRow
              id="automation-complete"
              label="Automation complete"
              description="A scheduled workflow finished running successfully"
              prefs={prefs} onChange={handleChange} divider
            />
            <NotifRow
              id="automation-failed"
              label="Automation failed"
              description="A workflow encountered an error and stopped"
              prefs={prefs} onChange={handleChange}
            />
          </div>

          {/* CONTENT section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 24px' }}>
            <SectionLabel>CONTENT</SectionLabel>
            <NotifRow
              id="pin-created"
              label="Pin created"
              description="A response was saved to your Pinboard"
              prefs={prefs} onChange={handleChange} divider
            />
            <NotifRow
              id="file-processed"
              label="File processed"
              description="An uploaded file has finished processing"
              prefs={prefs} onChange={handleChange} divider
            />
            <NotifRow
              id="memory-updated"
              label="Memory updated"
              description="Souvenir learned something new from your conversations"
              prefs={prefs} onChange={handleChange}
            />
          </div>

          {/* USAGE section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 24px 12px' }}>
            <SectionLabel>USAGE</SectionLabel>

            {/* Budget alert - single switch row */}
            <NotifRow
              id="budget-alert"
              label="Budget alert"
              description="Your credit usage has crossed a threshold you set in Routing"
              prefs={prefs} onChange={handleChange} divider
            />

            {/* Budget routing - checkbox group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '6px 0 12px' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   14,
                lineHeight: '22px',
                color:      'var(--neutral-900)',
                margin:     0,
              }}>
                Budget routing
              </p>
              {([
                { key: 'pct65'  as const, label: 'Notify me at 65% of monthly budget'  },
                { key: 'pct90'  as const, label: 'Notify me at 90% of monthly budget'  },
                { key: 'pct100' as const, label: 'Notify me at 100% - cap reached'     },
              ] as const).map(row => (
                <label
                  key={row.key}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        10,
                    cursor:     'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Checkbox
                    checked={budgetAlerts[row.key]}
                    onCheckedChange={v =>
                      setBudgetAlerts(prev => ({ ...prev, [row.key]: v === true }))
                    }
                  />
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400,
                    fontSize:   14,
                    lineHeight: '22px',
                    color:      'var(--neutral-900)',
                    flex:       '1 0 0',
                    minWidth:   0,
                  }}>
                    {row.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </NotifCard>

        {/* ── Team & Collaboration card ── */}
        <NotifCard>
          <CardHeader
            title="Team & Collaboration"
            onEnableAll={() => enableGroup(TEAM_IDS)}
            onMuteAll={()   => muteGroup(TEAM_IDS)}
          />

          <ColHeaders />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 24px' }}>
            <NotifRow
              id="team-invite"
              label="Team invite"
              description="Someone invited you to join a workspace"
              prefs={prefs} onChange={handleChange} divider
            />
            <NotifRow
              id="persona-invite"
              label="Persona invite"
              description="A persona was shared with you"
              prefs={prefs} onChange={handleChange} divider
            />
            <NotifRow
              id="workflow-invite"
              label="Workflow invite"
              description="A workflow template was shared with you"
              prefs={prefs} onChange={handleChange}
            />
          </div>
        </NotifCard>

        {/* ── Billing card ── */}
        <NotifCard>
          <CardHeader
            title="Billing"
            onEnableAll={() => enableGroup(BILLING_IDS)}
            onMuteAll={()   => muteGroup(BILLING_IDS)}
          />

          <ColHeaders />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 24px' }}>
            <NotifRow
              id="payment-successful"
              label="Payment successful"
              description="Your subscription was renewed or a top-up was purchased"
              prefs={prefs} onChange={handleChange} divider
              emailLocked
            />
            <NotifRow
              id="payment-failed"
              label="Payment failed"
              description="A payment attempt was unsuccessful - action may be required"
              prefs={prefs} onChange={handleChange}
              emailLocked
            />
          </div>
        </NotifCard>

        {/* ── Info card ── */}
        <div
          style={{
            border:          '1px solid var(--neutral-200)',
            borderRadius:    16,
            boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
            overflow:        'hidden',
            padding:         '12px 24px',
            backgroundColor: 'var(--neutral-50)',
          }}
        >
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     16,
            lineHeight:   '22px',
            color:        'var(--neutral-900)',
            margin:       '0 0 2px',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            Billing email notifications cannot be disabled
          </p>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   400,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-500)',
            margin:       0,
          }}>
            Payment receipts and failure alerts are always sent to your account email to ensure you never miss a critical billing event.
          </p>
        </div>

      </div>
    </div>
  )
}
