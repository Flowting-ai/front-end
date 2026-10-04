import { describe, expect, it } from "vitest"
import { normalizeScheduleDate, parseScheduleXml, scheduleMonthCells } from "./XmlSchedule.parse"

describe("schedule calendar dates", () => {
  it("accepts leap days and rejects impossible or ambiguous dates", () => {
    expect(normalizeScheduleDate("2024-02-29")).toBe("2024-02-29")
    for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "Mon, Jul 20", "2026-1-01"]) {
      expect(normalizeScheduleDate(date)).toBeUndefined()
    }
  })

  it("groups by explicit dates while preserving undated legacy events", () => {
    const schedule = parseScheduleXml(`<schedule date="2026-10-05">
      <event date="2026-10-05" day="Monday" title="Standup"/>
      <event day="2026-10-05" title="Review"/>
      <event day="Tuesday" title="Legacy"/>
      <event date="2026-02-29" day="Unknown" title="Invalid date"/>
    </schedule>`)
    expect(schedule?.date).toBe("2026-10-05")
    expect(schedule?.days).toHaveLength(3)
    expect(schedule?.days[0].events.map(event => event.title)).toEqual(["Standup", "Review"])
    expect(schedule?.days[1].date).toBeUndefined()
    expect(schedule?.days[2].date).toBeUndefined()
  })

  it("builds a Monday-first grid through year and leap-month boundaries", () => {
    const january = scheduleMonthCells("2027-01-15")
    expect(january).toHaveLength(42)
    expect(january[0]).toBe("2026-12-28")
    expect(january[41]).toBe("2027-02-07")
    expect(scheduleMonthCells("2024-02-01")).toContain("2024-02-29")
    expect(scheduleMonthCells("2026-06-15")[0]).toBe("2026-06-01")
  })
})
