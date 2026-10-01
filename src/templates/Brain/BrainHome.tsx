'use client'

import React from 'react'
import {
  CalendarThreeIcon,
  ArrowRightOneIcon,
  CheckmarkCircleTwoIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { TemplateCard } from '@/components/chat/TemplateCard'
import { m } from 'framer-motion'
import { useRecommendationsState } from '@/hooks/use-recommendations'
import { TemplateCardSkeleton } from '@/components/chat/TemplateCardSkeleton'
import { RECOMMENDATION_ICONS } from '@/lib/recommendation-icons'
import type { DigestItem } from './BrainDigestCard'


// ── DigestBanner ───────────────────────────────────────────────────────────
// Compact single-row signal shown on home when scheduled runs completed while away.

interface DigestBannerProps {
  items:     DigestItem[]
  onReview?: () => void
}

function DigestBanner({ items, onReview }: DigestBannerProps) {
  const label = items.length === 1
    ? `${items[0].scheduleName} ran while you were away`
    : `Task ran ${items.length} schedules while you were away`

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

export interface ActiveSchedule {
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
  /**
   * 'default'  — full home: hero + status + suggestion cards, scrolling on its own.
   * 'centered' — only the status strip + suggestion cards, for rendering under the
   *              centered new-task input (the greeting and input are owned by BrainShell).
   */
  variant?: 'default' | 'centered'
}

export function BrainHome({
  onSuggestion,
  digestItems,
  onViewRun,
  activeSchedules,
  onViewSchedules,
  variant = 'default',
}: BrainHomeProps) {
  const { recommendations, isLoading: recommendationsLoading } = useRecommendationsState('brain')
  const isCentered = variant === 'centered'

  const hasDigest    = digestItems && digestItems.length > 0
  const hasSchedules = activeSchedules && activeSchedules.length > 0
  // Once user has schedules, they know what Brain does — hide the onboarding suggestions
  const isPowerUser  = hasDigest || hasSchedules

  return (
    <div className="kaya-scrollbar" style={isCentered ? {
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '28px',
      width:         '100%',
      marginTop:     '28px',
    } : {
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
      {!isCentered && <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '12px',
      }}>
        {/* Headline — generated with the cards by /recommendations. */}
        {recommendations?.headline && <p style={{
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
          {recommendations.headline}
        </p>}

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
          Give Task a goal. It plans, executes, and delivers - in the world.
        </p>
      </div>}

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
      {!isPowerUser && (recommendations || recommendationsLoading) && (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'flex-start',
          gap:           '10px',
          width:         '100%',
        }}>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   '13px',
            fontWeight: 500,
            color:      'var(--neutral-500)',
            textAlign:  'left',
          }}>
            Not sure where to start?
          </p>

          {/* Same TemplateCard as new chat. Default align-items (stretch) keeps
              every card in the row at the height of the tallest one. */}
          {recommendations ? (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                display:    'flex',
                gap:        '10px',
                alignItems: 'stretch',
                width:      '100%',
              }}
            >
              {recommendations.cards.map(card => {
                const { Icon, color } = RECOMMENDATION_ICONS[card.icon]
                return (
                  <TemplateCard
                    key={card.label}
                    icon={<Icon size={24} color={color} animated />}
                    label={card.label}
                    onClick={() => onSuggestion?.(card.prompt)}
                  />
                )
              })}
            </m.div>
          ) : (
            <TemplateCardSkeleton />
          )}
        </div>
      )}

    </div>
  )
}
