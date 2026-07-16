import { describe, expect, it } from "vitest"
import { parseContentSegments } from "./content-parser"
import { parseMetricsXml } from "@/components/chat/XmlMetrics"

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
})
