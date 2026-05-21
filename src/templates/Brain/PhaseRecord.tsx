'use client'

import React, { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  StopCircleIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'
import { springs } from '@/lib/springs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PhaseRecordStatus = 'complete' | 'failed' | 'cancelled'

export interface PhaseRecordProps {
  /**
   * One-liner shown when collapsed.
   * Static for now — when the AI summary module exists, pass generated copy here.
   * e.g. "Plan approved · 6 steps" or "Step failed · Re-ran"
   */
  summary:          string
  status:           PhaseRecordStatus
  /** Completed phases default collapsed; active phases default expanded. */
  defaultCollapsed?: boolean
  children:         React.ReactNode
}

// ── Status icon ────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<PhaseRecordStatus, React.ReactNode> = {
  complete:  <CheckmarkCircleTwoIcon size={16} color="var(--color-tag-Green-text)" />,
  failed:    <CancelCircleIcon       size={16} color="var(--color-tag-Red-text)"   />,
  cancelled: <StopCircleIcon         size={16} color="var(--neutral-400)"          />,
}

// ── PhaseRecord ────────────────────────────────────────────────────────────────

export function PhaseRecord({
  summary,
  status,
  defaultCollapsed = true,
  children,
}: PhaseRecordProps) {
  // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Collapsed one-liner ── */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '8px 2px',
          background:      'none',
          border:          'none',
          cursor:          'pointer',
          textAlign:       'left',
          width:           '100%',
        }}
      >
        {/* Status icon */}
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          {STATUS_ICON[status]}
        </span>

        {/* Summary text */}
        <span style={{
          flex:        '1 0 0',
          minWidth:    0,
          fontFamily:  'var(--font-body)',
          fontSize:    'var(--font-size-body)',
          fontWeight:  'var(--font-weight-medium)',
          color:       'var(--neutral-600)',
          lineHeight:  'var(--line-height-body)',
          overflow:    'hidden',
          textOverflow:'ellipsis',
          whiteSpace:  'nowrap',
        }}>
          {summary}
        </span>

        {/* Chevron */}
        <m.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={springs.fast}
          style={{ flexShrink: 0, lineHeight: 0, transformOrigin: 'center' }}
        >
          <ArrowDownOneIcon size={14} color="var(--neutral-400)" />
        </m.span>
      </button>

      {/* ── Expanded card ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 8, paddingBottom: 4 }}>
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>

    </div>
  )
}

PhaseRecord.displayName = 'PhaseRecord'
