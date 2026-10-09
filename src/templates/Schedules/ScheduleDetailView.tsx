'use client'

import React, { useState } from 'react'
import {
  ArrowLeftOneIcon,
  PenOneIcon,
  DeleteTwoIcon,
  ArrowRightOneIcon,
  CalendarThreeIcon,
  AlertTwoIcon,
  CopyOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { MarkdownRenderer } from '@/lib/markdown-utils'
import { LoopHistoryCard } from './LoopHistoryCard'
import type { AgentStep, StepStatus } from './types'
import type { ScheduleConnector } from './ScheduleCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleRunRecord {
  id:            string
  label:         string     // e.g. "Today · 8:00 AM" — shown in run card header
  steps:         AgentStep[]
  title?:        string     // header label — "Completed", "Failed", "Running"
  status?:       StepStatus // colours the header for a run that has no steps
  summary?:      string     // run result (synthesis) or failure reason, shown when expanded
  detail?:       string     // the raw text behind the summary — a traceback
  completedAt?:  Date
  onViewThread?: () => void  // navigate to the full thread for this run
}

export interface ScheduleDetailItem {
  id:           string
  name:         string
  instructions: string     // what this automation does each run, in the user's words
  frequency:    string
  nextRun?:     string
  /** Pre-formatted time of the most recent run, shown when there's no
   *  upcoming run to display instead (e.g. the schedule is paused). */
  lastRun?:     string
  isActive:     boolean
  createdAt?:   string
  runHistory?:  ScheduleRunRecord[]
  /** Chat permanently bound to this schedule. */
  chatId?:      string
  /** Total times this schedule has fired. */
  runCount?:    number
  /** Fraction of finished runs that succeeded (0-1). `null`/undefined until
   *  at least one run has finished. */
  successRate?: number | null
  /** A run is executing right now — distinct from `isActive`. */
  isRunning?:   boolean
  /** True when the backend's deployed timer has drifted from what's stored —
   *  the last edit may not have fully taken effect. */
  drift?:       boolean
  /** Set when someone else in the org owns it: the view is read-only and its
   *  run history, which can hold the owner's data, is not available. */
  ownerName?:   string
  /** Connectors its program calls. */
  connectors?:  ScheduleConnector[]
}

export interface ScheduleDetailViewProps {
  schedule:        ScheduleDetailItem
  onBack?:         () => void
  onEdit?:         () => void
  onDelete?:       () => void
  onRunNow?:       () => void
  /** True while a "Run now" request is in flight — shows a spinner and blocks re-triggering. */
  runningNow?:     boolean
  onToggleActive?: (active: boolean) => void
  onOpenChat?:     (chatId: string) => void
  /** Start a chat that rebuilds this schedule as the viewer's own. */
  onCopy?:         () => void
  /** True while the copy chat is being prepared. */
  copying?:        boolean
}

// ── Inline toggle ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position:        'relative',
        width:           34,
        height:          20,
        borderRadius:    999,
        border:          'none',
        cursor:          'pointer',
        backgroundColor: checked ? 'var(--neutral-800)' : 'var(--neutral-300)',
        transition:      'background-color 0.15s ease',
        flexShrink:      0,
        padding:         0,
      }}
    >
      <span style={{
        position:        'absolute',
        top:             3,
        left:            checked ? 17 : 3,
        width:           14,
        height:          14,
        borderRadius:    '50%',
        backgroundColor: 'var(--card-bg)',
        transition:      'left 0.15s ease',
      }} />
    </button>
  )
}

// ── ScheduleDetailView ────────────────────────────────────────────────────────

export function ScheduleDetailView({
  schedule,
  onBack,
  onEdit,
  onDelete,
  onRunNow,
  runningNow = false,
  onToggleActive,
  onOpenChat,
  onCopy,
  copying = false,
}: ScheduleDetailViewProps) {
  const readOnly = !!schedule.ownerName
  const [isActive, setIsActive] = useState(schedule.isActive)

  const handleToggle = (v: boolean) => {
    setIsActive(v)
    onToggleActive?.(v)
  }

  const history = schedule.runHistory ?? []

  const nextOrLast = schedule.nextRun && isActive
    ? { label: 'Next run', value: schedule.nextRun }
    : schedule.lastRun
      ? { label: 'Last run', value: schedule.lastRun }
      : { label: isActive ? 'Next run' : 'Last run', value: '—' }

  const cardStyle: React.CSSProperties = {
    borderRadius:    12,
    border:          '1px solid var(--border-default)',
    backgroundColor: 'var(--card-bg)',
    overflow:        'hidden',
  }
  const sectionTitle: React.CSSProperties = {
    margin:     0,
    fontFamily: 'var(--font-body)',
    fontSize:   'var(--font-size-body-lg)',
    fontWeight: 'var(--font-weight-semibold)',
    lineHeight: 'var(--line-height-body-lg)',
    color:      'var(--neutral-900)',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   '12px',
    lineHeight: '16px',
    color:      'var(--neutral-500)',
  }
  const valueStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   'var(--font-size-body)',
    lineHeight: 'var(--line-height-body)',
    color:      'var(--neutral-800)',
  }

  const stats = [nextOrLast]

  type DetailRow = { key: string; label: string; node: React.ReactNode }
  const rows: DetailRow[] = []
  if (!readOnly) {
    rows.push({
      key: 'status', label: 'Status',
      node: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={valueStyle}>{isActive ? 'Active' : 'Paused'}</span>
          <Toggle checked={isActive} onChange={handleToggle} />
        </span>
      ),
    })
  }
  rows.push({ key: 'frequency', label: 'Frequency', node: <span style={{ ...valueStyle, textAlign: 'right' }}>{schedule.frequency}</span> })
  if (schedule.ownerName) {
    rows.push({ key: 'owner', label: 'Owner', node: <span style={valueStyle}>{schedule.ownerName}</span> })
  }
  if (schedule.connectors?.length) {
    rows.push({
      key: 'connectors', label: 'Connectors',
      node: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {schedule.connectors.map(connector => (
            <span key={connector.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ConnectorGlyph slug={connector.slug} name={connector.name} logoUrl={connector.logoUrl} size={16} />
              <span style={valueStyle}>{connector.name}</span>
            </span>
          ))}
        </div>
      ),
    })
  }
  if (schedule.createdAt) {
    rows.push({ key: 'created', label: 'Created', node: <span style={valueStyle}>{schedule.createdAt}</span> })
  }
  if (schedule.chatId && onOpenChat) {
    const chatId = schedule.chatId
    rows.push({
      key: 'chat', label: 'Linked chat',
      node: (
        <button
          type="button"
          onClick={() => onOpenChat(chatId)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            ...valueStyle, textDecoration: 'underline',
          }}
        >
          Open chat
          <ArrowRightOneIcon size={12} />
        </button>
      ),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0 32px', width: '100%' }}>

      {/* ── Back + actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeftOneIcon />} onClick={onBack}>
          Schedules
        </Button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {readOnly ? (
            <Button variant="default" size="sm" leftIcon={<CopyOneIcon />} loading={copying} disabled={copying} onClick={onCopy}>
              Copy
            </Button>
          ) : (
            <>
              <IconButton variant="ghost" aria-label="Edit schedule"   icon={<PenOneIcon />}    onClick={onEdit}   />
              <IconButton variant="ghost" aria-label="Delete schedule" icon={<DeleteTwoIcon />} onClick={onDelete} />
              <Button variant="default" size="sm" rightIcon={<ArrowRightOneIcon />} loading={runningNow} disabled={runningNow} onClick={onRunNow}>
                Run now
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Title block ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{
          margin:       0,
          fontFamily:   'var(--font-title)',
          fontSize:     '28px',
          fontWeight:   'var(--font-weight-medium)',
          lineHeight:   '36px',
          color:        'var(--neutral-900)',
          overflowWrap: 'anywhere',
        }}>
          {schedule.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Badge color={isActive ? 'Green' : 'Neutral'} label={isActive ? 'Active' : 'Paused'} />
          {schedule.isRunning && <Badge color="Blue" label="Running now" />}
          {!!schedule.runCount && (
            <Badge color="Neutral" label={`${schedule.runCount} ${schedule.runCount === 1 ? 'run' : 'runs'}`} />
          )}
          {schedule.successRate != null && (
            <Badge
              color={schedule.successRate >= 0.8 ? 'Green' : schedule.successRate >= 0.5 ? 'Yellow' : 'Red'}
              label={`${Math.round(schedule.successRate * 100)}% success`}
            />
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...valueStyle, color: 'var(--neutral-600)' }}>
            <CalendarThreeIcon size={14} color="var(--neutral-500)" />
            {schedule.frequency}
          </span>
        </div>
      </div>

      {/* ── Drift warning — the deployed timer disagrees with what's stored,
          e.g. an edit that silently failed to redeploy (services/automations/
          schedule.py's `drift` flag). ── */}
      {schedule.drift && (
        <div style={{
          display:         'flex',
          alignItems:      'flex-start',
          gap:             8,
          padding:         '10px 12px',
          borderRadius:    10,
          backgroundColor: 'var(--yellow-50)',
          boxShadow:       '0px 0px 0px 1px var(--yellow-200, #fef08a)',
        }}>
          <AlertTwoIcon size={16} color="var(--yellow-600)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, ...valueStyle, fontSize: '13px', lineHeight: '20px', color: 'var(--neutral-700)' }}>
            This schedule's last change may not have fully synced — the timer that's actually running could still be on the old cadence. Try editing and saving it again.
          </p>
        </div>
      )}

      {/* ── Stat tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ ...cardStyle, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>{stat.label}</span>
            <span style={{ ...valueStyle, fontSize: 'var(--font-size-body-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-900)' }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Two columns: what it does + history | details ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 24, alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={sectionTitle}>What it does</h2>
            <div style={{ ...cardStyle, padding: 16 }}>
              {/* MarkdownRenderer so URLs in the AI-written summary are real
                  links; --prose-* keep it at this card's body size/colour. */}
              <div style={{
                '--prose-size-body': 'var(--font-size-body)',
                '--prose-line-body': 'var(--line-height-body)',
                '--prose-text':      'var(--neutral-700)',
                '--prose-measure':   'none',
              } as React.CSSProperties}>
                <MarkdownRenderer content={schedule.instructions} />
              </div>
            </div>
          </section>

          {/* Run history — the owner's alone; its answers can hold their data */}
          {!readOnly && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={sectionTitle}>Run history</h2>
                {history.length > 0 && <Badge color="Neutral" label={String(history.length)} />}
              </div>

              {history.length === 0 ? (
                <div style={{ ...cardStyle, padding: '32px 24px', textAlign: 'center', ...valueStyle, color: 'var(--neutral-500)' }}>
                  No runs yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(run => (
                    <div key={run.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <LoopHistoryCard
                        steps={run.steps}
                        completedAt={run.completedAt}
                        runLabel={run.label}
                        title={run.title}
                        status={run.status}
                        summary={run.summary}
                        detail={run.detail}
                      />
                      {run.onViewThread && (
                        <button
                          type="button"
                          onClick={run.onViewThread}
                          style={{
                            display:    'inline-flex',
                            alignItems: 'center',
                            gap:        3,
                            alignSelf:  'flex-end',
                            background: 'none',
                            border:     'none',
                            padding:    '2px 4px',
                            cursor:     'pointer',
                            fontFamily: 'var(--font-body)',
                            fontSize:   '13px',
                            fontWeight: 'var(--font-weight-medium)',
                            lineHeight: '20px',
                            color:      'var(--neutral-500)',
                          }}
                        >
                          View full thread
                          <ArrowRightOneIcon size={12} color="var(--neutral-500)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Details */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <h2 style={sectionTitle}>Details</h2>
          <div style={{ ...cardStyle, padding: '4px 16px', display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <div key={row.key} style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                gap:            16,
                padding:        '12px 0',
                borderTop:      i === 0 ? 'none' : '1px solid var(--neutral-100)',
              }}>
                <span style={labelStyle}>{row.label}</span>
                {row.node}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

ScheduleDetailView.displayName = 'ScheduleDetailView'
