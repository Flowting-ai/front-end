'use client'

import React, { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  PlayListIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  ArrowDownOneIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import type { PlanStep } from './lib/phase'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Step status icon ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: PlanStep['status'] }) {
  if (status === 'complete') {
    return <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
  }
  if (status === 'failed') {
    return <CancelCircleIcon size={14} color="var(--color-tag-Red-text)" />
  }
  if (status === 'skipped') {
    return (
      <div style={{
        width:           14,
        height:          14,
        borderRadius:    '50%',
        border:          '1.5px dashed var(--neutral-300)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
      }}>
        <div style={{ width: 4, height: 1.5, backgroundColor: 'var(--neutral-300)', borderRadius: 1 }} />
      </div>
    )
  }
  // complete fallback
  return <TickTwoIcon size={14} color="var(--color-tag-Green-text)" />
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: PlanStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flexShrink: 0, paddingTop: 2, lineHeight: 0 }}>
        <StepStatusIcon status={step.status} />
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        color:      step.status === 'failed'
          ? 'var(--color-tag-Red-text)'
          : step.status === 'skipped'
            ? 'var(--neutral-400)'
            : 'var(--neutral-700)',
        lineHeight: 'var(--line-height-caption)',
        textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
      }}>
        {step.label}
      </span>
    </div>
  )
}

// ── Flow grouping ─────────────────────────────────────────────────────────────
// Consecutive steps sharing a parallelGroup ran at the same time (one
// dependency level of the plan DAG). Render them bracketed under a label so the
// flow reads top-to-bottom with parallel branches called out.

type HistItem =
  | { kind: 'step';     step:  PlanStep }
  | { kind: 'parallel'; steps: PlanStep[] }

function groupConsecutive(steps: PlanStep[]): HistItem[] {
  const out: HistItem[] = []
  let i = 0
  while (i < steps.length) {
    const step = steps[i]
    if (!step.parallelGroup) { out.push({ kind: 'step', step }); i++; continue }
    const groupId = step.parallelGroup
    const group   = [step]
    while (i + 1 < steps.length && steps[i + 1].parallelGroup === groupId) group.push(steps[++i])
    i++
    out.push(group.length > 1 ? { kind: 'parallel', steps: group } : { kind: 'step', step: group[0] })
  }
  return out
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopHistoryCardProps {
  steps:          PlanStep[]
  summary?:       string    // overall plan goal, shown above the step list
  completedAt?:   Date
  runLabel?:      string    // overrides the auto-formatted time (e.g. "Today · 8:00 AM")
  title?:         string    // header label — defaults to "Completed" (e.g. "Failed" for a failed run)
  defaultOpen?:   boolean
}

// ── LoopHistoryCard ───────────────────────────────────────────────────────────

export function LoopHistoryCard({
  steps,
  summary,
  completedAt,
  runLabel,
  title = 'Completed',
  defaultOpen = false,
}: LoopHistoryCardProps) {
  const items = groupConsecutive(steps)
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
  const [open,          setOpen]          = useState(defaultOpen)
  const [headerHovered, setHeaderHovered] = useState(false)

  const completedCount = steps.filter(s => s.status === 'complete').length
  const failedCount    = steps.filter(s => s.status === 'failed').length
  const skippedCount   = steps.filter(s => s.status === 'skipped').length

  const timeLabel = runLabel ?? (completedAt
    ? completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : undefined)

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      padding:         '14px 16px',
      boxShadow:       CARD_SHADOW,
      maxWidth:        '100%',
      display:         'flex',
      flexDirection:   'column',
      gap:             0,
    }}>

      {/* Header — always visible, toggle on click */}
      <button
        type="button"
        className="brain-card-action"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          background:      headerHovered ? 'var(--neutral-50)' : 'none',
          border:          'none',
          padding:         '4px 6px',
          margin:          '-4px -6px',
          borderRadius:    8,
          cursor:          'pointer',
          width:           'calc(100% + 12px)',
          textAlign:       'left',
          transition:      'background-color 150ms ease',
        }}
      >
        <PlayListIcon size={14} color="var(--neutral-400)" />

        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          {title}
        </span>

        {/* Step count summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--color-tag-Green-text)',
            lineHeight: 'var(--line-height-caption)',
          }}>
            {completedCount} done
          </span>
          {skippedCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--neutral-400)',
              lineHeight: 'var(--line-height-caption)',
            }}>
              · {skippedCount} skipped
            </span>
          )}
          {failedCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--color-tag-Red-text)',
              lineHeight: 'var(--line-height-caption)',
            }}>
              · {failedCount} failed
            </span>
          )}
        </div>

        <div style={{ flex: '1 0 0' }} />

        {timeLabel && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            color:      'var(--neutral-300)',
            lineHeight: 'var(--line-height-caption)',
            flexShrink: 0,
          }}>
            {timeLabel}
          </span>
        )}

        <m.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={springs.fast}
          style={{ flexShrink: 0, lineHeight: 0 }}
        >
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </m.div>
      </button>

      {/* Expandable step list */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1,  y: 0  }}
            exit={{    opacity: 0,  y: -4 }}
            transition={springs.fast}
          >
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              paddingTop:    14,
            }}>
              {/* Divider */}
              <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', marginBottom: 6 }} />

              {/* Plan goal */}
              {summary && (
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  color:      'var(--neutral-500)',
                  lineHeight: 'var(--line-height-caption)',
                  marginBottom: 4,
                }}>
                  {summary}
                </span>
              )}

              {items.map((item, idx) =>
                item.kind === 'step' ? (
                  <StepRow key={item.step.id} step={item.step} />
                ) : (
                  <div
                    key={`parallel-${idx}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize:   'var(--font-size-caption)',
                      fontStyle:  'italic',
                      color:      'var(--neutral-400)',
                      lineHeight: 'var(--line-height-caption)',
                    }}>
                      Ran at the same time
                    </span>
                    <div style={{
                      paddingLeft:   12,
                      borderLeft:    '1.5px solid var(--neutral-200)',
                      display:       'flex',
                      flexDirection: 'column',
                      gap:           8,
                    }}>
                      {item.steps.map(step => <StepRow key={step.id} step={step} />)}
                    </div>
                  </div>
                )
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

LoopHistoryCard.displayName = 'LoopHistoryCard'
