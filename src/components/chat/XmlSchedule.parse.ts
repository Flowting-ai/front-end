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
  days: Array<{
    day: string
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
    const day = attrs.day || ""
    let group = byDay.get(day)
    if (!group) {
      group = { day, events: [] }
      byDay.set(day, group)
      days.push(group)
    }
    group.events.push({ time: attrs.time, title: attrs.title, sub: attrs.sub })
  }
  if (days.length === 0) return null
  return { title: schedule.attrs.title, days }
}
