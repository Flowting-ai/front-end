'use client'

import React, { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  CircleIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'
import { springs } from '@/lib/springs'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Chip, type ChipColor } from '@/components/Chip'

// ── Types ───────────────────────────────────────────────────────────────────────

export type BrainTimelineResultVariant = 'default' | 'success' | 'error'

export interface BrainTimelineResult {
  /** Short label on the chip — e.g. "3 results", "Success", "Error" */
  label:    string
  /** Expanded raw details — JSON, text, or plain prose. Optional. */
  details?: string
  variant?: BrainTimelineResultVariant
}

export interface BrainTimelineItem {
  id:      string
  /** Custom icon — defaults to a neutral circle dot. Pass size 14 icons. */
  icon?:   React.ReactNode
  /** Action description — "Fetched 340 tickets from Linear" */
  label:   string
  result?: BrainTimelineResult
  /** 'error' row uses red text and error icon. @default 'default' */
  variant?: 'default' | 'error'
}

export interface BrainTimelineProps {
  items:     BrainTimelineItem[]
  /** Show the "Done" checkmark terminator at the end. @default true */
  showDone?: boolean
}

// ── KDS colour maps ─────────────────────────────────────────────────────────────

const RESULT_COLOR: Record<BrainTimelineResultVariant, BadgeColor & ChipColor> = {
  default: 'Neutral',
  success: 'Green',
  error:   'Red',
}

// ── TimelineRow ─────────────────────────────────────────────────────────────────
// Each row owns its own chip open/close state. Chip and label are inline (flex row).
// Expanded details sit below the label row but left connector stretches past them.

function TimelineRow({ item, isLast }: { item: BrainTimelineItem; isLast: boolean }) {
  const [chipOpen, setChipOpen] = useState(false)
  const detailsId  = React.useId()
  const isError    = item.variant === 'error'
  const result     = item.result
  const variant    = result?.variant ?? 'default'

  const nodeIcon = item.icon ?? (() => {
    if (isError || result?.variant === 'error') {
      return <CancelCircleIcon size={14} color="var(--color-tag-Red-text)" />
    }
    if (result?.variant === 'success') {
      return <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
    }
    return <CircleIcon size={14} color="var(--neutral-300)" />
  })()

  return (
    // alignItems: stretch — left column grows to match the full right-column height,
    // so the connector line extends past any expanded details section.
    <div style={{ display: 'flex', alignItems: 'stretch' }}>

      {/* ── Left: icon node + continuous connector ── */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        width:          20,
        flexShrink:     0,
      }}>
        <div style={{
          width:          20,
          height:         20,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}>
          {nodeIcon}
        </div>
        {/* Connector fills remaining height of left column — flex-grow matches row height */}
        {!isLast && (
          <div style={{
            width:           1,
            flex:            '1 0 0',
            minHeight:       8,
            backgroundColor: 'var(--neutral-200)',
          }} />
        )}
      </div>

      {/* ── Right: label + chip inline, expanded details below ── */}
      <div style={{
        flex:          '1 0 0',
        minWidth:      0,
        marginLeft:    10,
        paddingTop:    3,
        paddingBottom: isLast ? 0 : 10,
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
      }}>

        {/* Inline row — label and chip on the same line */}
        <div style={{
          display:     'flex',
          flexWrap:    'wrap',
          alignItems:  'center',
          gap:         6,
          minWidth:    0,
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      isError ? 'var(--color-tag-Red-text)' : 'var(--neutral-700)',
          }}>
            {item.label}
          </span>

          {result && (
            result.details ? (
              <Chip
                size="Small"
                color={RESULT_COLOR[variant]}
                label={result.label}
                onExpand={() => setChipOpen(o => !o)}
                rightLabel={chipOpen ? 'Hide details' : 'Show details'}
                rightIcon={
                  <m.span
                    animate={{ rotate: chipOpen ? 180 : 0 }}
                    transition={springs.fast}
                    style={{ display: 'inline-flex', lineHeight: 0 }}
                  >
                    <ArrowDownOneIcon size={14} color="var(--chip-text)" />
                  </m.span>
                }
                aria-expanded={chipOpen}
                aria-controls={detailsId}
              />
            ) : (
              <Badge color={RESULT_COLOR[variant]} label={result.label} />
            )
          )}
        </div>

        {/* Expanded details — below the label+chip row, full width */}
        <AnimatePresence initial={false}>
          {chipOpen && result?.details && (
            <m.div
              id={detailsId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{ overflow: 'hidden' }}
            >
              <pre
                tabIndex={-1}
                className="kaya-scrollbar"
                style={{
                  margin:              0,
                  padding:             '8px 12px',
                  borderRadius:        8,
                  background:          'var(--neutral-50)',
                  border:              '1px solid var(--neutral-200)',
                  fontFamily:          'var(--font-mono, monospace)',
                  fontSize:            12,
                  lineHeight:          1.6,
                  color:               'var(--neutral-600)',
                  overflowX:           'auto',
                  overscrollBehaviorX: 'contain',
                  outline:             'none',
                  whiteSpace:          'pre-wrap',
                  wordBreak:           'break-word',
                  boxSizing:           'border-box',
                }}
              >
                {result.details}
              </pre>
            </m.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

// ── BrainTimeline ───────────────────────────────────────────────────────────────

/**
 * Vertical timeline of Brain's low-level actions inside a phase group.
 * Each row: icon node → connector line → label + result chip (inline).
 * Connector is continuous — aligns: stretch lets it run past expanded details.
 * Terminates with a "Done" checkmark row.
 */
export function BrainTimeline({ items, showDone = true }: BrainTimelineProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4, paddingBottom: 4 }}>
      {items.map((item, i) => (
        <TimelineRow
          key={item.id}
          item={item}
          isLast={i === items.length - 1 && !showDone}
        />
      ))}

      {/* Done terminator */}
      {showDone && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width:          20,
            height:         20,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
          </div>
          <span style={{
            marginLeft:  10,
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-body)',
            lineHeight:  'var(--line-height-body)',
            color:       'var(--color-tag-Green-text)',
            fontWeight:  'var(--font-weight-medium)',
          }}>
            Done
          </span>
        </div>
      )}
    </div>
  )
}

BrainTimeline.displayName = 'BrainTimeline'
