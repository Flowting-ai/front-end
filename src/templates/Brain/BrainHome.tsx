'use client'

import React, { useMemo } from 'react'
import { m } from 'framer-motion'
import {
  SearchOneIcon,
  QuillWriteOneIcon,
  AtomOneIcon,
  CalendarThreeIcon,
  ArrowRightOneIcon,
  CheckmarkCircleTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import type { DigestItem } from './BrainDigestCard'

// ── Rotating headlines ─────────────────────────────────────────────────────
// Each headline is a three-beat capability chain — one per Brain workflow.
// Random per session so every visit surfaces a different angle.

const ROTATING_HEADLINES = [
  'Research. Draft. Ship.',
  'Scan. Summarise. Report.',
  'Plan. Execute. Deliver.',
  'Brief. Write. Launch.',
  'Analyse. Decide. Act.',
  'Outline. Build. Export.',
]

// ── Suggestion cards ───────────────────────────────────────────────────────
// Prompt starters that fill the ChatInput — Brain-specific workflows only.

const SUGGESTION_CARDS = [
  {
    id:    'sc-0',
    Icon:  SearchOneIcon,
    label: 'Research a topic in depth and deliver a clear, sourced summary',
  },
  {
    id:    'sc-1',
    Icon:  QuillWriteOneIcon,
    label: 'Draft long-form content from scratch and refine until it\'s ready to ship',
  },
  {
    id:    'sc-2',
    Icon:  AtomOneIcon,
    label: 'Plan a multi-step project, then execute each step and report back',
  },
]

// ── SuggestionCard ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  Icon:    React.ComponentType<{ size?: number }>
  label:   string
  onClick: () => void
}

function SuggestionCard({ Icon, label, onClick }: SuggestionCardProps) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <m.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        display:         'flex',
        flexDirection:   'column',
        gap:             '8px',
        alignItems:      'flex-start',
        flex:            '1 1 0',
        minWidth:        0,
        padding:         '12px 12px 16px',
        borderRadius:    12,
        backgroundColor: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
        boxShadow:       hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card-default)',
        border:          'none',
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'box-shadow 150ms ease, background-color 200ms ease',
      }}
    >
      {/* Icon badge */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px',
        borderRadius:    '8px',
        backgroundColor: 'var(--neutral-100)',
        color:           'var(--neutral-600)',
        flexShrink:      0,
      }}>
        <Icon size={32} />
      </div>

      {/* Label */}
      <p style={{
        margin:           0,
        fontFamily:       'var(--font-body)',
        fontSize:         'var(--font-size-body-lg)',
        fontWeight:       'var(--font-weight-medium)',
        lineHeight:       'var(--line-height-body-lg)',
        color:            'var(--neutral-900)',
        overflow:         'hidden',
        display:          '-webkit-box',
        WebkitLineClamp:  3,
        WebkitBoxOrient:  'vertical',
      }}>
        {label}
      </p>
    </m.button>
  )
}

// ── DigestBanner ───────────────────────────────────────────────────────────
// Compact single-row signal shown on home when scheduled runs completed while away.

interface DigestBannerProps {
  items:     DigestItem[]
  onReview?: () => void
}

function DigestBanner({ items, onReview }: DigestBannerProps) {
  const label = items.length === 1
    ? `${items[0].scheduleName} ran while you were away`
    : `Brain ran ${items.length} schedules while you were away`

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             8,
      padding:         '10px 14px',
      minHeight:       40,
      borderRadius:    12,
      backgroundColor: 'var(--neutral-white)',
      border:          '1px solid var(--neutral-200)',
      width:           '100%',
      boxShadow:       'var(--shadow-card-default)',
      boxSizing:       'border-box',
    }}>
      <span style={{ lineHeight: 0, flexShrink: 0 }}>
        <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
      </span>

      <span style={{
        flex:         '1 0 0',
        minWidth:     0,
        fontFamily:   'var(--font-body)',
        fontSize:     'var(--font-size-body)',
        lineHeight:   'var(--line-height-body)',
        color:        'var(--neutral-600)',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {label}
      </span>

      {onReview && (
        <Button variant="ghost" size="sm" rightIcon={<ArrowRightOneIcon />} onClick={onReview}>
          Review
        </Button>
      )}
    </div>
  )
}

// ── ScheduleStrip ──────────────────────────────────────────────────────────
// Slim next-run strip shown below hero for power users with active schedules.

interface ActiveSchedule {
  id:      string
  name:    string
  nextRun: string
}

interface ScheduleStripProps {
  schedules:        ActiveSchedule[]
  onViewSchedules?: () => void
}

function ScheduleStrip({ schedules, onViewSchedules }: ScheduleStripProps) {
  if (schedules.length === 0) return null
  const first = schedules[0]
  const extra = schedules.length - 1

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             8,
      padding:         '10px 14px',
      minHeight:       40,
      borderRadius:    12,
      backgroundColor: 'var(--neutral-50)',
      border:          '1px solid var(--neutral-100)',
      width:           '100%',
      boxShadow:       'var(--shadow-card-default)',
      boxSizing:       'border-box',
    }}>
      <CalendarThreeIcon size={14} color="var(--neutral-400)" />
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
        <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-700)' }}>
          {first.name}
        </span>
        {' '}runs next at {first.nextRun}
        {extra > 0 && ` · +${extra} more`}
      </span>
      {onViewSchedules && (
        <Button variant="ghost" size="sm" rightIcon={<ArrowRightOneIcon />} onClick={onViewSchedules}>
          View
        </Button>
      )}
    </div>
  )
}

// ── BrainHome ──────────────────────────────────────────────────────────────

export interface BrainHomeProps {
  /** Populates the ChatInput when a suggestion card is clicked. */
  onSuggestion?:    (text: string) => void
  /** Scheduled runs completed while the user was away — shows compact DigestBanner. */
  digestItems?:     DigestItem[]
  /** Called when user clicks "Review" in the digest banner. */
  onViewRun?:       (scheduleId: string) => void
  /** Active schedules shown in the schedule strip (power user mode). */
  activeSchedules?: ActiveSchedule[]
  /** Navigate to the Schedules view. */
  onViewSchedules?: () => void
}

export function BrainHome({
  onSuggestion,
  digestItems,
  onViewRun,
  activeSchedules,
  onViewSchedules,
}: BrainHomeProps) {
  const headline = useMemo(
    () => ROTATING_HEADLINES[Math.floor(Math.random() * ROTATING_HEADLINES.length)],
    [],
  )

  const hasDigest    = digestItems && digestItems.length > 0
  const hasSchedules = activeSchedules && activeSchedules.length > 0
  // Once user has schedules, they know what Brain does — hide the onboarding suggestions
  const isPowerUser  = hasDigest || hasSchedules

  return (
    <div style={{
      flex:          1,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      justifyContent:'flex-start',
      gap:           '28px',
      paddingTop:    '80px',
      paddingBottom: '40px',
      paddingLeft:   '24px',
      paddingRight:  '24px',
      overflowY:     'auto',
    }}>

      {/* ── Hero ── */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '12px',
      }}>
        {/* Rotating headline */}
        <p style={{
          margin:        0,
          fontFamily:    'var(--font-title)',
          fontSize:      'var(--font-size-display)',
          fontWeight:    'var(--font-weight-regular)',
          lineHeight:    'var(--line-height-display)',
          color:         'var(--neutral-800)',
          letterSpacing: '-0.01em',
          textAlign:     'center',
          whiteSpace:    'nowrap',
        }}>
          {headline}
        </p>

        {/* Subtitle */}
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-500)',
          textAlign:  'center',
          maxWidth:   '400px',
        }}>
          Give Brain a goal. It plans, executes, and delivers — in the world.
        </p>
      </div>

      {/* ── Status group — digest + schedule strip, tightly paired ── */}
      {(hasDigest || hasSchedules) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {hasDigest && (
            <DigestBanner
              items={digestItems!}
              onReview={() => onViewRun?.(digestItems![0].scheduleId)}
            />
          )}
          {hasSchedules && (
            <ScheduleStrip
              schedules={activeSchedules!}
              onViewSchedules={onViewSchedules}
            />
          )}
        </div>
      )}

      {/* ── Suggestion cards — new users only, hidden once schedules exist ── */}
      {!isPowerUser && (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'flex-start',
          gap:           '13px',
          width:         '100%',
        }}>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body-lg)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body-lg)',
            color:      'var(--neutral-600)',
          }}>
            Not sure where to start?
          </p>

          <div style={{
            display:    'flex',
            gap:        '16px',
            alignItems: 'flex-start',
            width:      '100%',
          }}>
            {SUGGESTION_CARDS.map(card => (
              <SuggestionCard
                key={card.id}
                Icon={card.Icon}
                label={card.label}
                onClick={() => onSuggestion?.(card.label)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
