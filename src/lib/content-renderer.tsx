"use client"

/**
 * content-renderer.tsx
 *
 * ContentRenderer is the single entry-point for rendering assistant message
 * content. It splits the raw content string into typed segments
 * (markdown / table / chart / pending-in-flight) and delegates each to the
 * appropriate component. Markdown segments use the full markdown pipeline so
 * headings, nested lists, math, emphasis, and code blocks keep their structure.
 *
 * See: docs/frontend-rendering.md
 */

import React from "react"
import { parseContentSegments, type StructuredTag } from "./content-parser"
import { MarkdownRenderer, type HighlightSpec } from "./markdown-utils"
import { XmlTable } from "@/components/chat/XmlTable"
import { XmlChart } from "@/components/chat/XmlChart"
import { XmlMetrics } from "@/components/chat/XmlMetrics"
import type { WebCitation } from "@/hooks/use-chat-state"

// ---------------------------------------------------------------------------
// Pending block placeholder
// ---------------------------------------------------------------------------

/**
 * Shown in place of a structured XML block that has started streaming
 * but whose closing tag has not yet arrived.
 */
function PendingBlockPlaceholder({ tag }: { tag: StructuredTag }) {
  return (
    <div
      aria-label={`Loading ${tag}…`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "12px 0",
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px dashed var(--neutral-200)",
        background: "var(--neutral-50)",
        color: "var(--neutral-400)",
        fontSize: 13,
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Subtle animated dots */}
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
      <span>Rendering {tag}…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ContentRendererProps {
  content: string
  webCitations?: WebCitation[]
  isStreaming?: boolean
  cursor?: React.ReactNode
  highlights?: HighlightSpec[]
}

export function ContentRenderer({
  content,
  webCitations,
  isStreaming,
  cursor,
  highlights,
}: ContentRendererProps) {
  const segments = parseContentSegments(content)
  const lastIdx = segments.length - 1

  // Segments are positional (markdown, table, chart, pending) — index is the
  // only stable key because adjacent same-type segments are possible.
  const rendered = segments.map((seg, i) => {
    const isLast = i === lastIdx

    switch (seg.type) {
      case "table":
        return <XmlTable key={i} xml={seg.xml} animate={isStreaming} />

      case "chart":
        return <XmlChart key={i} xml={seg.xml} />

      case "metrics":
        return <XmlMetrics key={i} xml={seg.xml} />

      case "pending":
        return <PendingBlockPlaceholder key={i} tag={seg.tag} />

      case "markdown": {
        // Trailing whitespace-only segments with no cursor are skipped
        // to avoid rendering empty divs between structured blocks.
        if (!seg.text.trim() && !(isLast && isStreaming && cursor)) {
          return null
        }

        return (
          <React.Fragment key={i}>
            <MarkdownRenderer
              content={seg.text}
              webCitations={webCitations}
              highlights={isStreaming ? undefined : highlights}
            />
            {isStreaming && isLast && cursor}
          </React.Fragment>
        )
      }
    }
  })

  return <>{rendered}</>
}
