'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { springs } from '@/lib/springs'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface BrainPhaseGroupProps {
  /**
   * Flat summary text shown in the header, e.g. "Pulled 340 tickets from Linear".
   * Should read as an outcome, not an in-progress action.
   */
  title:             string
  /** Collapsed by default for completed phases. @default true */
  defaultCollapsed?: boolean
  children:          React.ReactNode
}

// ── BrainPhaseGroup ─────────────────────────────────────────────────────────────
/**
 * Collapsible phase group in the Brain thread.
 *
 * Replaces `PhaseRecord`. Key difference: no status icon, no card border —
 * just a flat disclosure header (text + chevron). Children should be a
 * `BrainTimeline`, not the original interactive phase card.
 */
export function BrainPhaseGroup({
  title,
  defaultCollapsed = true,
  children,
}: BrainPhaseGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const contentId = React.useId()

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      borderRadius:  12,
      border:        '1px solid var(--neutral-200)',
      overflow:      'hidden',
    }}>
      <button
        type="button"
        className="brain-phase-trigger"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={() => setCollapsed(c => !c)}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          padding:    '12px 16px',
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          textAlign:  'left',
          width:      '100%',
          outline:    'none',
        }}
      >
        <span style={{
          flex:       '1 0 0',
          minWidth:   0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-regular)',
          color:      'var(--neutral-600)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {title}
        </span>

        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={springs.fast}
          style={{ flexShrink: 0, lineHeight: 0, transformOrigin: 'center' }}
        >
          <ArrowDownOneIcon size={14} color="var(--neutral-400)" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

BrainPhaseGroup.displayName = 'BrainPhaseGroup'
