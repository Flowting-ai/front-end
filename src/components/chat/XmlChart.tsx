"use client"

/**
 * XmlChart.tsx
 *
 * Renders <chart type="bar|pie|line|histogram"> XML blocks from the assistant.
 * Visual design matches souvenir-chat-preview exactly:
 *   bar  → vertical spring-animated bars with grid lines + value labels
 *   pie  → donut (R=90, SW=26) with sequential stroke-dashoffset reveal + legend
 *   line → pathLength draw animation + crosshair hover + dark tooltip
 *   histogram → bins raw observations (Sturges rule), renders as bar chart style
 *
 * See: docs/frontend-rendering.md - Charts section.
 */

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import { ChartNoAxesCombined, PieChart as PieChartIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Palette - mirrors souvenir-chat-preview BAR_PALETTE / PIE_COLORS_HEX
// ---------------------------------------------------------------------------

const BAR_PALETTE = [
  "var(--brown-700)",   // #683D1B
  "var(--blue-600)",    // #0D6EB2
  "var(--green-600)",   // #80B707
  "var(--neutral-400)", // #9C938B
  "var(--yellow-500)",  // #A28847
  "var(--neutral-700)", // #524B47
]

// Hex values needed for SVG attributes that cannot use CSS vars
const PIE_COLORS_HEX = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B", "#524B47", "#A28847"]
const LINE_COLORS    = ["#683D1B", "#0D6EB2", "#80B707", "#9C938B"]
const EMPTY_SUBSCRIBE = () => () => {}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return ""
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k"
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString()
}

function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = Math.floor(Math.log10(max))
  const f   = max / Math.pow(10, exp)
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * Math.pow(10, exp)
}

// ---------------------------------------------------------------------------
// XML parsing
// ---------------------------------------------------------------------------

interface ChartAttrs {
  type: string
  title?: string
  xLabel?: string
  yLabel?: string
}

function parseChartDocument(xml: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml")
    return doc.querySelector("parsererror") ? null : doc
  } catch { return null }
}

function readChartAttrs(el: Element): ChartAttrs {
  return {
    type:   (el.getAttribute("type") ?? "bar").toLowerCase(),
    title:  el.getAttribute("title") ?? undefined,
    xLabel: el.getAttribute("x-label") ?? undefined,
    yLabel: el.getAttribute("y-label") ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Shared chart card wrapper - mirrors BarChartShell from preview
// ---------------------------------------------------------------------------

function ChartShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const reduceMotion = Boolean(useReducedMotion())
  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "linear-gradient(135deg, #F2F6F8 0%, #FFFEFC 52%, #F3EEE8 100%)",
        border: "1px solid rgba(73,110,139,0.15)",
        borderRadius: 18,
        padding: "13px 15px 14px",
        margin: "16px 0",
        boxShadow: "0 10px 28px rgba(82,75,71,0.09), 0 2px 4px rgba(82,75,71,0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, color: "#496E8B", backgroundColor: "rgba(222,235,244,0.76)", border: "1px solid rgba(73,110,139,0.16)" }}
        >
          <ChartNoAxesCombined size={16} strokeWidth={1.8} />
        </m.span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, lineHeight: "15px", color: "var(--neutral-500)" }}>Data visualization</div>
          <div style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, color: "var(--neutral-950)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Chart"}</div>
        </div>
      </div>
      <div style={{ padding: "10px 10px 6px", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.67)", border: "1px solid rgba(82,75,71,0.08)" }}>
        {children}
      </div>
    </m.div>
  )
}

// ---------------------------------------------------------------------------
// Bar Chart (vertical) - spring scaleY, grid lines, value labels
// ---------------------------------------------------------------------------

interface BarDatum { label: string; value: number }

function BarChart({ attrs, bars }: { attrs: ChartAttrs; bars: BarDatum[] }) {
  const [revealed, setRevealed] = useState(false)
  const chartH = Math.max(bars.length * 36, 140)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 140)
    return () => clearTimeout(t)
  }, [])

  if (bars.length === 0) return null

  const maxVal = niceMax(Math.max(...bars.map((b) => b.value)) * 1.15)

  return (
    <ChartShell title={attrs.title}>
      {attrs.yLabel && (
        <div style={{ fontSize: 12, color: "var(--neutral-400)", textAlign: "center", marginBottom: 4 }}>{attrs.yLabel}</div>
      )}
      <div style={{ position: "relative", height: chartH }}>
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <m.div key={pct}
            initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ position: "absolute", bottom: `${pct * 100}%`, left: 0, right: 0, height: 1, background: "var(--neutral-800-10)", pointerEvents: "none" }}
          />
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: "100%" }}>
          {bars.map((bar, i) => {
            const barH = Math.max((bar.value / maxVal) * chartH, 4)
            const color = BAR_PALETTE[i % BAR_PALETTE.length]
            return (
              <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <m.div
                  initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }}
                  transition={{ delay: i * 0.1 + 0.55, duration: 0.2 }}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-700)", marginBottom: 4, lineHeight: 1 }}>
                  {formatNum(bar.value)}{attrs.yLabel ? "" : ""}
                </m.div>
                <m.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: i * 0.1 }}
                  style={{ width: "100%", height: barH, background: color ?? "var(--brown-700)", borderRadius: "4px 4px 0 0", transformOrigin: "bottom" }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ height: 1, background: "var(--neutral-800-15)", margin: "0 0 8px" }} />
      <div style={{ display: "flex", gap: 10 }}>
        {bars.map((bar) => (
          <div key={bar.label} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--neutral-400)", lineHeight: "16px" }}>
            {bar.label}
          </div>
        ))}
      </div>
      {attrs.xLabel && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--neutral-400)", marginTop: 4 }}>{attrs.xLabel}</div>
      )}
    </ChartShell>
  )
}

// ---------------------------------------------------------------------------
// Pie Chart (donut) - R=90 SW=26, sequential reveal, two-column legend
// ---------------------------------------------------------------------------

interface SliceDatum { label: string; value: number }

function PieChart({ attrs, slices }: { attrs: ChartAttrs; slices: SliceDatum[] }) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const reduceMotion = Boolean(useReducedMotion())

  const R = 90, CX = 110, CY = 110, SW = 26
  const circ = 2 * Math.PI * R
  const total = slices.reduce((s, sl) => s + sl.value, 0)

  useEffect(() => {
    let idx = 0
    const t = setInterval(() => {
      idx++
      setRevealedCount(idx)
      if (idx >= slices.length) clearInterval(t)
    }, 180)
    return () => clearInterval(t)
  }, [slices.length])

  if (slices.length === 0 || total === 0) return null

  const arcs = slices.map((sl, i) => {
    const pct = sl.value / total
    const priorValue = slices.slice(0, i).reduce((sum, prior) => sum + prior.value, 0)
    const startDeg = (priorValue / total) * 360 - 90
    return {
      pct,
      startDeg,
      dashLen: pct * circ,
      gapLen: (1 - pct) * circ,
      color: PIE_COLORS_HEX[i % PIE_COLORS_HEX.length]!,
      label: sl.label,
      value: sl.value,
    }
  })

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: "linear-gradient(135deg, #F3F0F7 0%, #FFFEFC 52%, #F1ECE7 100%)", border: "1px solid rgba(109,92,145,0.15)", borderRadius: 18, padding: "13px 15px 15px", margin: "16px 0", boxShadow: "0 10px 28px rgba(82,75,71,0.09), 0 2px 4px rgba(82,75,71,0.07)", overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, color: "#6D5C91", backgroundColor: "rgba(109,92,145,0.11)", border: "1px solid rgba(109,92,145,0.16)" }}
        >
          <PieChartIcon size={16} strokeWidth={1.8} />
        </m.span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, lineHeight: "15px", color: "var(--neutral-500)" }}>Distribution</div>
          <div style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, color: "var(--neutral-950)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attrs.title || "Breakdown"}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: "block", maxWidth: "100%" }}>
          {/* Track ring */}
          <circle r={R} cx={CX} cy={CY} fill="none" stroke="rgba(59,54,50,0.07)" strokeWidth={SW} />
          {arcs.map((arc, i) => (
            <circle key={arc.label} r={R} cx={CX} cy={CY} fill="none"
              stroke={arc.color}
              strokeWidth={i === hoveredIdx ? SW + 4 : SW}
              strokeDasharray={`${arc.dashLen} ${arc.gapLen}`}
              strokeDashoffset={i < revealedCount ? 0 : arc.dashLen}
              transform={`rotate(${arc.startDeg} ${CX} ${CY})`}
              style={{ transition: "stroke-dashoffset 0.52s cubic-bezier(0.16,1,0.3,1), stroke-width 120ms", strokeLinecap: "butt", cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
          {/* Center label */}
          {hoveredIdx !== null ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fill={arcs[hoveredIdx]!.color} fontSize={20} fontWeight="700" fontFamily="var(--font-body)">
                {formatNum(arcs[hoveredIdx]!.value)}
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" fill="#9C938B" fontSize={10} fontFamily="var(--font-body)">
                {Math.round(arcs[hoveredIdx]!.pct * 100)}%
              </text>
              <text x={CX} y={CY + 23} textAnchor="middle" fill="#9C938B" fontSize={9} fontFamily="var(--font-body)">
                {arcs[hoveredIdx]!.label.split(" ").slice(0, 2).join(" ")}
              </text>
            </>
          ) : (
            <>
              <text x={CX} y={CY + 5} textAnchor="middle" fill="var(--neutral-600)" fontSize={16} fontWeight="600" fontFamily="var(--font-body)">
                {formatNum(total)}
              </text>
              <text x={CX} y={CY + 20} textAnchor="middle" fill="#9C938B" fontSize={9} fontFamily="var(--font-body)">total</text>
            </>
          )}
        </svg>
      </div>
      {/* Two-column legend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        {arcs.map((arc, i) => (
          <m.div key={arc.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: i < revealedCount ? 1 : 0, y: i < revealedCount ? 0 : 4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default", opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.45 : undefined, transition: "opacity 120ms" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--neutral-700)", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{arc.label}</div>
              <div style={{ fontSize: 12, color: "var(--neutral-400)", lineHeight: "15px" }}>{formatNum(arc.value)} <span style={{ opacity: 0.6 }}>· {Math.round(arc.pct * 100)}%</span></div>
            </div>
          </m.div>
        ))}
      </div>
    </m.div>
  )
}

// ---------------------------------------------------------------------------
// Line Chart - pathLength draw animation + crosshair + dark tooltip
// ---------------------------------------------------------------------------

interface PointDatum { x: string | number; y: number }

function LineChart({ attrs, points }: { attrs: ChartAttrs; points: PointDatum[] }) {
  const [revealed, setRevealed] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipLeft, setTooltipLeft] = useState(4)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const W = 700, H = 160
  const PAD = { top: 14, right: 18, bottom: 32, left: 38 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const maxXIdx = points.length - 1 || 1

  const yValues = points.map((p) => p.y)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const range = maxY - minY || 1

  const toSVGPt = (i: number, y: number) => ({
    x: PAD.left + (i / maxXIdx) * chartW,
    y: PAD.top + (1 - (y - minY) / range) * chartH,
  })

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120)
    return () => clearTimeout(t)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !containerRef.current) return
    const svgRect  = svgRef.current.getBoundingClientRect()
    const contRect = containerRef.current.getBoundingClientRect()
    const scaleX = W / svgRect.width
    const svgX   = (e.clientX - svgRef.current.getBoundingClientRect().left) * scaleX
    if (svgX < PAD.left || svgX > PAD.left + chartW) { setHoverIdx(null); return }
    const xi = Math.round((svgX - PAD.left) / chartW * maxXIdx)
    setHoverIdx(Math.max(0, Math.min(maxXIdx, xi)))
    const tooltipWidth = 120
    setTooltipLeft(Math.max(4, Math.min(e.clientX - contRect.left - tooltipWidth / 2, contRect.width - tooltipWidth - 4)))
  }

  if (points.length === 0) return null

  const color = LINE_COLORS[0]!
  const pts = points.map((p, i) => { const { x, y } = toSVGPt(i, p.y); return `${x},${y}` }).join(" ")
  const areaPts = pts + ` ${PAD.left + chartW},${PAD.top + chartH} ${PAD.left},${PAD.top + chartH}`
  const skip = Math.ceil(points.length / 7)
  const crosshairSvgX = hoverIdx !== null ? PAD.left + (hoverIdx / maxXIdx) * chartW : 0
  const tooltipWidth = 120

  return (
    <ChartShell title={attrs.title}>
      {attrs.yLabel && (
        <div style={{ fontSize: 12, color: "var(--neutral-400)", textAlign: "center", marginBottom: 4 }}>{attrs.yLabel}</div>
      )}
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yv = PAD.top + pct * chartH
            return (
              <m.line key={pct} x1={PAD.left} x2={PAD.left + chartW} y1={yv} y2={yv}
                stroke="rgba(59,54,50,0.07)" strokeWidth={1}
                initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.3, delay: 0.1 }}
              />
            )
          })}

          {/* Y-axis labels */}
          {[0, 0.5, 1].map((pct) => {
            const val = maxY - pct * range
            return (
              <text key={pct} x={PAD.left - 6} y={PAD.top + pct * chartH + 4} textAnchor="end" fill="#C0B5AD" fontSize={11} fontFamily="var(--font-body)">
                {formatNum(val)}
              </text>
            )
          })}

          {/* Area fill */}
          <m.polygon points={areaPts} fill={`${color}10`} stroke="none"
            initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ delay: 0.35, duration: 0.4 }} />

          {/* Line - pathLength draw trick */}
          <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
            pathLength={1} strokeDasharray="1"
            strokeDashoffset={revealed ? 0 : 1} strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }} />

          {/* Dots */}
          {points.map((p, i) => {
            const { x, y } = toSVGPt(i, p.y)
            const isHov = hoverIdx === i
            return (
              <m.circle key={String(p.x)} cx={x} cy={y} r={isHov ? 4 : 2.5}
                fill={isHov ? "var(--neutral-white)" : color}
                stroke={isHov ? color : "none"}
                strokeWidth={isHov ? 2 : 0}
                initial={{ scale: 0.5 }} animate={{ scale: revealed ? 1 : 0.5 }}
                transition={{ type: "spring", stiffness: 480, damping: 22, delay: 0.9 + i * 0.025 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            )
          })}

          {/* X-axis baseline */}
          <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="rgba(59,54,50,0.14)" strokeWidth={0.8} />

          {/* X-axis labels - sparse */}
          {points.map((p, i) => {
            if (i % skip !== 0 && i !== points.length - 1) return null
            const { x } = toSVGPt(i, 0)
            return (
              <text key={String(p.x)} x={x} y={H - 6} textAnchor="middle" fill="#C0B5AD" fontSize={11} fontFamily="var(--font-body)">
                {String(p.x)}
              </text>
            )
          })}

          {/* Crosshair */}
          {hoverIdx !== null && (
            <line x1={crosshairSvgX} x2={crosshairSvgX} y1={PAD.top} y2={PAD.top + chartH}
              stroke="rgba(59,54,50,0.18)" strokeWidth={0.8} strokeDasharray="4 3" />
          )}
        </svg>

        {/* Floating tooltip */}
        <AnimatePresence initial={false}>
          {hoverIdx !== null && (
            <m.div key="tip"
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: -8, left: tooltipLeft, width: tooltipWidth, background: "var(--neutral-900)", borderRadius: 8, padding: "7px 10px", pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 12px rgba(18,12,8,0.22)" }}>
              <div style={{ fontSize: 12, color: "var(--neutral-400)", fontWeight: 500, marginBottom: 5, letterSpacing: "0.3px" }}>
                {String(points[hoverIdx]?.x ?? "")}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--neutral-white)", fontVariantNumeric: "tabular-nums" }}>
                  {formatNum(points[hoverIdx]?.y ?? 0)}
                </span>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {attrs.xLabel && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--neutral-400)", marginTop: 4 }}>{attrs.xLabel}</div>
      )}
    </ChartShell>
  )
}

// ---------------------------------------------------------------------------
// Histogram - bins raw observations (Sturges rule) then renders as bar chart
// ---------------------------------------------------------------------------

interface Bin { label: string; count: number; rangeStart: number; rangeEnd: number }

function computeBins(values: number[]): Bin[] {
  if (values.length === 0) return []
  const min = Math.min(...values), max = Math.max(...values)
  if (min === max) return [{ label: String(min), count: values.length, rangeStart: min, rangeEnd: max }]
  const k = Math.ceil(Math.log2(values.length)) + 1
  const binWidth = (max - min) / k
  const counts = new Array<number>(k).fill(0)
  for (const v of values) { const idx = Math.min(Math.floor((v - min) / binWidth), k - 1); counts[idx]++ }
  return counts.map((count, i) => {
    const rangeStart = min + i * binWidth
    const rangeEnd   = rangeStart + binWidth
    return { label: `${formatNum(rangeStart)}-${formatNum(rangeEnd)}`, count, rangeStart, rangeEnd }
  })
}

function HistogramChart({ attrs, values }: { attrs: ChartAttrs; values: number[] }) {
  const [revealed, setRevealed] = useState(false)
  const bins = computeBins(values)
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 140); return () => clearTimeout(t) }, [])

  if (bins.length === 0) return null
  const chartH = 140
  const maxCount = niceMax(Math.max(...bins.map((b) => b.count)))
  const color = BAR_PALETTE[0]!

  return (
    <ChartShell title={attrs.title}>
      <div style={{ position: "relative", height: chartH }}>
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <m.div key={pct}
            initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{ position: "absolute", bottom: `${pct * 100}%`, left: 0, right: 0, height: 1, background: "var(--neutral-800-10)", pointerEvents: "none" }}
          />
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: "100%" }}>
          {bins.map((bin, i) => {
            const barH = Math.max((bin.count / maxCount) * chartH, 2)
            return (
              <div key={bin.rangeStart} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <m.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: revealed ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 140, damping: 18, mass: 1, delay: i * 0.05 }}
                  style={{ width: "100%", height: barH, background: color, borderRadius: "2px 2px 0 0", transformOrigin: "bottom" }}
                >
                  <title>{`${bin.label}: ${bin.count}`}</title>
                </m.div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ height: 1, background: "var(--neutral-800-15)", margin: "0 0 8px" }} />
      <div style={{ display: "flex", gap: 1 }}>
        {bins.map((bin, i) => {
          const skip = Math.ceil(bins.length / 8)
          if (i % skip !== 0 && i !== bins.length - 1) return <div key={`spacer-${bin.rangeStart}`} style={{ flex: 1 }} />
          return (
            <div key={`label-${bin.rangeStart}`} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--neutral-400)", lineHeight: "14px" }}>
              {formatNum(bin.rangeStart)}
            </div>
          )
        })}
      </div>
      {attrs.xLabel && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--neutral-400)", marginTop: 4 }}>{attrs.xLabel}</div>
      )}
    </ChartShell>
  )
}

// ---------------------------------------------------------------------------
// Unsupported type fallback
// ---------------------------------------------------------------------------

function UnsupportedChart({ type }: { type: string }) {
  return (
    <div style={{ margin: "16px 0", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--neutral-100)", background: "var(--neutral-800-05)", fontSize: 13, color: "var(--neutral-500)", fontFamily: "var(--font-body)" }}>
      Unsupported chart type:{" "}
      <code style={{ fontSize: 12, background: "var(--neutral-800-10)", borderRadius: 3, padding: "1px 5px" }}>{type}</code>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface ChartState {
  attrs: ChartAttrs
  bars?: BarDatum[]
  slices?: SliceDatum[]
  points?: PointDatum[]
  values?: number[]
}

function parseChartXml(xml: string): ChartState | null {
  const doc = parseChartDocument(xml)
  if (!doc) return null
  const chartEl = doc.querySelector("chart")
  if (!chartEl) return null
  const attrs = readChartAttrs(chartEl)

  switch (attrs.type) {
    case "bar": {
      const bars: BarDatum[] = []
      chartEl.querySelectorAll("bar").forEach((el) => {
        const label = el.getAttribute("label") ?? ""
        const value = Number(el.getAttribute("value"))
        if (label && Number.isFinite(value)) bars.push({ label, value })
      })
      return { attrs, bars }
    }
    case "pie": {
      const slices: SliceDatum[] = []
      chartEl.querySelectorAll("slice").forEach((el) => {
        const label = el.getAttribute("label") ?? ""
        const value = Number(el.getAttribute("value"))
        if (label && Number.isFinite(value)) slices.push({ label, value })
      })
      return { attrs, slices }
    }
    case "line": {
      const points: PointDatum[] = []
      chartEl.querySelectorAll("point").forEach((el) => {
        const xRaw = el.getAttribute("x") ?? ""
        const y = Number(el.getAttribute("y"))
        if (xRaw === "" || !Number.isFinite(y)) return
        const xNum = Number(xRaw)
        points.push({ x: Number.isNaN(xNum) ? xRaw : xNum, y })
      })
      return { attrs, points }
    }
    case "histogram": {
      const values: number[] = []
      chartEl.querySelectorAll("value").forEach((el) => {
        const v = Number(el.textContent?.trim() ?? "")
        if (Number.isFinite(v)) values.push(v)
      })
      return { attrs, values }
    }
    default:
      return { attrs }
  }
}

interface XmlChartProps { xml: string }

export function XmlChart({ xml }: XmlChartProps) {
  const state = useMemo(() => parseChartXml(xml) ?? "error", [xml])
  const mounted = React.useSyncExternalStore(EMPTY_SUBSCRIBE, () => true, () => false)

  if (!mounted) {
    return (
      <div style={{ height: 200, margin: "16px 0", borderRadius: 12, border: "1px solid var(--neutral-100)", background: "var(--neutral-800-05)" }} aria-hidden />
    )
  }

  if (!state || state === "error") {
    return (
      <pre className="kaya-scrollbar" style={{ fontSize: 12, color: "var(--neutral-500)", overflowX: "auto", margin: "12px 0", padding: "10px 14px", background: "var(--neutral-800-05)", borderRadius: 8, border: "1px solid var(--neutral-100)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "var(--font-code)" }}>
        {xml}
      </pre>
    )
  }

  const { attrs } = state
  switch (attrs.type) {
    case "bar":       return <BarChart attrs={attrs} bars={state.bars ?? []} />
    case "pie":       return <PieChart attrs={attrs} slices={state.slices ?? []} />
    case "line":      return <LineChart attrs={attrs} points={state.points ?? []} />
    case "histogram": return <HistogramChart attrs={attrs} values={state.values ?? []} />
    default:          return <UnsupportedChart type={attrs.type} />
  }
}
