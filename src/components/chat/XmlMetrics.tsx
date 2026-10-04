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
 * and node tests. See: docs/ui/frontend-rendering.md - Metrics section.
 */

import React from "react"
import { m, useReducedMotion } from "framer-motion"
import { StatCard } from "@/components/StatCard"
import { Sparkline } from "@/components/Sparkline"
import type { DeltaTrend } from "@/components/DeltaPill"
import { parseMetricsXml } from "@/components/chat/XmlMetrics.parse"

const TREND_PALETTE: Record<DeltaTrend, string> = {
  up: "var(--color-tag-Green-text)",
  down: "var(--color-tag-Red-text)",
}

export function XmlMetrics({ xml }: { xml: string }) {
  const metrics = React.useMemo(() => parseMetricsXml(xml), [xml])
  const reduceMotion = useReducedMotion() ?? false
  if (metrics.length === 0) return null

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
        gap:                 12,
        margin:              "12px 0",
      }}
    >
      {metrics.map((metric, i) => (
        <m.div
          key={`${metric.label}-${i}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0 }}
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
            }}
            trend={metric.spark && (
              <Sparkline
                data={metric.spark}
                height={48}
                color={TREND_PALETTE[metric.trend]}
                style={{ margin: "4px -8px -4px", width: "calc(100% + 16px)" }}
              />
            )}
          />
        </m.div>
      ))}
    </div>
  )
}
