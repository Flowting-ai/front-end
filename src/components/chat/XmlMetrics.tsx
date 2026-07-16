"use client"

/**
 * XmlMetrics.tsx
 *
 * Renders a <metrics>...</metrics> XML block from the assistant as a
 * responsive row of KPI stat tiles:
 *
 *   <metrics>
 *     <metric label="Revenue" value="$12,400" delta="+8%" trend="up" sub="vs. last week"/>
 *     <metric label="Orders" value="320" delta="-3%"/>
 *   </metrics>
 *
 * `trend` is optional — inferred from the delta's sign when omitted.
 * <metric> is flat (attributes only), so parsing is a regex scan rather than
 * DOMParser — works identically in the browser, SSR, and node tests.
 * See: docs/frontend-rendering.md - Metrics section.
 */

import React from "react"
import { StatCard } from "@/components/StatCard"
import type { DeltaTrend } from "@/components/DeltaPill"

export interface ParsedMetric {
  label: string
  value: string
  delta?: string
  trend: DeltaTrend
  sub?: string
}

const METRIC_TAG_RE = /<metric\b([^>]*?)\/?>/gi
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

export function parseMetricsXml(xml: string): ParsedMetric[] {
  const metrics: ParsedMetric[] = []
  for (const tagMatch of xml.matchAll(METRIC_TAG_RE)) {
    const attrs: Record<string, string> = {}
    for (const attrMatch of tagMatch[1].matchAll(ATTR_RE)) {
      attrs[attrMatch[1].toLowerCase()] = unescapeXml(attrMatch[2])
    }
    const { label, value, delta, sub } = attrs
    if (!label || !value) continue
    const trendAttr = (attrs.trend ?? "").toLowerCase()
    const trend: DeltaTrend =
      trendAttr === "down" ? "down" :
      trendAttr === "up"   ? "up"   :
      delta?.trim().startsWith("-") ? "down" : "up"
    metrics.push({ label, value, delta, trend, sub })
  }
  return metrics
}

export function XmlMetrics({ xml }: { xml: string }) {
  const metrics = React.useMemo(() => parseMetricsXml(xml), [xml])
  if (metrics.length === 0) return null

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap:                 12,
        margin:              "12px 0",
      }}
    >
      {metrics.map((metric, i) => (
        <StatCard
          key={`${metric.label}-${i}`}
          label={metric.label}
          value={metric.value}
          delta={metric.delta}
          deltaTrend={metric.trend}
          sub={metric.sub}
        />
      ))}
    </div>
  )
}
