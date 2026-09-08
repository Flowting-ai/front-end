'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownOneIcon, SearchOneIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { TimeField } from '@/components/TimeField'
import Tabs from '@/components/Tabs'
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

// 24-hour HH:MM → "9:00 AM" style, for the live preview line only. Never fed
// back into formatFrequency — that still uses the raw hour/minute numbers.
function to12Hour(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12    = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${pad(minute)} ${period}`
}

// Reads the schedule sentence the backend built ("Every day at 9:00 AM
// (America/Chicago)", "Every Monday at 6:30 PM (UTC)") back into the form's
// fields. Cadences this two-field form cannot express — "Every 5 minutes", "On
// the 2nd Friday of the month" — return null, and the form opens on its
// defaults rather than misstating what is scheduled.
function parseFrequency(
  freq: string,
): { type: FrequencyType; hour: number; minute: number; day: DayOfWeek; timezone: string | null } | null {
  const tzMatch  = freq.match(/\(([^)]+)\)\s*$/)
  const timezone = tzMatch ? tzMatch[1].trim() : null

  const match = freq.match(/^Every\s+(day|\w+day)\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null

  let hour = parseInt(match[2], 10)
  const period = match[4].toUpperCase()
  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  const minute = parseInt(match[3], 10)

  const named = DAYS.find(d => d.toLowerCase() === match[1].toLowerCase())
  if (named) return { type: 'weekly', hour, minute, day: named, timezone }
  if (match[1].toLowerCase() === 'day') return { type: 'daily', hour, minute, day: 'Monday', timezone }
  return null
}

// ── Shared field chrome ───────────────────────────────────────────────────────

// Frequency, Day, Time, and Timezone controls all share this width so they
// line up as one right-aligned column regardless of each control's own
// natural content width.
const FIELD_WIDTH = 200

// Matches the field-label convention used by other standard modals
// (EditProjectModal, ConnectorRequestModal) for hand-rolled controls that
// don't go through InputField itself — 14px/medium/neutral-700, not caption.
const labelStyle: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontSize:     'var(--font-size-body)',
  fontWeight:   'var(--font-weight-medium)',
  lineHeight:   'var(--line-height-body)',
  color:        'var(--neutral-700)',
  marginBottom: 6,
  display:      'block',
}

// The three top-level section headers (Name, Instructions, Frequency card) —
// a separate style from `labelStyle` above (which is for the smaller
// Day/Time/Timezone/Frequency-toggle sub-fields) so the two tiers can each
// stay internally consistent without fighting one shared value. Matches
// InputField's own label exactly (same font tokens/color/weight) so Name's
// real InputField label and these two hand-rolled ones read as identical.
const sectionLabelStyle: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontSize:     'var(--font-size-body)',
  fontWeight:   'var(--font-weight-regular)',
  lineHeight:   'var(--line-height-body)',
  color:        'var(--text-field-label)',
  marginBottom: 6,
  display:      'block',
}

// Matches InputField's own container chrome so the hand-rolled textarea/time
// controls below don't look like a different component family.
const fieldShellStyle: React.CSSProperties = {
  width:           '100%',
  boxSizing:       'border-box',
  fontFamily:      'var(--font-body)',
  fontSize:        'var(--font-size-body)',
  lineHeight:      'var(--line-height-body)',
  color:           'var(--neutral-800)',
  backgroundColor: 'var(--neutral-white)',
  boxShadow:       '0px 1px 1.5px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
  border:          'none',
  borderRadius:    10,
  padding:         '9px 12px',
  outline:         'none',
  transition:      'box-shadow 150ms ease',
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
  const [time,         setTime]         = useState('')   // "HH:MM", 24-hour — native <input type="time"> value
  const [day,          setDay]          = useState<DayOfWeek>('Monday')
  const [timezone,     setTimezone]     = useState(detectTimezone())
  const [dayOpen,      setDayOpen]      = useState(false)
  const [tzOpen,       setTzOpen]       = useState(false)
  const [tzSearch,     setTzSearch]     = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens/schedule changes
  useEffect(() => {
    if (isOpen) {
      setName(schedule?.name ?? '')
      setInstructions(schedule?.instructions ?? '')
      const parsed = schedule?.frequency ? parseFrequency(schedule.frequency) : null
      if (parsed) {
        setFreqType(parsed.type)
        setTime(`${pad(parsed.hour)}:${pad(parsed.minute)}`)
        setDay(parsed.day)
        setTimezone(parsed.timezone ?? schedule?.timezone ?? detectTimezone())
      } else {
        setFreqType('daily')
        setTime('')
        setDay('Monday')
        setTimezone(schedule?.timezone ?? detectTimezone())
      }
    }
  }, [isOpen, schedule?.name, schedule?.instructions, schedule?.frequency, schedule?.timezone])

  // Focus the first field as soon as the modal is on screen.
  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => nameInputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [isOpen])

  // Escape closes the modal, same as clicking the backdrop. Latest onClose is
  // read via a ref so the listener isn't torn down and re-attached on every
  // render where the parent hands down a new callback identity.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const timeParts = time.match(/^(\d{2}):(\d{2})$/)
  const hourNum   = timeParts ? parseInt(timeParts[1], 10) : NaN
  const minuteNum = timeParts ? parseInt(timeParts[2], 10) : NaN
  const timeValid = !!timeParts && hourNum >= 0 && hourNum <= 23 && minuteNum >= 0 && minuteNum <= 59

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

  const previewText = timeValid
    ? freqType === 'daily'
      ? `Runs every day at ${to12Hour(hourNum, minuteNum)} · ${timezone.replace(/_/g, ' ')}`
      : `Runs every ${day} at ${to12Hour(hourNum, minuteNum)} · ${timezone.replace(/_/g, ' ')}`
    : null

  // Case-insensitive substring match against the raw zone id (matching
  // behavior is agnostic to the underscore-to-space display formatting).
  const filteredTimezones = tzSearch.trim()
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(tzSearch.trim().toLowerCase()))
    : TIMEZONES

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
            role="dialog"
            aria-modal="true"
            aria-label={isCreate ? 'New schedule' : 'Edit schedule'}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={springs.fast}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--neutral-white)',
              borderRadius:    16,
              maxWidth:        640,
              width:           '100%',
              minHeight:       600,
              maxHeight:       'calc(100vh - 48px)',
              display:         'flex',
              flexDirection:   'column',
              boxShadow:       '0 8px 40px rgba(0,0,0,0.12)',
              overflow:        'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          12,
              padding:      '24px 24px 0',
              flexShrink:   0,
            }}>
              <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-title)',
                  fontSize:   'var(--font-size-heading)',
                  fontWeight: 'var(--font-weight-regular)',
                  lineHeight: 'var(--line-height-heading)',
                  color:      'var(--neutral-900)',
                }}>
                  {isCreate ? 'New schedule' : 'Edit schedule'}
                </span>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-500)',
                }}>
                  {isCreate
                    ? 'Schedules are created via Task — review the details below, then send to create it.'
                    : 'Changes are applied via Task — review the details below, then send to update it.'}
                </span>
              </div>
              <IconButton
                variant="ghost"
                size="xs"
                icon={<CancelOneIcon />}
                aria-label="Close"
                onClick={onClose}
              />
            </div>

            {/* Body — scrolls on its own if the timezone list or a long
                instructions value pushes past the viewport. */}
            <div
              className="kaya-scrollbar"
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           20,
                padding:       '20px 24px 24px',
                overflowY:     'auto',
              }}
            >
              {/* Name */}
              <InputField
                ref={nameInputRef}
                label="Name of the schedule"
                value={name}
                onChange={setName}
                placeholder="Morning briefing"
                fluid
              />

              {/* Instructions */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="schedule-instructions" style={sectionLabelStyle}>Set instructions for the schedule</label>
                <textarea
                  id="schedule-instructions"
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Describe what Task should do on each run…"
                  rows={3}
                  style={{
                    ...fieldShellStyle,
                    resize:    'vertical',
                    minHeight: 80,
                  }}
                />
              </div>

              {/* Frequency card — grouped so cadence/day/time/timezone read as
                  one decision rather than four loose fields. Wrapped together
                  with its header in one flex column (gap 8) so the two stay
                  tightly coupled regardless of the body's own larger gap-20,
                  matching how Name/Instructions hug their own control. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={sectionLabelStyle}>When and how often it should run</p>
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           16,
                padding:       16,
                borderRadius:  12,
                border:        '1px solid var(--neutral-200)',
              }}>
                {/* Frequency, Day (weekly only), Time, Timezone — one row
                    each, label to the left and its field pinned to the right
                    edge, instead of a label-above/field-below column stack. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <p style={{ ...labelStyle, margin: 0 }}>Frequency</p>
                  <Tabs
                    value={freqType}
                    onValueChange={(v) => setFreqType(v as FrequencyType)}
                    style={{ width: FIELD_WIDTH, flexShrink: 0 }}
                  >
                    <Tabs.List size="small" fluid>
                      <Tabs.Trigger value="daily">Daily</Tabs.Trigger>
                      <Tabs.Trigger value="weekly">Weekly</Tabs.Trigger>
                    </Tabs.List>
                  </Tabs>
                </div>

                {freqType === 'weekly' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <label id="schedule-day-label" style={{ ...labelStyle, margin: 0 }}>Day</label>
                    <Dropdown.Float
                      open={dayOpen}
                      onOpenChange={setDayOpen}
                      placement="top-end"
                      trigger={
                        <Button
                          id="schedule-day"
                          variant="outline"
                          size="sm"
                          fluid
                          aria-labelledby="schedule-day-label"
                          rightIcon={<ArrowDownOneIcon animated />}
                          style={{ width: FIELD_WIDTH }}
                        >
                          {day}
                        </Button>
                      }
                    >
                      <Dropdown>
                        <Dropdown.Section>
                          {DAYS.map(d => (
                            <Dropdown.Item
                              key={d}
                              label={d}
                              selected={day === d}
                              onClick={() => { setDay(d); setDayOpen(false) }}
                              fluid
                            />
                          ))}
                        </Dropdown.Section>
                      </Dropdown>
                    </Dropdown.Float>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <label htmlFor="schedule-time" style={{ ...labelStyle, margin: 0 }}>Time</label>
                  <TimeField
                    id="schedule-time"
                    label="Time"
                    showLabel={false}
                    size="small"
                    value={time}
                    onChange={setTime}
                    style={{ width: FIELD_WIDTH, flexShrink: 0 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <label id="schedule-timezone-label" style={{ ...labelStyle, margin: 0 }}>Timezone</label>
                  <Dropdown.Float
                    open={tzOpen}
                    onOpenChange={(next) => {
                      setTzOpen(next)
                      if (!next) setTzSearch('') // reset search each time the popover closes
                    }}
                    placement="top-end"
                    trigger={
                      <Button
                        id="schedule-timezone"
                        variant="outline"
                        size="sm"
                        fluid
                        aria-labelledby="schedule-timezone-label"
                        rightIcon={<ArrowDownOneIcon animated />}
                        style={{ width: FIELD_WIDTH }}
                      >
                        {/* flex/minWidth so long zone names still truncate with
                            an ellipsis and the chevron stays pinned to the
                            right, instead of centering (and possibly
                            overflowing) alongside it like the short Day/Time
                            labels do. */}
                        <span style={{
                          flex:         '1 1 0',
                          minWidth:     0,
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                          textAlign:    'left',
                        }}>
                          {timezone.replace(/_/g, ' ')}
                        </span>
                      </Button>
                    }
                  >
                    {/* Search sits in Popover's own sticky `header` slot, and
                        the list is a plain Dropdown.Section — Popover's default
                        scroll area (kaya-scrollbar + edge fades) handles the
                        list, and Section's own 8px padding/4px gap give each
                        row the same spacing as every other dropdown, instead
                        of a hand-rolled scroll div with its own ad-hoc padding. */}
                    <Dropdown
                      size="lg"
                      header={
                        <div style={{ padding: 8 }}>
                          <InputField
                            size="small"
                            showLabel={false}
                            label="Search timezone"
                            showSubtitle={false}
                            leftIcon={<SearchOneIcon size={16} />}
                            placeholder="Search timezone…"
                            value={tzSearch}
                            onChange={setTzSearch}
                            fluid
                          />
                        </div>
                      }
                    >
                      <Dropdown.Section divider fluid>
                        {filteredTimezones.length > 0 ? (
                          filteredTimezones.map(tz => (
                            <Dropdown.Item
                              key={tz}
                              label={tz.replace(/_/g, ' ')}
                              selected={timezone === tz}
                              onClick={() => { setTimezone(tz); setTzOpen(false) }}
                              fluid
                            />
                          ))
                        ) : (
                          <div style={{
                            padding:    '8px 6px',
                            fontFamily: 'var(--font-body)',
                            fontSize:   'var(--font-size-caption)',
                            color:      'var(--neutral-500)',
                            textAlign:  'center',
                          }}>
                            {`No timezones matching "${tzSearch}"`}
                          </div>
                        )}
                      </Dropdown.Section>
                    </Dropdown>
                  </Dropdown.Float>
                </div>

                {/* Live preview — confirms the cadence in plain English before
                    it's turned into a Task prompt, so mistakes are caught here
                    instead of after the schedule is created. */}
                {previewText && (
                  <p style={{
                    margin:     0,
                    fontFamily: 'var(--font-body)',
                    fontSize:   'var(--font-size-caption)',
                    lineHeight: 'var(--line-height-caption)',
                    color:      'var(--neutral-600)',
                  }}>
                    {previewText}
                  </p>
                )}
              </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display:        'flex',
              justifyContent: 'flex-end',
              gap:            8,
              padding:        '16px 24px',
              borderTop:      '1px solid var(--neutral-100)',
              flexShrink:     0,
            }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!canSave}
                onClick={handleSave}
              >
                {isCreate ? 'Start task' : 'Update in Tasks'}
              </Button>
            </div>

          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

ScheduleEditModal.displayName = 'ScheduleEditModal'
