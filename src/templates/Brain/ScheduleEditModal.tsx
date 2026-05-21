'use client'

import React, { useState, useEffect } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { springs } from '@/lib/springs'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleEditData {
  name:         string
  instructions: string
  frequency:    string
}

export interface ScheduleEditModalProps {
  isOpen:     boolean
  schedule?:  ScheduleEditData   // undefined = create mode
  onSave:     (data: ScheduleEditData) => void
  onClose:    () => void
}

type FrequencyType = 'daily' | 'weekly'
type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = ['00', '15', '30', '45']

function pad2(n: number) { return String(n).padStart(2, '0') }

function formatFrequency(type: FrequencyType, hour: number, minute: string, day: DayOfWeek): string {
  const time = `${pad2(hour)}:${minute}`
  if (type === 'daily') return `Daily · ${time}`
  return `Weekly · ${day} · ${time}`
}

// ── Input styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:           '100%',
  boxSizing:       'border-box',
  fontFamily:      'var(--font-body)',
  fontSize:        'var(--font-size-body)',
  lineHeight:      'var(--line-height-body)',
  color:           'var(--neutral-800)',
  backgroundColor: 'var(--neutral-white)',
  border:          '1px solid var(--neutral-200)',
  borderRadius:    8,
  padding:         '9px 12px',
  outline:         'none',
  transition:      'border-color 0.12s ease',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  fontWeight: 'var(--font-weight-medium)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-500)',
  marginBottom: 6,
  display:    'block',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width:    'auto',
  padding:  '7px 10px',
  cursor:   'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat:   'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight:       28,
}

// ── ScheduleEditModal ─────────────────────────────────────────────────────────

export function ScheduleEditModal({
  isOpen,
  schedule,
  onSave,
  onClose,
// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
}: ScheduleEditModalProps) {
  const isCreate = !schedule

  const [name,         setName]         = useState(schedule?.name ?? '')
  const [instructions, setInstructions] = useState(schedule?.instructions ?? '')
  const [freqType,     setFreqType]     = useState<FrequencyType>('daily')
  const [hour,         setHour]         = useState(8)
  const [minute,       setMinute]       = useState<string>('00')
  const [day,          setDay]          = useState<DayOfWeek>('Monday')

  // Reset form when modal opens/schedule changes
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (isOpen) {
      setName(schedule?.name ?? '')
      setInstructions(schedule?.instructions ?? '')
      setFreqType('daily')
      setHour(8)
      setMinute('00')
      setDay('Monday')
    }
  }, [isOpen, schedule?.name, schedule?.instructions])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name:         name.trim(),
      instructions: instructions.trim(),
      frequency:    formatFrequency(freqType, hour, minute, day),
    })
  }

  const canSave = name.trim().length > 0

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.div
          key="schedule-edit-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.fast}
          onClick={onClose}
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(10, 10, 10, 0.4)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            zIndex:          20,
            padding:         24,
          }}
        >
          <m.div
            key="schedule-edit-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={springs.fast}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--neutral-white)',
              borderRadius:    16,
              padding:         28,
              maxWidth:        520,
              width:           '100%',
              display:         'flex',
              flexDirection:   'column',
              gap:             20,
              boxShadow:       '0 8px 40px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--line-height-body-lg)',
              color:      'var(--neutral-900)',
            }}>
              {isCreate ? 'New schedule' : 'Edit schedule'}
            </span>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="schedule-name" style={labelStyle}>Name</label>
              <input
                id="schedule-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Morning briefing"
                style={inputStyle}
              />
            </div>

            {/* Instructions */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="schedule-instructions" style={labelStyle}>Instructions</label>
              <textarea
                id="schedule-instructions"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Describe what Brain should do on each run…"
                rows={3}
                style={{
                  ...inputStyle,
                  resize:    'vertical',
                  minHeight: 80,
                }}
              />
            </div>

            {/* Frequency */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ ...labelStyle, margin: 0 }}>Frequency</p>

              {/* Segmented control */}
              <div style={{
                display:         'inline-flex',
                borderRadius:    8,
                border:          '1px solid var(--neutral-200)',
                overflow:        'hidden',
                alignSelf:       'flex-start',
              }}>
                {(['daily', 'weekly'] as FrequencyType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFreqType(t)}
                    style={{
                      fontFamily:      'var(--font-body)',
                      fontSize:        'var(--font-size-body)',
                      lineHeight:      'var(--line-height-body)',
                      color:           freqType === t ? 'var(--neutral-800)' : 'var(--neutral-400)',
                      backgroundColor: freqType === t ? 'var(--neutral-100)' : 'transparent',
                      border:          'none',
                      padding:         '7px 16px',
                      cursor:          'pointer',
                      fontWeight:      freqType === t ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
                      transition:      'background-color 0.12s ease, color 0.12s ease',
                      borderRight:     t === 'daily' ? '1px solid var(--neutral-200)' : 'none',
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Day picker (weekly only) */}
              {freqType === 'weekly' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="schedule-day" style={{ ...labelStyle, margin: 0 }}>Day</label>
                  <select
                    id="schedule-day"
                    value={day}
                    onChange={e => setDay(e.target.value as DayOfWeek)}
                    style={selectStyle}
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              {/* Time picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor="schedule-hour" style={{ ...labelStyle, margin: 0 }}>Time</label>
                <select
                  id="schedule-hour"
                  value={hour}
                  onChange={e => setHour(Number(e.target.value))}
                  style={selectStyle}
                >
                  {HOURS.map(h => <option key={h} value={h}>{pad2(h)}:00</option>)}
                </select>
                <select
                  value={minute}
                  onChange={e => setMinute(e.target.value)}
                  style={selectStyle}
                >
                  {MINUTES.map(m => <option key={m} value={m}>:{m}</option>)}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!canSave}
                onClick={handleSave}
              >
                {isCreate ? 'Create schedule' : 'Save changes'}
              </Button>
            </div>

          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

ScheduleEditModal.displayName = 'ScheduleEditModal'
