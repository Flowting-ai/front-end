import { z } from 'zod'

/**
 * The schedule edit form: its fields, Zod schema, and the pure conversions
 * between the backend's schedule sentence and the form's fields. Used by
 * components/Schedules/ScheduleEditModal.tsx.
 */

export type FrequencyType = 'daily' | 'weekly'
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type DayOfWeek = (typeof DAYS)[number]

export const MAX_NAME_CHARS = 255
export const MAX_INSTRUCTIONS_CHARS = 4_000

export interface ScheduleFormValues extends Record<string, unknown> {
  name: string
  instructions: string
  freqType: FrequencyType
  /** "HH:MM", 24-hour (the native time input's value). */
  time: string
  day: DayOfWeek
  timezone: string
}

export const scheduleFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the schedule a name').max(MAX_NAME_CHARS, `At most ${MAX_NAME_CHARS} characters`),
  instructions: z.string().trim().max(MAX_INSTRUCTIONS_CHARS, `At most ${MAX_INSTRUCTIONS_CHARS} characters`),
  freqType: z.enum(['daily', 'weekly']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time'),
  day: z.enum(DAYS),
  timezone: z.string().min(1),
})

/** The browser's IANA zone, the default selection. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Every IANA zone the runtime knows, with the detected zone first (always present). */
export function timezoneList(detected = detectTimezone()): string[] {
  let zones: string[] = []
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (typeof supported === 'function') zones = supported('timeZone')
  } catch { /* not supported — fall back to detected only */ }
  return zones.includes(detected) ? zones : [detected, ...zones]
}

/** Case-insensitive match on the raw zone id. */
export function filterTimezones(zones: readonly string[], search: string): string[] {
  const q = search.trim().toLowerCase()
  return q ? zones.filter(tz => tz.toLowerCase().includes(q)) : [...zones]
}

export const zoneLabel = (tz: string) => tz.replace(/_/g, ' ')

const pad = (n: number) => String(n).padStart(2, '0')

/** "Daily • 09:00 (Europe/Paris)" / "Weekly • Monday 18:30 (UTC)" — the text sent into the Task prompt. */
export function formatFrequency(type: FrequencyType, hour: number, minute: number, day: DayOfWeek, timezone: string): string {
  const time = `${pad(hour)}:${pad(minute)}`
  const base = type === 'daily' ? `Daily • ${time}` : `Weekly • ${day} ${time}`
  return timezone ? `${base} (${timezone})` : base
}

/** 24-hour → "9:00 AM", for the preview line only. */
export function to12Hour(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${pad(minute)} ${period}`
}

/**
 * Reads the schedule sentence the backend built ("Every day at 9:00 AM
 * (America/Chicago)", "Every Monday at 6:30 PM (UTC)") back into fields.
 * Cadences this form cannot express ("Every 5 minutes") return null, so the
 * form opens on its defaults rather than misstating what is scheduled.
 * Backend gap: structured hour/minute/day in schedule_json would remove this.
 */
export function parseFrequency(freq: string): { type: FrequencyType; hour: number; minute: number; day: DayOfWeek; timezone: string | null } | null {
  const tzMatch = freq.match(/\(([^)]+)\)\s*$/)
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

/** Initial form values for create (no schedule) or edit. */
export function initialFormValues(schedule?: { name: string; instructions: string; frequency: string; timezone?: string }): ScheduleFormValues {
  const parsed = schedule?.frequency ? parseFrequency(schedule.frequency) : null
  return {
    name: schedule?.name ?? '',
    instructions: schedule?.instructions ?? '',
    freqType: parsed?.type ?? 'daily',
    time: parsed ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : '',
    day: parsed?.day ?? 'Monday',
    timezone: parsed?.timezone ?? schedule?.timezone ?? detectTimezone(),
  }
}

/** "Runs every Monday at 6:30 PM · Europe/Paris", or null until the time is valid. */
export function previewText(v: Pick<ScheduleFormValues, 'freqType' | 'time' | 'day' | 'timezone'>): string | null {
  const m = v.time.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const when = to12Hour(Number(m[1]), Number(m[2]))
  return v.freqType === 'daily'
    ? `Runs every day at ${when} · ${zoneLabel(v.timezone)}`
    : `Runs every ${v.day} at ${when} · ${zoneLabel(v.timezone)}`
}

/** The parsed form as the save payload. */
export function toEditData(v: z.infer<typeof scheduleFormSchema>): { name: string; instructions: string; frequency: string; timezone: string } {
  const [h, m] = v.time.split(':').map(Number)
  return { name: v.name, instructions: v.instructions, frequency: formatFrequency(v.freqType, h, m, v.day, v.timezone), timezone: v.timezone }
}
