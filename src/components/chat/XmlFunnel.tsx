"use client"

/**
 * XmlFunnel.tsx
 *
 * Renders a <funnel>...</funnel> XML block from the assistant as horizontal
 * conversion bars — each stage's width is proportional to the first stage,
 * with the drop-through percentage on the right:
 *
 *   <funnel title="Checkout funnel">
 *     <stage label="Visited" value="12400"/>
 *     <stage label="Added to cart" value="3100"/>
 *     <stage label="Purchased" value="980"/>
 *   </funnel>
 *
 * Values must be plain numbers (same rule as <chart>).
 * See: docs/frontend-rendering.md - Funnel section.
 */

import React from "react"
import { m, useReducedMotion } from "framer-motion"
import { ArrowDown, Filter, TrendingDown } from "lucide-react"
import { scanTags } from "@/lib/xml-widgets"

export interface ParsedFunnel {
  title?: string
  stages: Array<{ label: string; value: number }>
}

export function parseFunnelXml(xml: string): ParsedFunnel | null {
  const [funnel] = scanTags(xml, "funnel")
  if (!funnel) return null
  const stages = scanTags(funnel.inner, "stage")
    .map(({ attrs }) => ({ label: attrs.label ?? "", value: Number(attrs.value) }))
    .filter((s) => s.label && Number.isFinite(s.value) && s.value >= 0)
  if (stages.length === 0) return null
  return { title: funnel.attrs.title, stages }
}

function formatNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString()
}

export function XmlFunnel({ xml }: { xml: string }) {
  const funnel = React.useMemo(() => parseFunnelXml(xml), [xml])
  const reduceMotion = Boolean(useReducedMotion())
  if (!funnel) return null

  const base = funnel.stages[0].value || 1
  const finalConversion = Math.max(0, Math.min(1, funnel.stages.at(-1)!.value / base))
  const stageColors = ["#683D1B", "#A35F2D", "#C88A3D", "#4F8870", "#496E8B", "#6D5C91"]

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: "14px 0",
        padding: "15px 16px 16px",
        borderRadius: 18,
        border: "1px solid rgba(104, 61, 27, 0.16)",
        background: "linear-gradient(135deg, #FBF4EC 0%, #FFFDFC 52%, #F4EEE8 100%)",
        boxShadow: "0 10px 28px rgba(82, 75, 71, 0.09), 0 2px 4px rgba(82, 75, 71, 0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { rotate: -10, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 330, damping: 23 }}
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: 11,
            color: "#683D1B",
            background: "rgba(199, 151, 105, 0.18)",
            border: "1px solid rgba(104, 61, 27, 0.14)",
          }}
        >
          <Filter size={17} strokeWidth={1.8} />
        </m.span>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-500)" }}>
            Conversion path
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-body)", fontWeight: "var(--font-weight-semibold)", color: "var(--neutral-950)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {funnel.title || "Funnel overview"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 17, lineHeight: "21px", fontWeight: "var(--font-weight-semibold)", color: "#683D1B", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(finalConversion * 100)}%
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-400)" }}>final conversion</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {funnel.stages.map((stage, i) => {
          const pct = Math.max(0, Math.min(1, stage.value / base))
          const previous = i > 0 ? funnel.stages[i - 1]!.value : stage.value
          const retained = previous > 0 ? Math.max(0, Math.min(1, stage.value / previous)) : 0
          const color = stageColors[i % stageColors.length]!
          return (
            <React.Fragment key={`${stage.label}-${i}`}>
              {i > 0 && (
                <m.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ delay: reduceMotion ? 0 : i * 0.08 }}
                  style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 10, color: "var(--neutral-400)" }}
                >
                  <ArrowDown size={12} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11 }}>
                    {Math.round(retained * 100)}% continued
                  </span>
                  {retained < 1 && <TrendingDown size={11} color="#A35F2D" />}
                </m.div>
              )}
              <m.div
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : i * 0.08, duration: 0.26 }}
                style={{
                  padding: "9px 10px 10px",
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.62)",
                  border: "1px solid rgba(82, 75, 71, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
                  <span style={{ flex: "1 1 0", minWidth: 0, fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", fontWeight: "var(--font-weight-medium)", color: "var(--neutral-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={stage.label}>
                    {stage.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-700)", fontWeight: "var(--font-weight-medium)", fontVariantNumeric: "tabular-nums" }}>
                    {formatNum(stage.value)}
                  </span>
                  <span style={{ minWidth: 36, textAlign: "right", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-400)", fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(pct * 100)}%
                  </span>
                </div>
                <div style={{ height: 9, borderRadius: 999, backgroundColor: "rgba(82,75,71,0.08)", overflow: "hidden" }}>
                  <m.div
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${Math.max(pct * 100, 1.5)}%` }}
                    transition={{ delay: reduceMotion ? 0 : 0.12 + i * 0.08, duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${color}, ${color}B8)`,
                    boxShadow: `0 0 12px ${color}24`,
                  }}
                  />
                </div>
              </m.div>
            </React.Fragment>
          )
        })}
      </div>
    </m.div>
  )
}
