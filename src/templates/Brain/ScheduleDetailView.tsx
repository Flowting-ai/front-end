'use client'

import React, { useState } from 'react'
import {
  ArrowLeftOneIcon,
  PenOneIcon,
  DeleteTwoIcon,
  ArrowRightOneIcon,
  CalendarThreeIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Badge } from '@/components/Badge'
import { LoopHistoryCard } from './LoopHistoryCard'
import type { PlanStep } from './lib/phase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleRunRecord {
  id:            string
  label:         string     // e.g. "Today · 8:00 AM" — shown in run card header
  steps:         PlanStep[]
  completedAt?:  Date
  onViewThread?: () => void  // navigate to the full thread for this run
}

export interface ScheduleDetailItem {
  id:           string
  name:         string
  instructions: string
  frequency:    string
  nextRun?:     string
  isActive:     boolean
  createdAt?:   string
  runHistory?:  ScheduleRunRecord[]
  /** Brain chat permanently bound to this schedule. */
  chatId?:      string
}

export interface ScheduleDetailViewProps {
  schedule:        ScheduleDetailItem
  onBack?:         () => void
  onEdit?:         () => void
  onDelete?:       () => void
  onRunNow?:       () => void
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
  onToggleActive,
  onOpenChat,
}: ScheduleDetailViewProps) {
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
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
      }}>
        <Toggle checked={isActive} onChange={handleToggle} />

        <Badge color={isActive ? 'Green' : 'Neutral'} label={isActive ? 'Active' : 'Paused'} />

        <span style={{ width: 1, height: 14, backgroundColor: 'var(--neutral-200)', flexShrink: 0 }} />

        {schedule.nextRun && isActive && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
          }}>
            Next run: <strong style={{ color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-medium)' }}>{schedule.nextRun}</strong>
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
            Instructions
          </span>
        </div>

        <div style={{ padding: '16px' }}>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-700)',
            whiteSpace: 'pre-wrap',
          }}>
            {schedule.instructions}
          </p>
        </div>

        <div style={{
          padding:       '12px 16px',
          borderTop:     '1px solid var(--neutral-100)',
          display:       'flex',
          flexDirection: 'column',
          gap:           6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--neutral-400)',
            }}>
              Frequency
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              color:      'var(--neutral-700)',
            }}>
              {schedule.frequency}
            </span>
          </div>
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
