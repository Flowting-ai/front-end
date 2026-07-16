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
  if (!funnel) return null

  const base = funnel.stages[0].value || 1

  return (
    <div
      style={{
        margin:          "12px 0",
        padding:         "14px 16px",
        borderRadius:    12,
        border:          "1px solid var(--neutral-100)",
        backgroundColor: "var(--neutral-white)",
        boxShadow:       "var(--shadow-surface-card)",
      }}
    >
      {funnel.title && (
        <div
          style={{
            marginBottom: 10,
            fontFamily:   "var(--font-body)",
            fontSize:     "var(--font-size-body)",
            fontWeight:   500,
            color:        "var(--neutral-900)",
          }}
        >
          {funnel.title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {funnel.stages.map((stage, i) => {
          const pct = Math.max(0, Math.min(1, stage.value / base))
          return (
            <div key={`${stage.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width:        130,
                  flexShrink:   0,
                  fontFamily:   "var(--font-body)",
                  fontSize:     "var(--font-size-caption)",
                  color:        "var(--neutral-700)",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}
                title={stage.label}
              >
                {stage.label}
              </span>
              <div style={{ flex: "1 1 0", height: 22, borderRadius: 5, backgroundColor: "var(--neutral-50)", overflow: "hidden" }}>
                <div
                  style={{
                    width:           `${Math.max(pct * 100, 1.5)}%`,
                    height:          "100%",
                    borderRadius:    5,
                    backgroundColor: "var(--brown-700, #683D1B)",
                    opacity:         0.55 + 0.45 * pct,
                    transition:      "width 400ms ease",
                  }}
                />
              </div>
              <span
                style={{
                  width:      110,
                  flexShrink: 0,
                  textAlign:  "right",
                  fontFamily: "var(--font-body)",
                  fontSize:   "var(--font-size-caption)",
                  color:      "var(--neutral-500)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatNum(stage.value)} · {Math.round(pct * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
