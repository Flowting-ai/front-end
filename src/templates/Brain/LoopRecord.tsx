'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  StopCircleIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import { LoopHistoryCard } from './LoopHistoryCard'
import type { PlanStep } from './lib/phase'
import type { ExternalOutputAction } from './ExternalOutputCard'
import { ExternalOutputCard } from './ExternalOutputCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoopRecordProps {
  /** 1-based loop index for label: "Loop #1", "Loop #2" */
  loopIndex:         number
  /** Original user query — truncated in collapsed view */
  query:             string
  /** "Today · 8:02 AM" */
  timestamp:         string
  status:            'complete' | 'cancelled' | 'failed'
  /** Passed to LoopHistoryCard for the expandable step history */
  steps:             PlanStep[]
  /** Optional artifact title for inline summary in collapsed row */
  artifactTitle?:    string
  /** External actions to show in expanded view */
  externalActions?:  ExternalOutputAction[]
  /** Completed loops default to collapsed */
  defaultCollapsed?: boolean
  /**
   * When true, renders D-1 Level 2 "needs input" treatment:
   * 3px amber left-border accent + "Waiting" status badge replaces the normal
   * status icon. Use when a Brain run is paused awaiting HITL approval.
   */
  needsInput?: boolean
}

// ── Status indicator ──────────────────────────────────────────────────────────

function LoopStatusIcon({ status }: { status: LoopRecordProps['status'] }) {
  if (status === 'complete')  return <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
  if (status === 'failed')    return <CancelCircleIcon       size={14} color="var(--color-tag-Red-text)"   />
  return                             <StopCircleIcon         size={14} color="var(--neutral-400)"          />
}

// ── LoopRecord ────────────────────────────────────────────────────────────────

/**
 * A collapsed record of a completed loop in a multi-loop Brain thread.
 * Stacked vertically above the active loop to show thread history.
 */
export function LoopRecord({
  loopIndex,
  query,
  timestamp,
  status,
  steps,
  artifactTitle,
  externalActions,
  defaultCollapsed = true,
  needsInput       = false,
}: LoopRecordProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [headerHovered, setHeaderHovered] = useState(false)

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      boxShadow:       CARD_SHADOW,
      overflow:        'hidden',
      // D-1 Level 2 — 3px amber left-border accent when awaiting approval
      borderLeft:      needsInput ? '3px solid var(--color-tag-Yellow-text)' : undefined,
    }}>

      {/* ── Collapsed header row ── */}
      <button
        type="button"
        className="brain-card-action"
        onClick={() => setCollapsed(c => !c)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '10px 14px',
          background:      headerHovered ? 'var(--neutral-50)' : 'none',
          border:          'none',
          cursor:          'pointer',
          width:           '100%',
          textAlign:       'left',
          transition:      'background-color 150ms ease',
        }}
      >
        {needsInput ? (
          <span style={{
            display:         'inline-flex',
            alignItems:      'center',
            padding:         '1px 6px',
            borderRadius:    6,
            backgroundColor: 'var(--color-tag-Yellow-bg)',
            boxShadow:       'var(--color-tag-Yellow-shadow)',
            fontFamily:      'var(--font-body)',
            fontWeight:      500,
            fontSize:        10,
            lineHeight:      '16px',
            color:           'var(--color-tag-Yellow-text)',
            whiteSpace:      'nowrap',
            flexShrink:      0,
          }}>
            Waiting
          </span>
        ) : (
          <LoopStatusIcon status={status} />
        )}

        {/* Loop label */}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-600)',
          flexShrink: 0,
        }}>
          Loop #{loopIndex}
        </span>

        {/* Query text (truncated) */}
        <span style={{
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-caption)',
          lineHeight:   'var(--line-height-caption)',
          color:        'var(--neutral-500)',
          flex:         '1 0 0',
          minWidth:     0,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          — {query}
        </span>

        {/* Artifact hint */}
        {artifactTitle && collapsed && (
          <span style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-500)',
            flexShrink:   0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            maxWidth:     120,
          }}>
            {artifactTitle}
          </span>
        )}

        {/* Timestamp */}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-500)',
          flexShrink: 0,
        }}>
          {timestamp}
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={springs.fast}
          style={{ flexShrink: 0, lineHeight: 0, transformOrigin: 'center' }}
        >
          <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
        </motion.span>
      </button>

      {/* ── Expanded content ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1,  y: 0  }}
            exit={{    opacity: 0,  y: -4 }}
            transition={springs.fast}
          >
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           8,
              padding:       '0 14px 14px',
              borderTop:     '1px solid var(--neutral-100)',
              paddingTop:    12,
            }}>
              {steps.length > 0 && (
                <LoopHistoryCard steps={steps} runLabel={timestamp} defaultOpen />
              )}
              {externalActions && externalActions.length > 0 && (
                <ExternalOutputCard actions={externalActions} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

LoopRecord.displayName = 'LoopRecord'
