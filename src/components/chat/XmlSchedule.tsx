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
import { m, useReducedMotion } from "framer-motion"
import { CalendarDays, Clock3, MapPin } from "lucide-react"
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
  const reduceMotion = Boolean(useReducedMotion())
  if (!schedule) return null

  const accents = ["#496E8B", "#6D5C91", "#287A47", "#A28847"]
  const eventCount = schedule.days.reduce((total, day) => total + day.events.length, 0)

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: "14px 0",
        padding: "15px 15px 14px",
        borderRadius: 18,
        border: "1px solid rgba(73, 110, 139, 0.15)",
        background: "linear-gradient(135deg, #EFF5F8 0%, #FFFEFC 52%, #F2ECE8 100%)",
        boxShadow: "0 10px 28px rgba(82, 75, 71, 0.09), 0 2px 4px rgba(82, 75, 71, 0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            borderRadius: 11,
            color: "#496E8B",
            backgroundColor: "rgba(222, 235, 244, 0.78)",
            border: "1px solid rgba(73, 110, 139, 0.17)",
          }}
        >
          <CalendarDays size={17} strokeWidth={1.8} />
        </m.span>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-500)" }}>Agenda</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-body)", fontWeight: "var(--font-weight-semibold)", color: "var(--neutral-950)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {schedule.title || "Schedule"}
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.65)", border: "1px solid rgba(82,75,71,0.10)", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-500)" }}>
          <Clock3 size={12} />
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {schedule.days.map((group, gi) => {
          const accent = accents[gi % accents.length]!
          return (
          <m.div
            key={`${group.day}-${gi}`}
            initial={reduceMotion ? false : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : gi * 0.08, duration: 0.28 }}
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
          >
            {group.day && (
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  fontWeight: "var(--font-weight-medium)",
                  color: accent,
                  backgroundColor: `${accent}12`,
                  border: `1px solid ${accent}1F`,
                }}
              >
                {group.day}
              </span>
            )}
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
            {group.events.map((event, i) => (
              <m.div
                key={`${event.title}-${i}`}
                initial={reduceMotion ? false : { opacity: 0, x: -7 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={reduceMotion ? undefined : { x: 2 }}
                transition={{ delay: reduceMotion ? 0 : gi * 0.07 + i * 0.045, duration: 0.24 }}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "minmax(68px, 88px) 14px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    justifySelf: "stretch",
                    padding: "5px 6px",
                    borderRadius: 8,
                    textAlign: "center",
                    fontFamily: "var(--font-code)",
                    fontSize: 10,
                    lineHeight: "14px",
                    color: accent,
                    backgroundColor: "rgba(255,255,255,0.65)",
                    border: `1px solid ${accent}1A`,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {event.time ?? "Any time"}
                </span>
                <span aria-hidden style={{ position: "relative", width: 10, height: 10, borderRadius: "50%", backgroundColor: accent, boxShadow: `0 0 0 4px ${accent}16`, zIndex: 1 }}>
                  {i < group.events.length - 1 && <span style={{ position: "absolute", left: 4, top: 10, width: 2, height: 50, backgroundColor: `${accent}20` }} />}
                </span>
                <div style={{ minWidth: 0, padding: "8px 10px", borderRadius: 11, backgroundColor: "rgba(255,255,255,0.72)", border: "1px solid rgba(82,75,71,0.09)", boxShadow: "0 2px 5px rgba(82,75,71,0.05)" }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", lineHeight: "18px", fontWeight: "var(--font-weight-medium)", color: "var(--neutral-800)", overflowWrap: "anywhere" }}>
                    {event.title}
                  </div>
                  {event.sub && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontFamily: "var(--font-body)", fontSize: 11, lineHeight: "15px", color: "var(--neutral-400)", overflow: "hidden" }}>
                      <MapPin size={11} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.sub}</span>
                    </div>
                  )}
                </div>
              </m.div>
            ))}
            </div>
          </m.div>
        )})}
      </div>
    </m.div>
  )
}
