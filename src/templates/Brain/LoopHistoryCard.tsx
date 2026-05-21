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

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopHistoryCardProps {
  steps:          PlanStep[]
  completedAt?:   Date
  runLabel?:      string    // overrides the auto-formatted time (e.g. "Today · 8:00 AM")
  defaultOpen?:   boolean
}

// ── LoopHistoryCard ───────────────────────────────────────────────────────────

export function LoopHistoryCard({
  steps,
  completedAt,
  runLabel,
  defaultOpen = false,
}: LoopHistoryCardProps) {
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
  const [open, setOpen] = useState(defaultOpen)

  const completedCount = steps.filter(s => s.status === 'complete').length
  const failedCount    = steps.filter(s => s.status === 'failed').length
  const skippedCount   = steps.filter(s => s.status === 'skipped').length

  const timeLabel = runLabel ?? (completedAt
    ? completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : undefined)

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    24,
      padding:         20,
      boxShadow:       CARD_SHADOW,
      maxWidth:        '100%',
      display:         'flex',
      flexDirection:   'column',
      gap:             0,
    }}>

      {/* Header — always visible, toggle on click */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          background:      'none',
          border:          'none',
          padding:         0,
          cursor:          'pointer',
          width:           '100%',
          textAlign:       'left',
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
          Completed
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
          <ArrowDownOneIcon size={14} color="var(--neutral-400)" />
        </m.div>
      </button>

      {/* Expandable step list */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ ...springs.moderate, opacity: { duration: 0.15 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              paddingTop:    14,
            }}>
              {/* Divider */}
              <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', marginBottom: 6 }} />

              {steps.map(step => (
                <div
                  key={step.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                >
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
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

LoopHistoryCard.displayName = 'LoopHistoryCard'
