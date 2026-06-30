'use client'

import React from 'react'
import { PlusSignIcon, CalendarThreeIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { ScheduleCard, type ScheduleCardProps } from './ScheduleCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduleListItem = Omit<ScheduleCardProps, 'onClick'>

export interface ScheduleListViewProps {
  schedules:          ScheduleListItem[]
  onScheduleClick?:   (id: string) => void
  onCreateNew?:       () => void
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreateNew }: { onCreateNew?: () => void }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
      padding:        '60px 24px',
      textAlign:      'center',
    }}>
      <div style={{
        width:           40,
        height:          40,
        borderRadius:    12,
        backgroundColor: 'var(--neutral-100)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}>
        <CalendarThreeIcon size={20} color="var(--neutral-400)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-700)',
        }}>
          No schedules yet
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-400)',
        }}>
          Create a schedule to run Brain automatically on a cadence.
        </span>
      </div>
      <Button
        variant="default"
        size="sm"
        leftIcon={<PlusSignIcon />}
        onClick={onCreateNew}
      >
        Create schedule
      </Button>
    </div>
  )
}

// ── ScheduleListView ──────────────────────────────────────────────────────────

export function ScheduleListView({
  schedules,
  onScheduleClick,
  onCreateNew,
}: ScheduleListViewProps) {
  const isEmpty = schedules.length === 0

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      padding:       '32px 0',
      width:         '100%',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: '1 0 0' }}>
          <h2 style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            lineHeight: 'var(--line-height-body-lg)',
            color:      'var(--neutral-900)',
          }}>
            Schedules
          </h2>
          <p style={{
            margin:     '2px 0 0',
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
          }}>
            Automated tasks that run on your behalf
          </p>
        </div>
        {!isEmpty && (
          <Button
            variant="default"
            size="sm"
            leftIcon={<PlusSignIcon />}
            onClick={onCreateNew}
          >
            New schedule
          </Button>
        )}
      </div>

      {isEmpty ? (
        <EmptyState onCreateNew={onCreateNew} />
      ) : (
        <>
          {/* Schedule grid */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap:                 12,
          }}>
            {schedules.map(s => (
              <ScheduleCard
                key={s.id}
                {...s}
                onClick={onScheduleClick}
              />
            ))}
          </div>
        </>
      )}

    </div>
  )
}

ScheduleListView.displayName = 'ScheduleListView'
