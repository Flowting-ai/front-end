"use client"

/**
 * DiffBlock.tsx
 *
 * Renders ```diff code fences from the assistant as a unified diff view —
 * added lines tinted green, removed lines red, hunk headers muted. Routed
 * from CodeBlock the same way mermaid fences are.
 */

import React, { useState } from "react"
import { Copy, Check } from "lucide-react"

function lineStyle(line: string): React.CSSProperties {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { backgroundColor: "rgba(30, 138, 60, 0.10)", color: "var(--color-tag-Green-text, #1e8a3c)" }
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return { backgroundColor: "rgba(192, 57, 43, 0.08)", color: "var(--color-tag-Red-text, #c0392b)" }
  }
  if (line.startsWith("@@") || line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")) {
    return { color: "var(--neutral-400)" }
  }
  return { color: "var(--neutral-700)" }
}

export function DiffBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/\n$/, "").split("\n")

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{
        position:     "relative",
        margin:       "12px 0",
        borderRadius: 8,
        border:       "1px solid var(--neutral-200)",
        background:   "var(--neutral-white)",
        overflow:     "hidden",
      }}
    >
      <button
        type="button"
        onClick={copy}
        aria-label="Copy diff"
        style={{
          position:        "absolute",
          top:             6,
          right:           6,
          display:         "flex",
          alignItems:      "center",
          padding:         6,
          borderRadius:    6,
          border:          "1px solid var(--neutral-200)",
          backgroundColor: "var(--neutral-white)",
          color:           "var(--neutral-500)",
          cursor:          "pointer",
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <pre
        className="kaya-scrollbar"
        style={{
          margin:     0,
          padding:    "10px 0",
          overflowX:  "auto",
          fontFamily: "var(--font-code)",
          fontSize:   13,
          lineHeight: "20px",
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ padding: "0 14px", whiteSpace: "pre", ...lineStyle(line) }}>
            {line || " "}
          </div>
        ))}
      </pre>
    </div>
  )
}
