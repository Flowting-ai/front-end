'use client'

import React from 'react'
import {
  BrainTwoIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  ArrowRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DigestItem {
  scheduleId:     string
  scheduleName:   string   // "Morning Briefing"
  ranAt:          string   // "Today · 8:00 AM"
  summary:        string   // "Analyzed 12 new Notion pages, flagged 2 blockers"
  artifactTitle?: string   // optional artifact produced
  artifactMeta?:  string   // "Notion · Saved"
  status:         'complete' | 'partial' | 'failed'
}

export interface BrainDigestCardProps {
  /** Scheduled runs completed while the user was away — typically 1–3 items. */
  items:       DigestItem[]
  /** "Today" | "Yesterday" | "May 22" */
  date?:       string
  /** Navigate to the schedule detail view for a specific run. */
  onViewRun?:  (scheduleId: string) => void
}

// ── StatusIcon ────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DigestItem['status'] }) {
  if (status === 'complete') {
    return <CheckmarkCircleTwoIcon size={13} color="var(--color-tag-Green-text)" />
  }
  if (status === 'failed') {
    return <CancelCircleIcon size={13} color="var(--color-tag-Red-text)" />
  }
  // partial
  return (
    <div style={{
      width:           13,
      height:          13,
      borderRadius:    '50%',
      border:          '1.5px solid var(--color-tag-Yellow-text)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
    }}>
      <div style={{
        width:           5,
        height:          5,
        borderRadius:    '50%',
        backgroundColor: 'var(--color-tag-Yellow-text)',
      }} />
    </div>
  )
}

// ── BrainDigestCard ───────────────────────────────────────────────────────────

/**
 * Surfaces what Brain did during scheduled runs while the user was away.
 * Renders above the hero section on BrainHome when items are present,
 * or at the top of the thread as the first message of a new session.
 */
export function BrainDigestCard({ items, date, onViewRun }: BrainDigestCardProps) {
  if (items.length === 0) return null

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      boxShadow:       CARD_SHADOW,
      overflow:        'hidden',
    }}>

      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '10px 14px',
        borderBottom: '1px solid var(--neutral-100)',
      }}>
        <BrainTwoIcon size={14} color="var(--neutral-500)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-600)',
          flex:       '1 0 0',
        }}>
          Brain ran while you were away
        </span>
        {date && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-500)',
            flexShrink: 0,
          }}>
            {date}
          </span>
        )}
      </div>

      {/* Run items */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => (
          <div
            key={item.scheduleId}
            style={{
              display:      'flex',
              flexDirection:'column',
              gap:          6,
              padding:      '12px 14px',
              borderBottom: i < items.length - 1 ? '1px solid var(--neutral-50)' : undefined,
            }}
          >
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusIcon status={item.status} />
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 'var(--font-weight-medium)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-800)',
                flex:       '1 0 0',
                minWidth:   0,
              }}>
                {item.scheduleName}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-500)',
                flexShrink: 0,
              }}>
                {item.ranAt}
              </span>
            </div>

            {/* Summary */}
            <p style={{
              margin:     0,
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
              color:      'var(--neutral-600)',
              paddingLeft: 19,
            }}>
              {item.summary}
            </p>

            {/* Artifact row (optional) */}
            {item.artifactTitle && (
              <div style={{
                display:         'flex',
                alignItems:      'center',
                gap:             6,
                paddingLeft:     19,
                padding:         '5px 8px 5px 19px',
                borderRadius:    6,
                backgroundColor: 'var(--neutral-50)',
                alignSelf:       'flex-start',
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-700)',
                }}>
                  {item.artifactTitle}
                </span>
                {item.artifactMeta && (
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-500)',
                  }}>
                    · {item.artifactMeta}
                  </span>
                )}
              </div>
            )}

            {/* View run link */}
            {onViewRun && (
              <div style={{ alignSelf: 'flex-start', marginLeft: 19 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRightOneIcon />}
                  onClick={() => onViewRun(item.scheduleId)}
                >
                  View run
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}

BrainDigestCard.displayName = 'BrainDigestCard'
