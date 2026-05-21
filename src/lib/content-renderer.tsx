"use client"

/**
 * content-renderer.tsx
 *
 * ContentRenderer is the single entry-point for rendering assistant message
 * content. It splits the raw content string into typed segments
 * (markdown / table / chart / pending-in-flight) and delegates each to the
 * appropriate component.
 *
 * Replaces direct use of MarkdownRenderer in ChatMessage for both the
 * streaming (isStreaming=true) and static cases.
 *
 * See: docs/frontend-rendering.md
 */

import React from "react"
import { parseContentSegments } from "./content-parser"
import { MarkdownRenderer } from "./markdown-utils"
import type { HighlightSpec } from "./markdown-utils"
import { XmlTable } from "@/components/chat/XmlTable"
import { XmlChart } from "@/components/chat/XmlChart"
import { renderTextBlock } from "@/components/chat/ResponseBlocks"
import type { WebCitation } from "@/hooks/use-chat-state"

function StreamingTextBlock({ text, citations, cursor }: { text: string; citations?: WebCitation[]; cursor?: React.ReactNode }) {
  // eslint-disable-next-line react-doctor/no-render-in-render -- renderTextBlock is a stable module-level helper used across multiple call sites
  return <>{renderTextBlock(text, citations, cursor)}</>
}

// ---------------------------------------------------------------------------
// Pending block placeholder
// ---------------------------------------------------------------------------

/**
 * Shown in place of a <table> or <chart> block that has started streaming
 * but whose closing tag has not yet arrived.
 */
function PendingBlockPlaceholder({ tag }: { tag: "table" | "chart" }) {
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
  // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segments have no IDs; adjacent same-type segments make content-based keys non-unique
  const rendered = segments.map((seg, i) => {
    const isLast = i === lastIdx

    switch (seg.type) {
      case "table":
        // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segment index is stable; no other unique key available
        return <XmlTable key={i} xml={seg.xml} />

      case "chart":
        // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segment index is stable; no other unique key available
        return <XmlChart key={i} xml={seg.xml} />

      case "pending":
        // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segment index is stable; no other unique key available
        return <PendingBlockPlaceholder key={i} tag={seg.tag} />

      case "markdown": {
        // Trailing whitespace-only segments with no cursor are skipped
        // to avoid rendering empty divs between structured blocks.
        if (!seg.text.trim() && !(isLast && isStreaming && cursor)) {
          return null
        }

        if (isStreaming) {
          // Streaming: use inline renderTextBlock so content flows
          // naturally with the trailing BreathingDot cursor.
          return (
            // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segment index is stable; no other unique key available
            <StreamingTextBlock key={i}
              text={seg.text}
              citations={webCitations}
              cursor={isLast ? cursor : undefined}
            />
          )
        }

        // Completed message: full MarkdownRenderer (GFM, math, code blocks…)
        return (
          // eslint-disable-next-line react/no-array-index-as-key, react-doctor/no-array-index-as-key -- segment index is stable; no other unique key available
          <MarkdownRenderer key={i}
            content={seg.text}
            webCitations={webCitations}
            highlights={highlights}
          />
        )
      }
    }
  })

  return <>{rendered}</>
}
