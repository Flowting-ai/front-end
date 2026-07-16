"use client"

/**
 * XmlSchedule.tsx
 *
 * Renders a <schedule>...</schedule> XML block from the assistant as an
 * agenda strip — events grouped by day in order of first appearance:
 *
 *   <schedule title="This week">
 *     <event day="Mon, Jul 20" time="9:00–9:30" title="Standup" sub="Zoom"/>
 *     <event day="Mon, Jul 20" time="14:00–15:00" title="Roadmap review"/>
 *     <event day="Tue, Jul 21" time="11:00–11:45" title="Customer call" sub="Acme Corp"/>
 *   </schedule>
 *
 * See: docs/frontend-rendering.md - Schedule section.
 */

import React from "react"
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

export function XmlSchedule({ xml }: { xml: string }) {
  const schedule = React.useMemo(() => parseScheduleXml(xml), [xml])
  if (!schedule) return null

  return (
    <div
      style={{
        margin:          "12px 0",
        padding:         "14px 16px",
        borderRadius:    12,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
      }}
    >
      {schedule.title && (
        <div
          style={{
            marginBottom: 10,
            fontFamily:   "var(--font-body)",
            fontSize:     "var(--font-size-body)",
            fontWeight:   500,
            color:        "var(--neutral-900)",
          }}
        >
          {schedule.title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {schedule.days.map((group, gi) => (
          <div key={`${group.day}-${gi}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.day && (
              <span
                style={{
                  fontFamily:    "var(--font-body)",
                  fontSize:      "var(--font-size-caption)",
                  fontWeight:    500,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color:         "var(--neutral-400)",
                }}
              >
                {group.day}
              </span>
            )}
            {group.events.map((event, i) => (
              <div
                key={`${event.title}-${i}`}
                style={{
                  display:    "flex",
                  alignItems: "baseline",
                  gap:        10,
                  padding:    "6px 0",
                  borderTop:  i > 0 ? "1px solid var(--neutral-100)" : "none",
                }}
              >
                <span
                  style={{
                    width:      110,
                    flexShrink: 0,
                    fontFamily: "var(--font-code)",
                    fontSize:   "var(--font-size-caption)",
                    color:      "var(--neutral-500)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {event.time ?? ""}
                </span>
                <span style={{ flex: "1 1 0", fontFamily: "var(--font-body)", fontSize: "var(--font-size-body)", color: "var(--neutral-800)", minWidth: 0 }}>
                  {event.title}
                </span>
                {event.sub && (
                  <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
                    {event.sub}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
