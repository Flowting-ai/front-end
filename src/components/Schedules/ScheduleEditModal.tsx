'use client'

import React, { useEffect, useRef } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CancelOneIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { InputField } from '@/components/InputField'
import { TimeField } from '@/components/TimeField'
import Tabs from '@/components/Tabs'
import { trackFeature } from '@/lib/analytics/events'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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

// The day/timezone pickers' menus portal to document.body — a click in one isn't a click outside the dialog.
const isInDropdown = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-kds-dropdown-panel]')

// ── ScheduleEditModal ─────────────────────────────────────────────────────────
// Pure parts (parse/format the cadence, schema, preview) live in
// lib/schedules/schedule-form.ts; the day and timezone pickers in SchedulePickers.

export function ScheduleEditModal({ isOpen, schedule, onSave, onClose }: ScheduleEditModalProps) {
  const isCreate = !schedule
  const form = useZodForm(scheduleFormSchema, initialFormValues(schedule))
  const { values, setField, errors, isValid, isDirty, reset } = form

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset the form each time the modal opens (or the schedule it edits changes).
  const resetRef = useRef(reset)
  useEffect(() => { resetRef.current = reset }, [reset])
  useEffect(() => {
    if (isOpen) resetRef.current(initialFormValues(schedule))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the schedule's fields, not its object identity
  }, [isOpen, schedule?.name, schedule?.instructions, schedule?.frequency, schedule?.timezone])


  const save = form.handleSubmit(data => {
    if (isCreate) trackFeature('schedule_created', { frequency_type: data.freqType })
    else trackFeature('schedule_edit_started', { frequency_type: data.freqType })
    onSave(toEditData(data))
  })
  const preview = previewText(values)

  return (
    // Esc, the X and Cancel always close. A stray click outside must not throw away typed
    // details: once edited, only Cancel, the X or Esc close it.
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        hideClose
        aria-label={isCreate ? 'New schedule' : 'Edit schedule'}
        // Focus the first field as soon as the modal is on screen.
        onOpenAutoFocus={(e) => { e.preventDefault(); nameInputRef.current?.focus() }}
        onInteractOutside={(e) => { if (isDirty || isInDropdown(e.target)) e.preventDefault() }}
        style={{
          width:     640,
          maxWidth:  'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          minHeight: 600,
          background: 'var(--modal-bg)',
          boxShadow: '0 8px 40px color-mix(in srgb, var(--static-black) 12%, transparent)',
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 px-6 pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <DialogPrimitive.Title asChild>
            <span className="font-[family-name:var(--font-title)] text-[length:var(--font-size-heading)] leading-[var(--line-height-heading)] text-[var(--neutral-900)]">
              {isCreate ? 'New schedule' : 'Edit schedule'}
            </span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
            <span className="text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--neutral-500)]">
              {isCreate
                ? 'Schedules are created via Task — review the details below, then send to create it.'
                : 'Changes are applied via Task — review the details below, then send to update it.'}
            </span>
            </DialogPrimitive.Description>
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
          <Button variant="cancel" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="default" size="sm" disabled={!isValid} onClick={save}>
            {isCreate ? 'Start task' : 'Update in Tasks'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

ScheduleEditModal.displayName = 'ScheduleEditModal'
