'use client'

import React, { useState, useEffect } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import { springs } from '@/lib/springs'
import { trackFeature } from '@/lib/analytics/events'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleEditData {
  name:         string
  instructions: string
  frequency:    string
  /** IANA zone the frequency time is in. Always set by the modal on save;
   *  optional on input since edit data carries it inside `frequency`. */
  timezone?:    string
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

// The IANA zone the user's browser is in — used as the default selection.
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Full IANA zone list when the runtime supports it; otherwise the detected zone
// is the only option (always valid). Detected zone is force-included + first.
const TIMEZONES: string[] = (() => {
  const detected = detectTimezone()
  let zones: string[] = []
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (typeof supported === 'function') zones = supported('timeZone')
  } catch { /* not supported — fall back to detected only */ }
  if (!zones.includes(detected)) zones = [detected, ...zones]
  return zones
})()

const pad = (n: number) => String(n).padStart(2, '0')

function formatFrequency(
  type: FrequencyType,
  hour: number,
  minute: number,
  day: DayOfWeek,
  timezone: string,
): string {
  const time = `${pad(hour)}:${pad(minute)}`
  const base = type === 'daily' ? `Daily • ${time}` : `Weekly • ${day} ${time}`
  return timezone ? `${base} (${timezone})` : base
}

// Parses a frequency string back into discrete form fields. Handles both the
// modal format ("Daily • 14:00 (America/Chicago)"), the page format
// ("Daily · 08:00", "Weekly · Monday · 14:00"), and legacy 12-hour strings
// ("Daily • 8:00 AM"). A trailing "(Zone)" is read back as the timezone.
function parseFrequency(
  freq: string,
): { type: FrequencyType; hour: number; minute: number; day: DayOfWeek; timezone: string | null } | null {
  const tzMatch   = freq.match(/\(([^)]+)\)\s*$/)
  const timezone  = tzMatch ? tzMatch[1].trim() : null

  const weeklyRe = /^Weekly\s*[·•]\s*(\w+)\s*(?:[·•]\s*)?(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i
  const wm = freq.match(weeklyRe)
  if (wm) {
    let h = parseInt(wm[2], 10)
    const period = wm[4]?.toUpperCase()
    if (period === 'PM' && h < 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    const minute = parseInt(wm[3], 10)
    const day    = DAYS.includes(wm[1] as DayOfWeek) ? (wm[1] as DayOfWeek) : 'Monday'
    return { type: 'weekly', hour: h, minute, day, timezone }
  }
  const dailyRe = /^Daily\s*[·•]\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i
  const dm = freq.match(dailyRe)
  if (dm) {
    let h = parseInt(dm[1], 10)
    const period = dm[3]?.toUpperCase()
    if (period === 'PM' && h < 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    const minute = parseInt(dm[2], 10)
    return { type: 'daily', hour: h, minute, day: 'Monday', timezone }
  }
  return null
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
}: ScheduleEditModalProps) {
  const isCreate = !schedule

  const [name,         setName]         = useState(schedule?.name ?? '')
  const [instructions, setInstructions] = useState(schedule?.instructions ?? '')
  const [freqType,     setFreqType]     = useState<FrequencyType>('daily')
  const [hour,         setHour]         = useState('')   // 0–23, free text (placeholder "Hours")
  const [minute,       setMinute]       = useState('')   // 0–59, free text (placeholder "Mins")
  const [day,          setDay]          = useState<DayOfWeek>('Monday')
  const [timezone,     setTimezone]     = useState(detectTimezone())

  // Reset form when modal opens/schedule changes
  useEffect(() => {
    if (isOpen) {
      setName(schedule?.name ?? '')
      setInstructions(schedule?.instructions ?? '')
      const parsed = schedule?.frequency ? parseFrequency(schedule.frequency) : null
      if (parsed) {
        setFreqType(parsed.type)
        setHour(String(parsed.hour))
        setMinute(pad(parsed.minute))
        setDay(parsed.day)
        setTimezone(parsed.timezone ?? schedule?.timezone ?? detectTimezone())
      } else {
        setFreqType('daily')
        setHour('')
        setMinute('')
        setDay('Monday')
        setTimezone(schedule?.timezone ?? detectTimezone())
      }
    }
  }, [isOpen, schedule?.name, schedule?.instructions, schedule?.frequency, schedule?.timezone])

  // Keep only digits, clamp to the field's valid range (hours 0–23, mins 0–59).
  const handleTimeChange = (raw: string, max: number, set: (v: string) => void) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') { set(''); return }
    const n = Math.min(parseInt(digits, 10), max)
    set(String(n))
  }

  const hourNum   = parseInt(hour, 10)
  const minuteNum = parseInt(minute, 10)
  const timeValid =
    Number.isInteger(hourNum)   && hourNum   >= 0 && hourNum   <= 23 &&
    Number.isInteger(minuteNum) && minuteNum >= 0 && minuteNum <= 59

  const handleSave = () => {
    if (!name.trim() || !timeValid) return
    trackFeature('schedule_created', { frequency_type: freqType })
    onSave({
      name:         name.trim(),
      instructions: instructions.trim(),
      frequency:    formatFrequency(freqType, hourNum, minuteNum, day, timezone),
      timezone,
    })
  }

  const canSave = name.trim().length > 0 && timeValid

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
            {isCreate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-body-lg)',
                  fontWeight: 'var(--font-weight-semibold)',
                  lineHeight: 'var(--line-height-body-lg)',
                  color:      'var(--neutral-900)',
                }}>
                  New schedule
                </span>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-500)',
                }}>
                  Schedules are always created via brain threads — enter details here to go create the schedule via a brain thread.
                </span>
              </div>
            ) : (
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                lineHeight: 'var(--line-height-body-lg)',
                color:      'var(--neutral-900)',
              }}>
                Edit schedule
              </span>
            )}

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

              {/* Time entry — free text, interpreted in the selected timezone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor="schedule-hour" style={{ ...labelStyle, margin: 0 }}>Time</label>
                <input
                  id="schedule-hour"
                  type="text"
                  inputMode="numeric"
                  value={hour}
                  onChange={e => handleTimeChange(e.target.value, 23, setHour)}
                  placeholder="Hours"
                  aria-label="Hours (0–23)"
                  style={{ ...inputStyle, width: 72, textAlign: 'center' }}
                />
                <span style={{ color: 'var(--neutral-400)', fontFamily: 'var(--font-body)' }}>:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minute}
                  onChange={e => handleTimeChange(e.target.value, 59, setMinute)}
                  placeholder="Mins"
                  aria-label="Minutes (0–59)"
                  style={{ ...inputStyle, width: 72, textAlign: 'center' }}
                />
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  color:      'var(--neutral-400)',
                }}>
                  24-hour
                </span>
              </div>

              {/* Timezone picker — the zone the time above is in; sent to the backend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor="schedule-timezone" style={{ ...labelStyle, margin: 0 }}>Timezone</label>
                <select
                  id="schedule-timezone"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  style={{ ...selectStyle, maxWidth: 280 }}
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
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
                {isCreate ? 'Start brain thread' : 'Update in Brain'}
              </Button>
            </div>

          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

ScheduleEditModal.displayName = 'ScheduleEditModal'
