import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { dirtyFields, validateForm } from '@/lib/forms/zod-form'
import { formatNextRun } from './schedule-mappers'
import { canSchedule } from './schedule-permissions'
import { filterTimezones, formatFrequency, initialFormValues, parseFrequency, previewText, scheduleFormSchema, toEditData } from './schedule-form'
import { schedulePrompt } from '@/app/(app)/schedules/use-schedules'

describe('schedule form', () => {
  it('round-trips the backend sentence into fields', () => {
    expect(parseFrequency('Every day at 9:00 AM (America/Chicago)')).toEqual({ type: 'daily', hour: 9, minute: 0, day: 'Monday', timezone: 'America/Chicago' })
    expect(parseFrequency('Every Friday at 12:30 PM (UTC)')).toMatchObject({ type: 'weekly', hour: 12, minute: 30, day: 'Friday' })
    expect(parseFrequency('Every day at 12:05 AM')).toMatchObject({ hour: 0, minute: 5, timezone: null })
    expect(parseFrequency('Every 5 minutes')).toBeNull()
  })

  it('opens on defaults for a cadence the form cannot express', () => {
    const v = initialFormValues({ name: 'n', instructions: '', frequency: 'Every 5 minutes', timezone: 'Europe/Paris' })
    expect(v).toMatchObject({ freqType: 'daily', time: '', timezone: 'Europe/Paris' })
  })

  it('validates name and time, and builds the Task payload', () => {
    const base = { name: ' Digest ', instructions: 'x', freqType: 'weekly', time: '18:30', day: 'Monday', timezone: 'UTC' }
    const ok = validateForm(scheduleFormSchema, base)
    expect(ok.errors).toEqual({})
    expect(toEditData(ok.data!)).toEqual({ name: 'Digest', instructions: 'x', frequency: 'Weekly • Monday 18:30 (UTC)', timezone: 'UTC' })
    expect(validateForm(scheduleFormSchema, { ...base, name: '  ', time: '25:00' }).errors).toEqual({ name: 'Give the schedule a name', time: 'Pick a time' })
  })

  it('previews in 12-hour time and formats the frequency', () => {
    expect(previewText({ freqType: 'daily', time: '00:15', day: 'Monday', timezone: 'America/New_York' })).toBe('Runs every day at 12:15 AM · America/New York')
    expect(previewText({ freqType: 'daily', time: '', day: 'Monday', timezone: 'UTC' })).toBeNull()
    expect(formatFrequency('daily', 7, 5, 'Monday', '')).toBe('Daily • 07:05')
  })

  it('filters timezones case-insensitively', () => {
    expect(filterTimezones(['Europe/Paris', 'America/New_York'], 'new')).toEqual(['America/New_York'])
  })
})

describe('zod form core', () => {
  it('reports the first message per field and dirty fields', () => {
    const schema = z.object({ a: z.string().min(1, 'A'), b: z.number() })
    expect(validateForm(schema, { a: '', b: 'x' }).errors).toMatchObject({ a: 'A' })
    expect(dirtyFields({ a: '1', tags: ['x'] }, { a: '1', tags: ['x', 'y'] })).toEqual(['tags'])
  })
})

describe('schedule permissions and prompt', () => {
  it('owner can change; org rows are read and copy only', () => {
    expect(canSchedule('edit', { ownerName: null })).toBe(true)
    expect(canSchedule('copy', { ownerName: null })).toBe(false)
    expect(canSchedule('run', { ownerName: 'Sam' })).toBe(false)
    expect(canSchedule('copy', { ownerName: 'Sam' })).toBe(true)
  })

  it('writes the create and update prompts', () => {
    const data = { name: 'Digest', instructions: 'Summarise', frequency: 'Daily • 09:00 (UTC)', timezone: 'UTC' }
    expect(schedulePrompt(data, false)).toContain('I want to create a schedule called "Digest".')
    expect(schedulePrompt(data, true)).toContain('Updated frequency: Daily • 09:00 (UTC)')
  })
})

describe('next-run display across DST (America/New_York)', () => {
  const prev = process.env.TZ
  beforeAll(() => { process.env.TZ = 'America/New_York' })
  afterAll(() => { process.env.TZ = prev })

  it('says Tomorrow over the spring-forward night (23 h day)', () => {
    const now = new Date('2026-03-07T23:00:00-05:00')
    expect(formatNextRun('2026-03-08T09:00:00-04:00', now)).toBe('Tomorrow · 9:00 AM')
  })

  it('says Tomorrow over the fall-back night (25 h day) and keeps the wall-clock time', () => {
    const now = new Date('2026-10-31T22:00:00-04:00')
    expect(formatNextRun('2026-11-01T09:00:00-05:00', now)).toBe('Tomorrow · 9:00 AM')
    expect(formatNextRun('2026-11-02T09:00:00-05:00', now)).toBe('Mon, Nov 2 · 9:00 AM')
  })
})
