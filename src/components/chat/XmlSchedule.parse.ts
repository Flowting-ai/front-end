/**
 * XmlSchedule.parse.ts
 *
 * Pure parsing for the <schedule> XML block, split out from XmlSchedule.tsx
 * so that file only exports the component (Fast Refresh can't safely
 * preserve component state in a file that also exports non-component
 * values).
 */

import { scanTags } from "@/lib/xml-widgets"

export interface ParsedSchedule {
  title?: string
  date?: string
  days: Array<{
    day: string
    date?: string
    events: Array<{ time?: string; title: string; sub?: string }>
  }>
}

export function parseScheduleXml(xml: string): ParsedSchedule | null {
  const [schedule] = scanTags(xml, "schedule")
  if (!schedule) return null

  const days: ParsedSchedule["days"] = []
  const byDay = new Map<string, ParsedSchedule["days"][number]>()
  for (const { attrs } of scanTags(schedule.inner, "event")) {
    if (!attrs.title) continue
    const date = normalizeScheduleDate(attrs.date || attrs.day)
    const day = attrs.day || date || ""
    const key = date || day
    let group = byDay.get(key)
    if (!group) {
      group = { day, date, events: [] }
      byDay.set(key, group)
      days.push(group)
    }
    group.events.push({ time: attrs.time, title: attrs.title, sub: attrs.sub })
  }
  if (days.length === 0) return null
  return { title: schedule.attrs.title, date: normalizeScheduleDate(schedule.attrs.date), days }
}

/** Calendar placement requires a complete ISO date; never guess a year. */
export function normalizeScheduleDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined
}

/** UTC date arithmetic keeps calendar dates stable across viewer time zones. */
export function scheduleMonthCells(date: string): string[] {
  const first = new Date(`${date.slice(0, 7)}-01T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  first.setUTCDate(1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(first)
    cell.setUTCDate(first.getUTCDate() + index)
    return cell.toISOString().slice(0, 10)
  })
}
