"use client"

/**
 * WidgetSkeleton.tsx
 *
 * Stand-ins for structured XML blocks (<table>, <chart>, …) whose closing tag
 * hasn't streamed in yet. Each one is shaped like the widget it becomes and
 * reserves roughly its rendered height, so the swap causes little layout
 * shift; WidgetReveal then fades the finished widget in.
 */

import React from "react"
import { Skeleton } from "@/components/Skeleton"
import type { StructuredTag } from "@/lib/content-parser"
import styles from "./WidgetSkeleton.module.css"

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
}

const ROW_WIDTHS = ["72%", "48%", "64%", "56%"]

function Bars({ widths, height = 10 }: { widths: string[]; height?: number }) {
  return (
    <>
      {widths.map((width, i) => (
        <Skeleton key={i} width={width} height={height} />
      ))}
    </>
  )
}

function TableShape() {
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", alignItems: "center", gap: 14, height: 40, padding: "0 14px" }
  return (
    <>
      <div className={styles.card}>
        <div style={{ ...grid, background: "var(--neutral-800-05)" }}>
          <Bars widths={["55%", "45%", "50%"]} />
        </div>
        {ROW_WIDTHS.map((width, ri) => (
          <div key={ri} style={{ ...grid, borderTop: "1px solid var(--neutral-100)" }}>
            <Bars widths={[width, "60%", "40%"]} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", height: 26, marginTop: 8 }}>
        <Skeleton width={96} height={10} />
      </div>
    </>
  )
}

function ChartShape() {
  const heights = ["45%", "70%", "55%", "90%", "35%", "65%"]
  return (
    <div className={styles.card} style={{ padding: "16px 18px 14px" }}>
      <Skeleton width="38%" height={12} style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, borderBottom: "1px solid var(--border-default)" }}>
        {heights.map((height, i) => (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
            <Skeleton height={height} radius="4px 4px 0 0" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {heights.map((_, i) => (
          <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <Skeleton width="60%" height={8} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsShape() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.card} style={{ borderRadius: 16, padding: 16, height: 104, display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width="50%" height={10} />
          <Skeleton width="62%" height={22} />
          <Skeleton width="30%" height={10} />
        </div>
      ))}
    </div>
  )
}

function StepsShape() {
  return (
    <div>
      <Skeleton width="36%" height={12} style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ROW_WIDTHS.slice(0, 3).map((width, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <Skeleton width={24} height={24} radius="50%" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
              <Skeleton width="45%" height={12} />
              <Skeleton width={width} height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapShape() {
  return (
    <div className={styles.card} style={{ borderRadius: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px 13px", borderBottom: "1px solid var(--neutral-100)" }}>
        <Skeleton width="34%" height={14} />
        <Skeleton width="52%" height={10} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(140px, 220px)", height: 370 }}>
        <Skeleton height="100%" radius={0} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
          <Bars widths={["70%", "90%", "75%", "60%", "50%"]} />
        </div>
      </div>
    </div>
  )
}

function EmailShape() {
  return (
    <div className={styles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width={32} height={32} radius="50%" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="30%" height={12} />
          <Skeleton width="45%" height={10} />
        </div>
      </div>
      <Skeleton width="58%" height={14} style={{ margin: "18px 0 12px" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Bars widths={["92%", "85%", "60%"]} />
      </div>
    </div>
  )
}

function ColumnsShape({ cards }: { cards: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
      {[0, 1, 2].map((col) => (
        <div key={col} className={styles.card} style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="50%" height={12} style={{ marginBottom: 4 }} />
          {Array.from({ length: cards - (col % 2) }, (_, i) => (
            <Skeleton key={i} height={52} radius={8} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FunnelShape() {
  return (
    <div className={styles.card} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton width="36%" height={12} />
      {["100%", "78%", "52%", "30%"].map((width, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <Skeleton width="28%" height={10} />
          <Skeleton width={width} height={9} radius={999} />
        </div>
      ))}
    </div>
  )
}

function CalloutShape() {
  return (
    <div className={styles.card} style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton width="38%" height={12} />
      <Skeleton width="86%" height={10} />
    </div>
  )
}

function TagsShape() {
  return (
    <div>
      <Skeleton width={120} height={10} style={{ marginBottom: 9 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[92, 124, 80, 106].map((width) => (
          <Skeleton key={width} width={width} height={27} radius={99} />
        ))}
      </div>
    </div>
  )
}

function WeatherShape() {
  return (
    <div className={styles.card} style={{ height: 210, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton width="32%" height={12} />
      <Skeleton width={110} height={44} />
      <div style={{ display: "flex", gap: 7, marginTop: "auto" }}>
        <Bars widths={["64px", "72px", "58px"]} height={24} />
      </div>
    </div>
  )
}

// Same vertical margins as the rendered widgets.
const MARGINS: Record<StructuredTag, string> = {
  table: "16px 0", chart: "16px 0", metrics: "12px 0", email: "14px 0",
  funnel: "14px 0", kanban: "14px 0", schedule: "14px 0", weather: "14px 0",
  map: "14px 0", steps: "14px 0", callout: "14px 0", tags: "14px 0",
}

function renderShape(tag: StructuredTag) {
  switch (tag) {
    case "table":    return <TableShape />
    case "chart":    return <ChartShape />
    case "metrics":  return <MetricsShape />
    case "email":    return <EmailShape />
    case "funnel":   return <FunnelShape />
    case "kanban":   return <ColumnsShape cards={3} />
    case "schedule": return <ColumnsShape cards={2} />
    case "weather":  return <WeatherShape />
    case "map":      return <MapShape />
    case "steps":    return <StepsShape />
    case "callout":  return <CalloutShape />
    case "tags":     return <TagsShape />
  }
}

/** Shown in place of a structured block until its closing tag arrives. */
export function WidgetSkeleton({ tag }: { tag: StructuredTag }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${tag}…`} className={styles.skeleton} style={{ position: "relative", margin: MARGINS[tag] }}>
      <span style={VISUALLY_HIDDEN}>Rendering {tag}…</span>
      {renderShape(tag)}
    </div>
  )
}

/**
 * Wraps a finished widget. When it mounts mid-stream (replacing its skeleton)
 * it fades in; widgets restored from history appear without animation. The
 * wrapper adds no box of its own, so the widget's margins still collapse
 * with the surrounding prose.
 */
export function WidgetReveal({ animate, children }: { animate?: boolean; children: React.ReactNode }) {
  const [animateOnMount] = React.useState(() => Boolean(animate))
  return <div className={animateOnMount ? styles.reveal : undefined}>{children}</div>
}
