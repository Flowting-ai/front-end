import { describe, expect, it } from "vitest"
import { findCodeRanges, parseContentSegments } from "./content-parser"
import { parseMetricsXml } from "@/components/chat/XmlMetrics.parse"
import { parseEmailXml, splitSender } from "@/components/chat/XmlEmail.parse"
import { parseFunnelXml } from "@/components/chat/XmlFunnel.parse"
import { parseKanbanXml } from "@/components/chat/XmlKanban.parse"
import { parseScheduleXml } from "@/components/chat/XmlSchedule.parse"
import { parseWeatherXml } from "@/components/chat/XmlWeather.parse"
import { parseMapXml } from "@/components/chat/XmlMap.parse"
import { parseStepsXml } from "@/components/chat/XmlSteps.parse"
import { parseCalloutXml } from "@/components/chat/XmlCallout.parse"
import { parseTagsXml } from "@/components/chat/XmlTags.parse"

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
    const segments = parseContentSegments('Numbers:\n<metrics>\n  <metric label="Orders" value="320"', { streaming: true })
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

const types = (segments: ReturnType<typeof parseContentSegments>) => segments.map((s) => s.type)
const TABLE = "<table><tr><th>A</th></tr><tr><td>1</td></tr></table>"
const CHART = '<chart type="bar"><bar label="Q1" value="2"/></chart>'

describe("parseContentSegments code ranges", () => {
  it("ignores tags inside inline code spans, streaming or final", () => {
    const content = "Wrap data in `<chart>` or ``<table>`` tags.\n\nThe rest of the answer."
    for (const streaming of [true, false]) {
      const segments = parseContentSegments(content, { streaming })
      expect(types(segments)).toEqual(["markdown"])
      expect(segments[0]).toMatchObject({ text: content })
    }
  })

  it("only closes a code span with a backtick run of the same length", () => {
    const segments = parseContentSegments("Use ``a ` <chart>`` here.\n" + TABLE)
    expect(types(segments)).toEqual(["markdown", "table"])
  })

  it("treats an unclosed backtick on the last line as code while streaming only", () => {
    expect(types(parseContentSegments("Use `<chart", { streaming: true }))).toEqual(["markdown"])
    // Once final, a lone backtick is literal and a real block after it still renders.
    expect(types(parseContentSegments("It's ` fine\n" + TABLE))).toEqual(["markdown", "table"])
  })

  it("ignores tags in ~~~ fences and in unclosed fences", () => {
    expect(types(parseContentSegments("~~~xml\n" + TABLE + "\n~~~\ndone"))).toEqual(["markdown"])
    expect(types(parseContentSegments("```xml\n" + TABLE))).toEqual(["markdown"])
    expect(types(parseContentSegments("  ```\n" + TABLE + "\n  ```\n" + TABLE))).toEqual(["markdown", "table"])
  })

  it("treats inline triple backticks as a code span, not a fence", () => {
    expect(types(parseContentSegments("Run ```<chart>``` then\n" + TABLE))).toEqual(["markdown", "table"])
  })
})

describe("parseContentSegments after the stream ends", () => {
  it("never reports pending once final", () => {
    const content = 'Numbers:\n<metrics>\n  <metric label="Orders" value="320"'
    const segments = parseContentSegments(content)
    expect(types(segments)).toEqual(["markdown", "incomplete"])
    expect(segments[1]).toMatchObject({ type: "incomplete", tag: "metrics", xml: content.slice("Numbers:\n".length) })
  })

  it("keeps rendering text after an unclosed block, ending the block at the blank line where prose resumes", () => {
    const content = "Intro\n<table>\n<tr><td>1</td></tr>\n\n<tr><td>2</td></tr>\n\nAfter the table.\n\n" + TABLE
    const segments = parseContentSegments(content)
    expect(types(segments)).toEqual(["markdown", "incomplete", "markdown", "table"])
    expect(segments[1]).toMatchObject({ xml: "<table>\n<tr><td>1</td></tr>\n\n<tr><td>2</td></tr>" })
    expect(segments[2]).toMatchObject({ type: "markdown", text: "\n\nAfter the table.\n\n" })
  })

  it("ends an unclosed block before the next structured block", () => {
    expect(types(parseContentSegments("<table>\n<tr>\n\n" + CHART))).toEqual(["incomplete", "markdown", "chart"])
  })

  it("keeps an unclosed tag mentioned mid-line as literal text", () => {
    const content = "Use the <chart> element for this.\n\nThen:\n" + TABLE
    const segments = parseContentSegments(content)
    expect(types(segments)).toEqual(["markdown", "table"])
    expect(segments[0]).toMatchObject({ text: "Use the <chart> element for this.\n\nThen:\n" })
  })

  it("does not pair a mentioned tag with the closing tag of a later real block, even mid-stream", () => {
    const content = "Use the <table> element for this.\n\nThen:\n" + TABLE
    for (const streaming of [true, false]) {
      const segments = parseContentSegments(content, { streaming })
      expect(types(segments)).toEqual(["markdown", "table"])
      expect(segments[1]).toMatchObject({ xml: TABLE })
    }
    const broken = parseContentSegments("<table>\n<tr><td>1</td>\n" + TABLE, { streaming: true })
    expect(types(broken)).toEqual(["incomplete", "markdown", "table"])
    expect(broken[0]).toMatchObject({ xml: "<table>\n<tr><td>1</td>" })
  })

  it("never swallows the response-interrupted marker into an unclosed block", () => {
    const content = "Here:\n<table>\n<tr><td>1</td>\n[Response interrupted: upstream timeout]"
    for (const streaming of [true, false]) {
      const segments = parseContentSegments(content, { streaming })
      expect(types(segments)).toEqual(["markdown", "incomplete", "markdown"])
      expect(segments[2]).toMatchObject({ text: "\n[Response interrupted: upstream timeout]" })
    }
  })

  it("appends the interrupted marker to trailing markdown", () => {
    const segments = parseContentSegments("Partial answer\n\n[Response interrupted: boom]", { streaming: true })
    expect(segments).toEqual([
      { type: "markdown", text: "Partial answer\n\n[Response interrupted: boom]", start: 0, end: 44 },
    ])
  })
})

describe("parseContentSegments partial tags while streaming", () => {
  it("hides a tag name that is still being typed", () => {
    expect(parseContentSegments("Here it is: <tabl", { streaming: true })).toEqual([
      { type: "markdown", text: "Here it is: ", start: 0, end: 12 },
    ])
    expect(parseContentSegments("Here it is:\n<", { streaming: true })).toEqual([
      { type: "markdown", text: "Here it is:\n", start: 0, end: 12 },
    ])
    expect(types(parseContentSegments("<CH", { streaming: true }))).toEqual([])
  })

  it("shows a complete tag name with no boundary yet as pending", () => {
    expect(parseContentSegments("Here:\n<table", { streaming: true })).toEqual([
      { type: "markdown", text: "Here:\n", start: 0, end: 6 },
      { type: "pending", tag: "table", start: 6, end: 12 },
    ])
  })

  it("keeps non-widget partial tags and final-mode partial tags literal", () => {
    expect(types(parseContentSegments("a <b", { streaming: true }))).toEqual(["markdown"])
    expect(parseContentSegments("x <tabl")).toEqual([{ type: "markdown", text: "x <tabl", start: 0, end: 7 }])
    expect(parseContentSegments("x <table")).toEqual([{ type: "markdown", text: "x <table", start: 0, end: 8 }])
  })
})

describe("parseContentSegments tag case", () => {
  it("recognises uppercase and mixed-case tags with canonical lowercase types", () => {
    const segments = parseContentSegments("<TABLE><TR><TH>A</TH></TR></TABLE>\n<Chart type=\"bar\"><Bar label=\"x\" value=\"1\"/></CHART>")
    expect(types(segments)).toEqual(["table", "markdown", "chart"])
    expect(segments[0]).toMatchObject({ xml: "<table><tr><th>A</th></tr></table>" })
    expect(segments[2]).toMatchObject({ xml: '<chart type="bar"><bar label="x" value="1"/></chart>' })
  })

  it("keeps offsets right when lowercasing would change the string length", () => {
    // "İ".toLowerCase() is two code units; indexes must come from the original.
    const content = "İİİ notes\n<metrics><metric label=\"A\" value=\"1\"/></METRICS>\nend"
    const segments = parseContentSegments(content)
    expect(types(segments)).toEqual(["markdown", "metrics", "markdown"])
    expect(content.slice(segments[1].start, segments[1].end)).toBe('<metrics><metric label="A" value="1"/></METRICS>')
    expect(segments[2]).toMatchObject({ text: "\nend" })
  })

  it("leaves JSX-style names mentioned mid-line as prose, streaming or final", () => {
    expect(types(parseContentSegments("Wrap rows in a <Table> component, then …", { streaming: true }))).toEqual(["markdown"])
    expect(types(parseContentSegments("Wrap rows in <Table> and close with </Table> afterwards."))).toEqual(["markdown"])
    expect(types(parseContentSegments("Wrap rows in a <Tabl", { streaming: true }))).toEqual(["markdown"])
  })

  it("still renders a complete lowercase widget mid-line", () => {
    expect(types(parseContentSegments("Here: " + TABLE + " done"))).toEqual(["markdown", "table", "markdown"])
  })

  it("never holds a mid-line unclosed tag as pending while streaming", () => {
    const segments = parseContentSegments("Use the <table> element and then", { streaming: true })
    expect(segments).toEqual([{ type: "markdown", text: "Use the <table> element and then", start: 0, end: 32 }])
    // A trailing name mid-line is only hidden while typed, never a skeleton.
    expect(parseContentSegments("Use the <table", { streaming: true })).toEqual([
      { type: "markdown", text: "Use the ", start: 0, end: 8 },
    ])
  })
})

describe("parseContentSegments review regressions", () => {
  it("treats a fence behind a list marker as code, so later widgets still render", () => {
    const content =
      "1. Install:\n2. ```bash\n   npm i\n\n   npm run dev\n   ```\n\n<callout>Done</callout>\n\n" + TABLE
    expect(types(parseContentSegments(content))).toEqual(["markdown", "callout", "markdown", "table"])
    expect(types(parseContentSegments("> ```xml\n> " + TABLE + "\n> ```\n" + CHART))).toEqual(["markdown", "chart"])
  })

  it("ignores a same-type opening inside inline code when deciding whether a block closes", () => {
    const content = "<steps>\n<step>Write `<steps>` first</step>\n</steps>\nThen continue"
    const segments = parseContentSegments(content)
    expect(types(segments)).toEqual(["steps", "markdown"])
    expect(segments[1]).toMatchObject({ text: "\nThen continue" })
    // A line-start opening inside a fence in the block's body doesn't count either.
    expect(types(parseContentSegments("<callout>\nExample:\n```\n<callout>\n```\n</callout>\nafter"))).toEqual(["callout", "markdown"])
  })

  it("does not pair a stray backtick in prose with one inside the next widget", () => {
    const segments = parseContentSegments("Height 5`\n<callout>use `x` now</callout>\nend")
    expect(types(segments)).toEqual(["markdown", "callout", "markdown"])
  })
})

describe("findCodeRanges", () => {
  it("returns fences (closed, unclosed, ~~~, behind list markers) and inline spans", () => {
    const content = "a `b` c\n- ~~~\n  x\n  ~~~\nd \\`e` ``f``\n```\nopen"
    const ranges = findCodeRanges(content).map(([s, e]) => content.slice(s, e))
    expect(ranges).toEqual(["`b`", "- ~~~\n  x\n  ~~~", "``f``", "```\nopen"])
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
      '<map metric="Orders"><point lat="37.77" lng="-122.42" value="10" label="SF"/></map>',
      '<steps><step label="Open Settings"/></steps>',
      '<callout variant="warning">Watch out</callout>',
      '<tags><tag label="Growth"/></tags>',
    ].join("\ntext\n")
    const types = parseContentSegments(content).map((s) => s.type)
    expect(types).toEqual([
      "email", "markdown", "funnel", "markdown", "kanban", "markdown", "schedule", "markdown", "weather", "markdown", "map",
      "markdown", "steps", "markdown", "callout", "markdown", "tags",
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

  it("parses steps with optional descriptions and drops unlabelled ones", () => {
    const steps = parseStepsXml(
      '<steps title="Connecting Notion">' +
      '<step label="Open Settings → Connectors" description="Tap your avatar, then Settings."/>' +
      '<step description="orphaned detail with no label"/>' +
      '<step label="Run a test sync"/>' +
      "</steps>",
    )
    expect(steps).toEqual({
      title: "Connecting Notion",
      steps: [
        { label: "Open Settings → Connectors", description: "Tap your avatar, then Settings." },
        { label: "Run a test sync", description: undefined },
      ],
    })
    expect(parseStepsXml("<steps></steps>")).toBeNull()
  })

  it("parses a callout body as unescaped markdown and keeps the variant", () => {
    const callout = parseCalloutXml(
      '<callout variant="warning" title="May 11 is the deadline">\n' +
      "  Anything not specced by **Apr 30** risks the date &amp; the launch.\n" +
      "</callout>",
    )
    expect(callout).toEqual({
      variant: "warning",
      title: "May 11 is the deadline",
      body: "Anything not specced by **Apr 30** risks the date & the launch.",
    })
  })

  it("falls back to info for an unknown or missing callout variant", () => {
    expect(parseCalloutXml('<callout variant="WARNING">x</callout>')!.variant).toBe("warning")
    expect(parseCalloutXml('<callout variant="danger">x</callout>')!.variant).toBe("info")
    expect(parseCalloutXml("<callout>x</callout>")!.variant).toBe("info")
    expect(parseCalloutXml('<callout variant="tip">   </callout>')).toBeNull()
  })

  it("parses tags with optional colors and drops unlabelled ones", () => {
    const tags = parseTagsXml(
      '<tags title="Risk categories">' +
      '<tag label="DS handoff timing" color="#C8920A"/>' +
      '<tag label="Revamp scope creep"/>' +
      '<tag color="#0D6EB2"/>' +
      "</tags>",
    )
    expect(tags).toEqual({
      title: "Risk categories",
      tags: [
        { label: "DS handoff timing", color: "#C8920A" },
        { label: "Revamp scope creep", color: undefined },
      ],
    })
    expect(parseTagsXml("<tags></tags>")).toBeNull()
  })
})

describe("parseMapXml", () => {
  it("parses static points, optional groups, and display metadata", () => {
    const map = parseMapXml(
      '<map title="Orders by market" metric="Orders" unit="$">' +
      '<group code="TX" value="1320000" label="Texas"/>' +
      '<point id="dallas" lat="32.7767" lng="-96.797" value="4200" label="Dallas &amp; Fort Worth" group="TX"/>' +
      '<point lat="39.7392" lng="-104.9903" value="3800" label="Denver" code="CO"/>' +
      '</map>',
    )

    expect(map).toEqual({
      title: "Orders by market",
      metric: "Orders",
      unit: "$",
      groups: [{ key: "TX", label: "Texas", value: 1320000 }],
      points: [
        { id: "dallas", lat: 32.7767, lng: -96.797, value: 4200, label: "Dallas & Fort Worth", group: "TX", code: undefined },
        { id: "map-point-1", lat: 39.7392, lng: -104.9903, value: 3800, label: "Denver", group: "CO", code: "CO" },
      ],
    })
  })

  it("drops malformed coordinates and returns null without plottable points", () => {
    expect(parseMapXml('<map><point lat="91" lng="0" value="10"/></map>')).toBeNull()
    expect(parseMapXml('<map><point code="US" value="10"/></map>')).toBeNull()
  })
})
