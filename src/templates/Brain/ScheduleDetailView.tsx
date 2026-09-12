'use client'

import React, { useState } from 'react'
import {
  ArrowLeftOneIcon,
  PenOneIcon,
  DeleteTwoIcon,
  ArrowRightOneIcon,
  CalendarThreeIcon,
  AlertTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { MarkdownRenderer } from '@/lib/markdown-utils'
import { LoopHistoryCard } from './LoopHistoryCard'
import type { AgentStep, StepStatus } from './lib/phase'

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
  /** Brain chat permanently bound to this schedule. */
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
        backgroundColor: 'var(--neutral-white)',
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
}: ScheduleDetailViewProps) {
  const [isActive, setIsActive] = useState(schedule.isActive)

  const handleToggle = (v: boolean) => {
    setIsActive(v)
    onToggleActive?.(v)
  }

  const history = schedule.runHistory ?? []

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      padding:       '32px 0',
      width:         '100%',
    }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton
          variant="ghost"
          aria-label="Back"
          icon={<ArrowLeftOneIcon />}
          onClick={onBack}
        />
        <span style={{
          flex:         '1 0 0',
          minWidth:     0,
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body-lg)',
          fontWeight:   'var(--font-weight-semibold)',
          lineHeight:   'var(--line-height-body-lg)',
          color:        'var(--neutral-900)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {schedule.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <IconButton variant="ghost" aria-label="Edit schedule"   icon={<PenOneIcon />}    onClick={onEdit}   />
          <IconButton variant="ghost" aria-label="Delete schedule" icon={<DeleteTwoIcon />} onClick={onDelete} />
          <Button
            variant="default"
            size="sm"
            rightIcon={<ArrowRightOneIcon />}
            loading={runningNow}
            disabled={runningNow}
            onClick={onRunNow}
          >
            Run now
          </Button>
        </div>
      </div>

      {/* ── Status strip ── */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        padding:         '12px 16px',
        borderRadius:    12,
        border:          '1px solid var(--neutral-200)',
        backgroundColor: 'var(--neutral-white)',
        flexWrap:        'wrap',
      }}>
        <Toggle checked={isActive} onChange={handleToggle} />

        <Badge color={isActive ? 'Green' : 'Neutral'} label={isActive ? 'Active' : 'Paused'} />

        {schedule.isRunning && <Badge color="Blue" label="Running now" />}

        <span style={{ width: 1, height: 14, backgroundColor: 'var(--neutral-200)', flexShrink: 0 }} />

        {schedule.nextRun && isActive ? (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            Next run: <strong style={{ color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-medium)' }}>{schedule.nextRun}</strong>
          </span>
        ) : schedule.lastRun && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            Last run: <strong style={{ color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-medium)' }}>{schedule.lastRun}</strong>
          </span>
        )}

        {!!schedule.runCount && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            {schedule.runCount} {schedule.runCount === 1 ? 'run' : 'runs'}
            {schedule.successRate != null && ` · ${Math.round(schedule.successRate * 100)}% success`}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ lineHeight: 0 }}>
            <CalendarThreeIcon size={12} color="var(--neutral-400)" />
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            {schedule.frequency}
          </span>
        </div>
      </div>

      {/* ── Drift warning — the deployed timer disagrees with what's stored,
          e.g. an edit that silently failed to redeploy (services/automations/
          schedule.py's `drift` flag). Surfaced explicitly rather than left
          invisible, since otherwise a schedule can silently run on its old
          cadence after being "changed". ── */}
      {schedule.drift && (
        <div style={{
          display:         'flex',
          alignItems:      'flex-start',
          gap:             8,
          padding:         '10px 12px',
          borderRadius:    10,
          backgroundColor: 'var(--yellow-50, #fefce8)',
          boxShadow:       '0px 0px 0px 1px var(--yellow-200, #fef08a)',
        }}>
          <AlertTwoIcon size={16} color="var(--yellow-600, #ca8a04)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-700)' }}>
            This schedule's last change may not have fully synced — the timer that's actually running could still be on the old cadence. Try editing and saving it again.
          </p>
        </div>
      )}

      {/* ── Instructions card ── */}
      <div style={{
        display:         'flex',
        flexDirection:   'column',
        gap:             0,
        borderRadius:    12,
        border:          '1px solid var(--neutral-200)',
        overflow:        'hidden',
        backgroundColor: 'var(--neutral-white)',
      }}>
        <div style={{
          padding:      '12px 16px',
          borderBottom: '1px solid var(--neutral-200)',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-700)',
          }}>
            What it does
          </span>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Through MarkdownRenderer (same one every chat message uses)
              instead of a raw <p> — this text is AI-generated (the
              automation's own summary), so a URL in it should be an actual
              clickable link, not inert text. --prose-* overrides keep it at
              this card's normal body size/color rather than MarkdownRenderer's
              default full chat-prose size. */}
          <div style={{
            '--prose-size-body': 'var(--font-size-body)',
            '--prose-line-body': 'var(--line-height-body)',
            '--prose-text':      'var(--neutral-700)',
            '--prose-measure':   'none',
          } as React.CSSProperties}>
            <MarkdownRenderer content={schedule.instructions} />
          </div>
        </div>

        <div style={{
          padding:       '12px 16px',
          borderTop:     '1px solid var(--neutral-100)',
          display:       'flex',
          flexDirection: 'column',
          gap:           6,
        }}>
          {schedule.createdAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                color:      'var(--neutral-400)',
              }}>
                Created
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-700)',
              }}>
                {schedule.createdAt}
              </span>
            </div>
          )}
          {schedule.chatId && onOpenChat && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                color:      'var(--neutral-400)',
              }}>
                Linked chat
              </span>
              <button
                type="button"
                onClick={() => onOpenChat(schedule.chatId!)}
                style={{
                  display:         'inline-flex',
                  alignItems:      'center',
                  gap:             4,
                  border:          'none',
                  background:      'transparent',
                  padding:         0,
                  cursor:          'pointer',
                  fontFamily:      'var(--font-body)',
                  fontSize:        'var(--font-size-body)',
                  lineHeight:      'var(--line-height-body)',
                  color:           'var(--neutral-700)',
                  textDecoration:  'underline',
                }}
              >
                Open chat
                <ArrowRightOneIcon size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Run history ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-700)',
          }}>
            Run history
          </span>
          {history.length > 0 && (
            <Badge color="Neutral" label={String(history.length)} />
          )}
        </div>

        {history.length === 0 ? (
          <div style={{
            padding:         '32px 24px',
            textAlign:       'center',
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-body)',
            lineHeight:      'var(--line-height-body)',
            color:           'var(--neutral-300)',
            borderRadius:    12,
            border:          '1px solid var(--neutral-200)',
            backgroundColor: 'var(--neutral-white)',
          }}>
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
                      display:         'inline-flex',
                      alignItems:      'center',
                      gap:             3,
                      alignSelf:       'flex-end',
                      background:      'none',
                      border:          'none',
                      padding:         '2px 4px',
                      cursor:          'pointer',
                      fontFamily:      'var(--font-body)',
                      fontSize:        'var(--font-size-caption)',
                      fontWeight:      'var(--font-weight-medium)',
                      lineHeight:      'var(--line-height-caption)',
                      color:           'var(--neutral-400)',
                    }}
                  >
                    View full thread
                    <ArrowRightOneIcon size={12} color="var(--neutral-400)" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

ScheduleDetailView.displayName = 'ScheduleDetailView'
