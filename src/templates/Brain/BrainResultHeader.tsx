'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrainTwoIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { springs } from '@/lib/springs'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface BrainResultHeaderProps {
  /**
   * Source summary shown after the "Brain ·" label.
   * e.g. "Analyzed 340 tickets · 22 interviews"
   */
  summary:           string
  /** Custom icon color — for themed versions. @default 'var(--neutral-500)' */
  iconColor?:        string
  /** Custom "Brain" label color. @default 'var(--neutral-600)' */
  labelColor?:       string
  /** Custom summary text color. @default 'var(--neutral-500)' */
  summaryColor?:     string
  /** Icon size in px. @default 14 */
  iconSize?:         number
  /** If children are provided, the header becomes a collapsible toggle. */
  children?:         React.ReactNode
  defaultCollapsed?: boolean
}

// ── BrainResultHeader ──────────────────────────────────────────────────────────
/**
 * Attribution line above the AI output.
 * "✳ Brain · Analyzed 340 tickets · 22 interviews"
 * Collapses to show a source summary when children are provided.
 */
export function BrainResultHeader({
  summary,
  iconColor    = 'var(--neutral-500)',
  labelColor   = 'var(--neutral-600)',
  summaryColor = 'var(--neutral-500)',
  iconSize     = 14,
  children,
  defaultCollapsed = true,
}: BrainResultHeaderProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const hasChildren = children != null

  const row = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ lineHeight: 0, flexShrink: 0 }}>
        <BrainTwoIcon size={iconSize} color={iconColor} />
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 'var(--line-height-caption)',
        color:      labelColor,
      }}>
        Brain
      </span>
      <span aria-hidden style={{
        color:      'var(--neutral-300)',
        userSelect: 'none',
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
      }}>
        ·
      </span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      summaryColor,
      }}>
        {summary}
      </span>
      {hasChildren && (
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={springs.fast}
          style={{ lineHeight: 0, display: 'inline-flex', flexShrink: 0 }}
        >
          <ArrowDownOneIcon size={11} color="var(--neutral-400)" />
        </motion.span>
      )}
    </div>
  )

  if (!hasChildren) return <div>{row}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(c => !c)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        {row}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

BrainResultHeader.displayName = 'BrainResultHeader'
