'use client'

import React, { useState } from 'react'
import { PlusSignIcon, SearchOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
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
      gap:            24,
      padding:        '48px 24px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 'var(--font-weight-regular)',
          fontSize:   24,
          lineHeight: '32px',
          color:      '#1a1916',
          margin:     0,
          whiteSpace: 'nowrap',
        }}>
          No schedules yet
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-regular)',
          fontSize:   16,
          lineHeight: '22px',
          color:      '#1a1916',
          textAlign:  'center',
          maxWidth:   427,
          margin:     0,
        }}>
          Create a schedule to run Task automatically on a cadence.
        </p>
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim().toLowerCase()
  const visibleSchedules = trimmedQuery
    ? schedules.filter(s =>
        s.name.toLowerCase().includes(trimmedQuery)
        || (s.description ?? '').toLowerCase().includes(trimmedQuery),
      )
    : schedules
  const noSearchResults = !isEmpty && trimmedQuery !== '' && visibleSchedules.length === 0

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
            fontFamily: 'var(--font-title)',
            fontSize:   24,
            fontWeight: 'var(--font-weight-regular)',
            lineHeight: '32px',
            color:      'var(--neutral-900)',
          }}>
            Schedules
          </h2>
          <p style={{
            margin:     '4px 0 0',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
          }}>
            Automated tasks that run on your behalf
          </p>
        </div>
        {!isEmpty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {searchOpen && (
              <div style={{ width: 220 }}>
                <InputField
                  label="Search schedules"
                  showLabel={false}
                  value={query}
                  onChange={setQuery}
                  placeholder="Search schedules…"
                  leftIcon={<SearchOneIcon size={16} />}
                  size="small"
                  fluid
                  autoFocus
                />
              </div>
            )}
            <IconButton
              variant={searchOpen ? 'secondary' : 'outline'}
              size="sm"
              icon={searchOpen ? <CancelOneIcon size={16} /> : <SearchOneIcon size={16} />}
              aria-label={searchOpen ? 'Close search' : 'Search schedules'}
              onClick={() => {
                setSearchOpen(open => !open)
                setQuery('')
              }}
            />
            <Button
              variant="default"
              size="sm"
              leftIcon={<PlusSignIcon />}
              onClick={onCreateNew}
            >
              New schedule
            </Button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState onCreateNew={onCreateNew} />
      ) : noSearchResults ? (
        <p style={{
          margin:     0,
          padding:    '48px 24px',
          textAlign:  'center',
          fontFamily: 'var(--font-body)',
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-500)',
        }}>
          No schedules match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <>
          {/* Schedule grid */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap:                 24,
          }}>
            {visibleSchedules.map(s => (
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
