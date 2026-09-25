/**
 * XmlMetrics.parse.ts
 *
 * Pure parsing for the <metrics> XML block, split out from XmlMetrics.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

import { scanTags } from "@/lib/xml-widgets"
import type { DeltaTrend } from "@/components/DeltaPill"

export interface ParsedMetric {
  label: string
  value: string
  delta?: string
  trend: DeltaTrend
  sub?: string
  spark?: number[]
}

export function parseMetricsXml(xml: string): ParsedMetric[] {
  const metrics: ParsedMetric[] = []
  for (const { attrs } of scanTags(xml, "metric")) {
    const { label, value, delta, sub } = attrs
    if (!label || !value) continue
    const trendAttr = (attrs.trend ?? "").toLowerCase()
    const trend: DeltaTrend =
      trendAttr === "down" ? "down" :
      trendAttr === "up"   ? "up"   :
      delta?.trim().startsWith("-") ? "down" : "up"
    const spark = (attrs.spark ?? "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite)
    metrics.push({ label, value, delta, trend, sub, spark: spark.length >= 2 ? spark : undefined })
  }
  return metrics
}
