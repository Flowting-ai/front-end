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
import { m, useReducedMotion } from "framer-motion"
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

const TREND_PALETTE: Record<DeltaTrend, { stroke: string; wash: string; border: string }> = {
  up: {
    stroke: "#3F846A",
    wash: "linear-gradient(145deg, rgba(74, 145, 113, 0.10), rgba(255,255,255,0) 48%)",
    border: "rgba(63, 132, 106, 0.18)",
  },
  down: {
    stroke: "#B46258",
    wash: "linear-gradient(145deg, rgba(180, 98, 88, 0.10), rgba(255,255,255,0) 48%)",
    border: "rgba(180, 98, 88, 0.18)",
  },
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

export function XmlMetrics({ xml }: { xml: string }) {
  const metrics = React.useMemo(() => parseMetricsXml(xml), [xml])
  const reduceMotion = useReducedMotion() ?? false
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
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -3, scale: 1.008 }}
          transition={{ duration: 0.34, delay: reduceMotion ? 0 : i * 0.065, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", borderRadius: 16 }}
        >
          <StatCard
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            deltaTrend={metric.trend}
            sub={metric.sub}
            style={{
              height: "100%",
              overflow: "hidden",
              background: TREND_PALETTE[metric.trend].wash,
              borderColor: metric.spark ? TREND_PALETTE[metric.trend].border : "var(--neutral-100)",
            }}
            trend={metric.spark && (
              <Sparkline
                data={metric.spark}
                height={48}
                color={TREND_PALETTE[metric.trend].stroke}
                style={{ margin: "4px -8px -4px", width: "calc(100% + 16px)" }}
              />
            )}
          />
        </m.div>
      ))}
    </div>
  )
}
