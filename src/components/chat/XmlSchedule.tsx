"use client"

import React, { useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/Button"
import { IconButton } from "@/components/IconButton"
import { Badge } from "@/components/Badge"
import { parseScheduleXml, scheduleMonthCells, type ParsedSchedule } from "./XmlSchedule.parse"
import { ChatWidgetShell } from "./ChatWidgetShell"
import styles from "./ChatWidget.module.css"

function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
}

function Agenda({ groups }: { groups: ParsedSchedule["days"] }) {
  return <>{groups.map((group, index) => <div className={styles.agenda} key={`${group.date || group.day}-${index}`}>
    {group.day && <h4 className={styles.title}>{group.date ? formatDate(group.date, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : group.day}</h4>}
    <ul className={styles.events}>{group.events.map((event, eventIndex) => <li className={styles.event} key={`${event.title}-${eventIndex}`}>
      <span className={styles.time}>{event.time || "Any time"}</span>
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}><div className={styles.title}>{event.title}</div>{event.sub && <div className={styles.caption}>{event.sub}</div>}</div>
    </li>)}</ul>
  </div>)}</>
}

function ScheduleContent({ schedule }: { schedule: ParsedSchedule }) {
  const firstDate = schedule.date || schedule.days.find(group => group.date)?.date
  const [view, setView] = useState<"month" | "agenda">(firstDate ? "month" : "agenda")
  const [selected, setSelected] = useState(firstDate || "")
  const [month, setMonth] = useState(firstDate || "")
  const eventCount = schedule.days.reduce((count, group) => count + group.events.length, 0)
  const datedDays = new Map(schedule.days.filter(group => group.date).map(group => [group.date!, group]))
  const undated = schedule.days.filter(group => !group.date)
  const selectedGroup = datedDays.get(selected)

  function changeMonth(offset: number) {
    const date = new Date(`${month.slice(0, 7)}-01T12:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + offset)
    const next = date.toISOString().slice(0, 10)
    setMonth(next)
    setSelected(next)
  }

  return <ChatWidgetShell title={schedule.title || "Schedule"} eyebrow="Calendar" icon={<CalendarDays size={18} />} actions={<Badge color="Neutral" label={`${eventCount} ${eventCount === 1 ? "event" : "events"}`} />}>
    {firstDate && <div className={styles.toolbar}>
      <div role="group" aria-label="Calendar view" style={{ display: "flex", gap: 6 }}>
        <Button type="button" variant={view === "month" ? "secondary" : "ghost"} size="sm" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</Button>
        <Button type="button" variant={view === "agenda" ? "secondary" : "ghost"} size="sm" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}>Agenda</Button>
      </div>
      {view === "month" && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton type="button" variant="ghost" size="sm" aria-label="Previous month" onClick={() => changeMonth(-1)} icon={<ChevronLeft size={16} />} />
        <span aria-live="polite" className={styles.title}>{formatDate(month, { month: "long", year: "numeric" })}</span>
        <IconButton type="button" variant="ghost" size="sm" aria-label="Next month" onClick={() => changeMonth(1)} icon={<ChevronRight size={16} />} />
      </div>}
    </div>}
    {view === "month" && firstDate ? <>
      <div className={styles.calendar}>
        <div className={`${styles.weekdays} ${styles.caption}`} aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.dates} role="group" aria-label="Choose a date">
          {scheduleMonthCells(month).map(date => {
            const count = datedDays.get(date)?.events.length || 0
            return <button type="button" key={date} className={`${styles.date} ${date.slice(0, 7) !== month.slice(0, 7) ? styles.muted : ""}`} aria-pressed={selected === date}
              aria-label={`${formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}, ${count} ${count === 1 ? "event" : "events"}`} onClick={() => { setSelected(date); setMonth(date) }}>
              <span>{Number(date.slice(8))}</span>{count > 0 && <span className={styles.dot} aria-hidden="true" />}
            </button>
          })}
        </div>
      </div>
      {selectedGroup ? <Agenda groups={[selectedGroup]} /> : <div className={styles.agenda}><h4 className={styles.title}>{formatDate(selected, { month: "short", day: "numeric", year: "numeric" })}</h4><p className={styles.caption}>No events provided for this date.</p></div>}
      {undated.length > 0 && <><div className={styles.agenda}><span className={styles.caption}>Events without a calendar date</span></div><Agenda groups={undated} /></>}
    </> : <Agenda groups={schedule.days} />}
  </ChatWidgetShell>
}

export function XmlSchedule({ xml }: { xml: string }) {
  const schedule = React.useMemo(() => parseScheduleXml(xml), [xml])
  return schedule ? <ScheduleContent key={xml} schedule={schedule} /> : null
}
