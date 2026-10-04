import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { XmlSchedule } from "./XmlSchedule"

describe("schedule rendering", () => {
  it("shows a real calendar and selected events for dated payloads", () => {
    const html = renderToStaticMarkup(<XmlSchedule xml={'<schedule title="Team calendar"><event date="2026-10-05" time="09:00" title="Standup"/></schedule>'} />)
    expect(html).toContain("October 2026")
    expect(html).toContain("Previous month")
    expect(html).toContain("Monday, October 5, 2026, 1 event")
    expect(html).toContain("Standup")
    expect(html).toContain("09:00")
  })

  it("keeps ambiguous days in an agenda without guessing a date", () => {
    const html = renderToStaticMarkup(<XmlSchedule xml={'<schedule><event day="Monday" title="Legacy event"/></schedule>'} />)
    expect(html).toContain("Monday")
    expect(html).toContain("Legacy event")
    expect(html).not.toContain("Previous month")
  })

  it("keeps undated events visible alongside the calendar", () => {
    const html = renderToStaticMarkup(<XmlSchedule xml={'<schedule><event date="2026-10-05" title="Dated event"/><event day="Next week" title="Undated event"/></schedule>'} />)
    expect(html).toContain("Dated event")
    expect(html).toContain("Undated event")
  })
})
