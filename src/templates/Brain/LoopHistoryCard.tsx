'use client'

import React, { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  PlayListIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import type { AgentStep, StepStatus } from './lib/phase'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Step status icon ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
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
  // pending / upcoming / executing — not finished, so not a tick.
  return (
    <div style={{
      width:        14,
      height:       14,
      borderRadius: '50%',
      border:       '1.5px solid var(--neutral-300)',
      flexShrink:   0,
    }} />
  )
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: AgentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flexShrink: 0, paddingTop: 2, lineHeight: 0 }}>
        <StepStatusIcon status={step.status} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
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
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopHistoryCardProps {
  steps:          AgentStep[]
  summary?:       string    // overall plan goal, shown above the step list
  /** The raw text behind the summary — a traceback, a provider payload. Kept
   *  out of the way until someone asks for it. */
  detail?:        string
  completedAt?:   Date
  runLabel?:      string    // overrides the auto-formatted time (e.g. "Today · 8:00 AM")
  title?:         string    // header label — defaults to "Completed" (e.g. "Failed" for a failed run)
  /** Colours the header when the card has no steps to derive it from — a run
   *  that is one turn rather than a plan. */
  status?:        StepStatus
  defaultOpen?:   boolean
}

// ── LoopHistoryCard ───────────────────────────────────────────────────────────

const TITLE_COLOR: Partial<Record<StepStatus, string>> = {
  failed:    'var(--color-tag-Red-text)',
  complete:  'var(--color-tag-Green-text)',
  executing: 'var(--color-tag-Blue-text)',
}

export function LoopHistoryCard({
  steps,
  summary,
  detail,
  completedAt,
  runLabel,
  title = 'Completed',
  status,
  defaultOpen = false,
}: LoopHistoryCardProps) {
  const [open,          setOpen]          = useState(defaultOpen)
  const [headerHovered, setHeaderHovered] = useState(false)
  const [detailOpen,    setDetailOpen]    = useState(false)

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
        {status ? <StepStatusIcon status={status} /> : <PlayListIcon size={14} color="var(--neutral-400)" />}

        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      (status && TITLE_COLOR[status]) ?? 'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          {title}
        </span>

        {/* Step count summary — a card with no steps has nothing to count. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          {steps.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              color:      'var(--color-tag-Green-text)',
              lineHeight: 'var(--line-height-caption)',
            }}>
              {completedCount} done
            </span>
          )}
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

              {/* Plan goal, or what the run had to say */}
              {summary && (
                <span style={{
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-caption)',
                  color:        status === 'failed' ? 'var(--neutral-700)' : 'var(--neutral-500)',
                  lineHeight:   'var(--line-height-caption)',
                  marginBottom: 4,
                  whiteSpace:   'pre-wrap',
                  overflowWrap: 'anywhere',
                }}>
                  {summary}
                </span>
              )}

              {detail && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDetailOpen(v => !v)}
                    style={{
                      alignSelf:   'flex-start',
                      background:  'none',
                      border:      'none',
                      padding:     0,
                      cursor:      'pointer',
                      fontFamily:  'var(--font-body)',
                      fontSize:    'var(--font-size-caption)',
                      fontWeight:  'var(--font-weight-medium)',
                      lineHeight:  'var(--line-height-caption)',
                      color:       'var(--neutral-400)',
                    }}
                  >
                    {detailOpen ? 'Hide details' : 'Show details'}
                  </button>
                  {detailOpen && (
                    <pre style={{
                      margin:          0,
                      padding:         '10px 12px',
                      maxHeight:       220,
                      overflow:        'auto',
                      borderRadius:    8,
                      backgroundColor: 'var(--neutral-50)',
                      fontFamily:      'var(--font-mono, ui-monospace, monospace)',
                      fontSize:        11,
                      lineHeight:      1.5,
                      color:           'var(--neutral-600)',
                      whiteSpace:      'pre-wrap',
                      overflowWrap:    'anywhere',
                    }}>
                      {detail}
                    </pre>
                  )}
                </div>
              )}

              {steps.map((step) => <StepRow key={step.id} step={step} />)}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

LoopHistoryCard.displayName = 'LoopHistoryCard'
