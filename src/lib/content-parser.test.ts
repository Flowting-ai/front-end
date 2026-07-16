import { describe, expect, it } from "vitest"
import { parseContentSegments } from "./content-parser"
import { parseMetricsXml } from "@/components/chat/XmlMetrics"
import { parseEmailXml, splitSender } from "@/components/chat/XmlEmail"
import { parseFunnelXml } from "@/components/chat/XmlFunnel"
import { parseKanbanXml } from "@/components/chat/XmlKanban"
import { parseScheduleXml } from "@/components/chat/XmlSchedule"
import { parseWeatherXml } from "@/components/chat/XmlWeather"

describe("parseContentSegments structured tags", () => {
  it("splits a complete <metrics> block out of surrounding markdown", () => {
    const content = [
      "Here are this week's numbers:",
      "",
      '<metrics>',
      '  <metric label="Revenue" value="$12,400" delta="+8%"/>',
      "</metrics>",
      "",
      "Revenue is trending up.",
    ].join("\n")

    const segments = parseContentSegments(content)
    expect(segments.map((s) => s.type)).toEqual(["markdown", "metrics", "markdown"])
    const metrics = segments[1]
    expect(metrics.type === "metrics" && metrics.xml).toContain('label="Revenue"')
  })

  it("marks an unclosed <metrics> block as pending while streaming", () => {
    const segments = parseContentSegments('Numbers:\n<metrics>\n  <metric label="Orders" value="320"')
    expect(segments.map((s) => s.type)).toEqual(["markdown", "pending"])
    expect(segments[1]).toMatchObject({ type: "pending", tag: "metrics" })
  })

  it("leaves <metrics> examples inside code fences as markdown", () => {
    const content = "Example:\n```xml\n<metrics>\n  <metric label=\"A\" value=\"1\"/>\n</metrics>\n```\ndone"
    const segments = parseContentSegments(content)
    expect(segments.every((s) => s.type === "markdown")).toBe(true)
  })

  it("keeps ordering across mixed chart and metrics blocks", () => {
    const content =
      '<metrics><metric label="A" value="1"/></metrics>\n' +
      'between\n' +
      '<chart type="bar" title="T"><bar label="Q1" value="2"/></chart>'
    const segments = parseContentSegments(content)
    expect(segments.map((s) => s.type)).toEqual(["metrics", "markdown", "chart"])
  })

  it("does not treat a longer tag name as a structured tag", () => {
    const segments = parseContentSegments("<chartreuse> is a colour, <metricsystem> a unit system")
    expect(segments.every((s) => s.type === "markdown")).toBe(true)
  })
})

describe("parseMetricsXml", () => {
  it("parses attributes and infers trend from the delta sign", () => {
    const metrics = parseMetricsXml(
      '<metrics>\n' +
      '  <metric label="Revenue" value="$12,400" delta="+8%" sub="vs. last week"/>\n' +
      '  <metric label="Orders" value="320" delta="-3%"/>\n' +
      '  <metric label="AOV" value="$38.75" delta="-2%" trend="up"/>\n' +
      "</metrics>",
    )
    expect(metrics).toEqual([
      { label: "Revenue", value: "$12,400", delta: "+8%", trend: "up", sub: "vs. last week" },
      { label: "Orders", value: "320", delta: "-3%", trend: "down", sub: undefined },
      { label: "AOV", value: "$38.75", delta: "-2%", trend: "up", sub: undefined },
    ])
  })

  it("skips metrics missing a label or value and unescapes entities", () => {
    const metrics = parseMetricsXml(
      '<metrics>\n' +
      '  <metric label="Kept" value="&lt;1s &amp; falling"/>\n' +
      '  <metric label="No value"/>\n' +
      '  <metric value="42"/>\n' +
      "</metrics>",
    )
    expect(metrics).toEqual([{ label: "Kept", value: "<1s & falling", delta: undefined, trend: "up", sub: undefined }])
  })

  it("returns empty for prose with no metric tags", () => {
    expect(parseMetricsXml("<metrics>nothing here</metrics>")).toEqual([])
  })

  it("parses spark series and drops sparks with fewer than 2 valid points", () => {
    const metrics = parseMetricsXml(
      '<metrics>' +
      '<metric label="A" value="1" spark="9800, 10400,9900 11200"/>' +
      '<metric label="B" value="2" spark="42"/>' +
      '<metric label="C" value="3" spark="not,numbers"/>' +
      "</metrics>",
    )
    expect(metrics[0].spark).toEqual([9800, 10400, 9900, 11200])
    expect(metrics[1].spark).toBeUndefined()
    expect(metrics[2].spark).toBeUndefined()
  })
})

describe("widget block parsers", () => {
  it("segments every widget tag type", () => {
    const content = [
      '<email subject="Hi">body</email>',
      '<funnel><stage label="A" value="10"/></funnel>',
      '<kanban><column label="Todo"><card title="T"/></column></kanban>',
      '<schedule><event day="Mon" title="Standup"/></schedule>',
      '<weather location="SF"><current temp="18"/></weather>',
    ].join("\ntext\n")
    const types = parseContentSegments(content).map((s) => s.type)
    expect(types).toEqual([
      "email", "markdown", "funnel", "markdown", "kanban", "markdown", "schedule", "markdown", "weather",
    ])
  })

  it("parses an email with attachments, body markdown, and status default", () => {
    const email = parseEmailXml(
      '<email from="Kai (kai@acme.com)" to="you@store.com" date="Jul 15" subject="Q3 numbers">\n' +
      '  <attachment name="report.pdf" size="1.2 MB"/>\n' +
      "  Revenue was **up 8%** &amp; costs flat.\n" +
      "</email>",
    )
    expect(email).toMatchObject({
      status: "received",
      subject: "Q3 numbers",
      from: "Kai (kai@acme.com)",
      attachments: [{ name: "report.pdf", size: "1.2 MB" }],
    })
    expect(email!.body).toBe("Revenue was **up 8%** & costs flat.")
  })

  it("recognizes draft and sent email statuses; rejects empty emails", () => {
    expect(parseEmailXml('<email status="draft" subject="S">x</email>')!.status).toBe("draft")
    expect(parseEmailXml('<email status="sent" subject="S">x</email>')!.status).toBe("sent")
    expect(parseEmailXml("<email></email>")).toBeNull()
  })

  it("carries bcc through and splits sender name/address variants", () => {
    const email = parseEmailXml('<email subject="S" bcc="archive@acme.com">x</email>')
    expect(email!.bcc).toBe("archive@acme.com")
    expect(splitSender("Kai Rivera (kai@acme.com)")).toEqual({ name: "Kai Rivera", address: "kai@acme.com" })
    expect(splitSender("Kai <kai@acme.com>")).toEqual({ name: "Kai", address: "kai@acme.com" })
    expect(splitSender("kai@acme.com")).toEqual({ name: "", address: "kai@acme.com" })
    expect(splitSender("Just A Name")).toEqual({ name: "Just A Name", address: "" })
    expect(splitSender(undefined)).toEqual({ name: "", address: "" })
  })

  it("parses funnel stages and drops non-numeric values", () => {
    const funnel = parseFunnelXml(
      '<funnel title="Checkout"><stage label="Visited" value="12400"/>' +
      '<stage label="Bad" value="lots"/><stage label="Bought" value="980"/></funnel>',
    )
    expect(funnel).toEqual({
      title: "Checkout",
      stages: [
        { label: "Visited", value: 12400 },
        { label: "Bought", value: 980 },
      ],
    })
    expect(parseFunnelXml("<funnel></funnel>")).toBeNull()
  })

  it("parses kanban columns with nested cards", () => {
    const kanban = parseKanbanXml(
      '<kanban title="Sprint"><column label="To do">' +
      '<card title="Fix login" sub="Alice" tag="High"/><card title="Docs"/></column>' +
      '<column label="Done"></column></kanban>',
    )
    expect(kanban!.columns).toHaveLength(2)
    expect(kanban!.columns[0].cards).toEqual([
      { title: "Fix login", sub: "Alice", tag: "High" },
      { title: "Docs", sub: undefined, tag: undefined },
    ])
    expect(kanban!.columns[1].cards).toEqual([])
  })

  it("groups schedule events by day in first-appearance order", () => {
    const schedule = parseScheduleXml(
      "<schedule>" +
      '<event day="Mon" time="9:00" title="Standup"/>' +
      '<event day="Tue" time="11:00" title="Call"/>' +
      '<event day="Mon" time="14:00" title="Review"/>' +
      "</schedule>",
    )
    expect(schedule!.days.map((d) => d.day)).toEqual(["Mon", "Tue"])
    expect(schedule!.days[0].events.map((e) => e.title)).toEqual(["Standup", "Review"])
  })

  it("parses weather current + days and rejects empty blocks", () => {
    const weather = parseWeatherXml(
      '<weather location="SF" unit="°C">' +
      '<current temp="18" condition="partly-cloudy" high="21" low="14" humidity="72%" wind="14 km/h"/>' +
      '<day label="Wed" high="21" low="14" condition="sunny"/>' +
      "</weather>",
    )
    expect(weather!.current).toMatchObject({ temp: "18", condition: "partly-cloudy" })
    expect(weather!.days).toEqual([{ label: "Wed", high: "21", low: "14", condition: "sunny" }])
    expect(parseWeatherXml("<weather location='SF'></weather>")).toBeNull()
  })
})
