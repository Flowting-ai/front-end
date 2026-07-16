"use client"

/**
 * XmlMetrics.tsx
 *
 * Renders a <metrics>...</metrics> XML block from the assistant as a
 * responsive row of KPI stat tiles:
 *
 *   <metrics>
 *     <metric label="Revenue" value="$12,400" delta="+8%" trend="up"
 *             sub="vs. last week" spark="9800,10400,9900,11200,12400"/>
 *     <metric label="Orders" value="320" delta="-3%"/>
 *   </metrics>
 *
 * `trend` is optional — inferred from the delta's sign when omitted.
 * `spark` is an optional comma-separated series (oldest → newest) rendered
 * as a small sparkline. <metric> is flat (attributes only), so parsing is a
 * regex scan rather than DOMParser — works identically in the browser, SSR,
 * and node tests. See: docs/frontend-rendering.md - Metrics section.
 */

import React from "react"
import { m } from "framer-motion"
import { StatCard } from "@/components/StatCard"
import { Sparkline } from "@/components/Sparkline"
import type { DeltaTrend } from "@/components/DeltaPill"
import { scanTags } from "@/lib/xml-widgets"

export interface ParsedMetric {
  label: string
  value: string
  delta?: string
  trend: DeltaTrend
  sub?: string
  spark?: number[]
}

// Muted line hue for the trend sparkline (hex — SVG attrs, matches --neutral-400).
const SPARK_COLOR = "#9C938B"

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

export function XmlMetrics({ xml }: { xml: string }) {
  const metrics = React.useMemo(() => parseMetricsXml(xml), [xml])
  if (metrics.length === 0) return null

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap:                 12,
        margin:              "12px 0",
      }}
    >
      {metrics.map((metric, i) => (
        <m.div
          key={`${metric.label}-${i}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
        >
          <StatCard
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            deltaTrend={metric.trend}
            sub={metric.sub}
            style={{ height: "100%" }}
            trend={metric.spark && (
              <Sparkline data={metric.spark} height={36} color={SPARK_COLOR} style={{ marginTop: 4 }} />
            )}
          />
        </m.div>
      ))}
    </div>
  )
}
