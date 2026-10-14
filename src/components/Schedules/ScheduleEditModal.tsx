'use client'

import React, { useEffect, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { InputField } from '@/components/InputField'
import { TimeField } from '@/components/TimeField'
import Tabs from '@/components/Tabs'
import { springs } from '@/lib/springs'
import { trackFeature } from '@/lib/analytics/events'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useZodForm } from '@/hooks/use-zod-form'
import {
  initialFormValues,
  previewText,
  scheduleFormSchema,
  toEditData,
  type FrequencyType,
} from '@/lib/schedules/schedule-form'
import { DayPicker, FIELD_WIDTH, TimezonePicker } from './SchedulePickers'

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

// Field labels follow InputField's own (14px body, field-label colour); the
// small row labels inside the frequency card use neutral-700 medium.
const sectionLabel = 'mb-1.5 block text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--text-field-label)]'
const rowLabel = 'm-0 text-[length:var(--font-size-body)] font-[number:var(--font-weight-medium)] leading-[var(--line-height-body)] text-[var(--neutral-700)]'
const row = 'flex items-center justify-between gap-3'
const errorText = 'm-0 mt-1 text-[length:var(--font-size-caption)] text-[var(--red-600)]'

// ── ScheduleEditModal ─────────────────────────────────────────────────────────
// Pure parts (parse/format the cadence, schema, preview) live in
// lib/schedules/schedule-form.ts; the day and timezone pickers in SchedulePickers.

export function ScheduleEditModal({ isOpen, schedule, onSave, onClose }: ScheduleEditModalProps) {
  const isCreate = !schedule
  const form = useZodForm(scheduleFormSchema, initialFormValues(schedule))
  const { values, setField, errors, isValid, reset } = form

  const nameInputRef = useRef<HTMLInputElement>(null)
  const cardRef      = useRef<HTMLDivElement>(null)
  // Keeps Tab inside the card; Esc is handled by the listener below.
  useFocusTrap(cardRef, isOpen)

  // Reset the form each time the modal opens (or the schedule it edits changes).
  const resetRef = useRef(reset)
  useEffect(() => { resetRef.current = reset }, [reset])
  useEffect(() => {
    if (isOpen) resetRef.current(initialFormValues(schedule))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the schedule's fields, not its object identity
  }, [isOpen, schedule?.name, schedule?.instructions, schedule?.frequency, schedule?.timezone])

  // Focus the first field as soon as the modal is on screen.
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  // Escape closes the modal, same as the backdrop; latest onClose via a ref.
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

  const save = form.handleSubmit(data => {
    if (isCreate) trackFeature('schedule_created', { frequency_type: data.freqType })
    else trackFeature('schedule_edit_started', { frequency_type: data.freqType })
    onSave(toEditData(data))
  })
  const preview = previewText(values)

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
          className="fixed inset-0 z-20 flex items-center justify-center p-6 bg-[color-mix(in_srgb,var(--neutral-black)_40%,transparent)]"
        >
          <m.div
            key="schedule-edit-card"
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={isCreate ? 'New schedule' : 'Edit schedule'}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={springs.fast}
            onClick={e => e.stopPropagation()}
            className="flex max-h-[calc(100vh-48px)] min-h-[600px] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-[var(--modal-bg)] shadow-[0_8px_40px_color-mix(in_srgb,var(--static-black)_12%,transparent)]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start gap-3 px-6 pt-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="font-[family-name:var(--font-title)] text-[length:var(--font-size-heading)] leading-[var(--line-height-heading)] text-[var(--neutral-900)]">
                  {isCreate ? 'New schedule' : 'Edit schedule'}
                </span>
                <span className="text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--neutral-500)]">
                  {isCreate
                    ? 'Schedules are created via Task — review the details below, then send to create it.'
                    : 'Changes are applied via Task — review the details below, then send to update it.'}
                </span>
              </div>
              <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
            </div>

            {/* Body scrolls on its own when long instructions push past the viewport. */}
            <div className="kaya-scrollbar flex flex-col gap-5 overflow-y-auto px-6 pb-6 pt-5">
              <div>
                <InputField
                  ref={nameInputRef}
                  label="Name of the schedule"
                  value={values.name}
                  onChange={v => setField('name', v)}
                  placeholder="Morning briefing"
                  fluid
                />
                {errors.name && <p className={errorText} role="alert">{errors.name}</p>}
              </div>

              <div className="flex flex-col">
                <label htmlFor="schedule-instructions" className={sectionLabel}>Set instructions for the schedule</label>
                <textarea
                  id="schedule-instructions"
                  value={values.instructions}
                  onChange={e => setField('instructions', e.target.value)}
                  placeholder="Describe what Task should do on each run…"
                  rows={3}
                  aria-invalid={!!errors.instructions || undefined}
                  className="min-h-20 w-full resize-y rounded-[10px] border-none bg-[var(--field-surface)] px-3 py-[9px] text-[length:var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--neutral-800)] shadow-[0px_1px_1.5px_0px_var(--neutral-700-12),0px_0px_0px_1px_var(--neutral-100)] outline-none transition-shadow"
                />
                {errors.instructions && <p className={errorText} role="alert">{errors.instructions}</p>}
              </div>

              {/* Cadence, day, time and timezone read as one decision. */}
              <div className="flex flex-col gap-2">
                <p className={sectionLabel}>When and how often it should run</p>
                <div className="flex flex-col gap-4 rounded-xl border border-[var(--border-default)] p-4">
                  <div className={row}>
                    <p className={rowLabel}>Frequency</p>
                    <Tabs value={values.freqType} onValueChange={v => setField('freqType', v as FrequencyType)} style={{ width: FIELD_WIDTH, flexShrink: 0 }}>
                      <Tabs.List size="small" fluid>
                        <Tabs.Trigger value="daily">Daily</Tabs.Trigger>
                        <Tabs.Trigger value="weekly">Weekly</Tabs.Trigger>
                      </Tabs.List>
                    </Tabs>
                  </div>

                  {values.freqType === 'weekly' && (
                    <div className={row}>
                      <label id="schedule-day-label" className={rowLabel}>Day</label>
                      <DayPicker value={values.day} onChange={d => setField('day', d)} labelId="schedule-day-label" />
                    </div>
                  )}

                  <div className={row}>
                    <label htmlFor="schedule-time" className={rowLabel}>Time</label>
                    <TimeField id="schedule-time" label="Time" showLabel={false} size="small" value={values.time} onChange={v => setField('time', v)} style={{ width: FIELD_WIDTH, flexShrink: 0 }} />
                  </div>

                  <div className={row}>
                    <label id="schedule-timezone-label" className={rowLabel}>Timezone</label>
                    <TimezonePicker value={values.timezone} onChange={tz => setField('timezone', tz)} labelId="schedule-timezone-label" />
                  </div>

                  {/* Plain-English confirmation before it becomes a Task prompt. */}
                  {preview && <p className="m-0 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--neutral-600)]">{preview}</p>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--neutral-100)] px-6 py-4">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="default" size="sm" disabled={!isValid} onClick={save}>
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
