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

  useEffect(() => {
    let failTimer: ReturnType<typeof setTimeout> | undefined
    setFailed(false)
    const renderTimer = setTimeout(() => {
      try {
        setSvg(renderMermaidSVG(code, THEME))
      } catch {
        failTimer = setTimeout(() => setFailed(true), 1000)
      }
    }, 250)
    return () => {
      clearTimeout(renderTimer)
      if (failTimer) clearTimeout(failTimer)
    }
  }, [code])

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
    <div
      className="kaya-scrollbar"
      style={{
        margin:       "12px 0",
        padding:      12,
        borderRadius: 8,
        border:       "1px solid var(--neutral-100)",
        background:   "var(--neutral-white)",
        overflowX:    "auto",
      }}
      // Library-generated SVG from diagram text — same trust model as XmlChart's SVG output.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
