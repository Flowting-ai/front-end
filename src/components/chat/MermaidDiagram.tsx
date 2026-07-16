"use client"

/**
 * MermaidDiagram.tsx
 *
 * Renders ```mermaid code fences from the assistant as SVG diagrams
 * (flowcharts, sequence/state/class/ER diagrams, gantt, pie) via
 * beautiful-mermaid — a lightweight renderer that takes our design tokens so
 * diagrams match the app palette.
 *
 * Streaming: the fence body keeps changing while the model writes, so
 * rendering is debounced until the code is briefly stable. Transient parse
 * failures show the skeleton; only code that stays unparseable surfaces the
 * raw-source fallback.
 */

import React, { useEffect, useState } from "react"
import { renderMermaidSVG } from "beautiful-mermaid"
import { m, useReducedMotion } from "framer-motion"
import { Check, Copy, GitBranch, Maximize2, Minimize2 } from "lucide-react"

const THEME = {
  fg:          "var(--neutral-800)",
  muted:       "var(--neutral-500)",
  border:      "var(--neutral-300)",
  line:        "var(--neutral-400)",
  accent:      "var(--neutral-700)",
  surface:     "var(--neutral-50)",
  transparent: true,
}

function Skeleton() {
  return (
    <div
      aria-label="Rendering diagram…"
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        margin:       "12px 0",
        padding:      "10px 16px",
        borderRadius: 8,
        border:       "1px dashed var(--neutral-200)",
        background:   "var(--neutral-50)",
        color:        "var(--neutral-400)",
        fontSize:     13,
        fontFamily:   "var(--font-body)",
      }}
    >
      <svg width={20} height={8} viewBox="0 0 20 8" aria-hidden>
        {[0, 7, 14].map((x, dotIdx) => (
          <circle key={x} cx={x + 3} cy={4} r={2.5} fill="var(--neutral-300)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.2s"
              begin={`${dotIdx * 0.24}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
      <span>Rendering diagram…</span>
    </div>
  )
}

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const reduceMotion = Boolean(useReducedMotion())

  useEffect(() => {
    let failTimer: ReturnType<typeof setTimeout> | undefined
    const renderTimer = setTimeout(() => {
      try {
        setSvg(renderMermaidSVG(code, THEME))
        setFailed(false)
      } catch {
        failTimer = setTimeout(() => setFailed(true), 1000)
      }
    }, 250)
    return () => {
      clearTimeout(renderTimer)
      if (failTimer) clearTimeout(failTimer)
    }
  }, [code])

  const copySource = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (failed) {
    return (
      <div style={{ margin: "12px 0", borderRadius: 8, border: "1px solid var(--neutral-200)", background: "var(--neutral-50)" }}>
        <pre
          className="kaya-scrollbar"
          style={{
            margin:     0,
            padding:    "12px 16px",
            overflowX:  "auto",
            fontFamily: "var(--font-code)",
            fontSize:   13,
            color:      "var(--neutral-700)",
          }}
        >
          {code.trim()}
        </pre>
        <p
          style={{
            margin:     0,
            padding:    "6px 16px",
            borderTop:  "1px solid var(--neutral-200)",
            fontFamily: "var(--font-body)",
            fontSize:   "var(--font-size-caption)",
            color:      "var(--neutral-400)",
          }}
        >
          Diagram could not be rendered
        </p>
      </div>
    )
  }

  if (!svg) return <Skeleton />

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: expanded ? "fixed" : "relative",
        inset: expanded ? 24 : undefined,
        zIndex: expanded ? 1100 : undefined,
        display: "flex",
        flexDirection: "column",
        margin: expanded ? 0 : "14px 0",
        minHeight: expanded ? 0 : 220,
        maxHeight: expanded ? "calc(100vh - 48px)" : undefined,
        borderRadius: 18,
        border: "1px solid rgba(109, 92, 145, 0.17)",
        background: "linear-gradient(135deg, #F3F0F7 0%, #FFFEFC 52%, #EEE9F2 100%)",
        boxShadow: expanded
          ? "0 28px 80px rgba(18,12,8,0.28)"
          : "0 10px 28px rgba(82,75,71,0.09), 0 2px 4px rgba(82,75,71,0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderBottom: "1px solid rgba(109, 92, 145, 0.10)" }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, color: "#6D5C91", backgroundColor: "rgba(109,92,145,0.11)", border: "1px solid rgba(109,92,145,0.16)" }}
        >
          <GitBranch size={16} strokeWidth={1.8} />
        </m.span>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-500)" }}>Diagram</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-body)", fontWeight: "var(--font-weight-semibold)", color: "var(--neutral-950)" }}>Flow visualization</div>
        </div>
        <m.button
          type="button"
          onClick={copySource}
          aria-label={copied ? "Diagram source copied" : "Copy diagram source"}
          whileHover={reduceMotion ? undefined : { scale: 1.04 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, border: "1px solid rgba(82,75,71,0.12)", backgroundColor: "rgba(255,255,255,0.72)", color: copied ? "#287A47" : "var(--neutral-500)", cursor: "pointer" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </m.button>
        <m.button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Exit expanded diagram" : "Expand diagram"}
          aria-pressed={expanded}
          whileHover={reduceMotion ? undefined : { scale: 1.04 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, border: "1px solid rgba(82,75,71,0.12)", backgroundColor: "rgba(255,255,255,0.72)", color: "var(--neutral-500)", cursor: "pointer" }}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </m.button>
      </div>

      <m.div
        className="kaya-scrollbar"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduceMotion ? 0 : 0.08, duration: 0.34 }}
        style={{
          flex: expanded ? "1 1 0" : undefined,
          minHeight: 0,
          display: "grid",
          placeItems: "center",
          padding: expanded ? 24 : 16,
          overflow: "auto",
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(109,92,145,0.10) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
        // Library-generated SVG from diagram text — same trust model as XmlChart's SVG output.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </m.div>
  )
}
