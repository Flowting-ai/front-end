"use client"

/**
 * content-renderer.tsx
 *
 * ContentRenderer is the single entry-point for rendering assistant message
 * content. It splits the raw content string into typed segments
 * (markdown / table / chart / pending-in-flight / incomplete) and delegates
 * each to the appropriate component. Markdown segments use the full markdown
 * pipeline so headings, nested lists, math, emphasis, and code blocks keep
 * their structure.
 *
 * See: docs/ui/frontend-rendering.md
 */

import React, { useEffect } from "react"
import { parseContentSegments, type ContentSegment, type StructuredTag } from "./content-parser"
import { MarkdownRenderer, type HighlightSpec } from "./markdown-utils"
import { prefetchHighlighter } from "./highlight-loader"
import { XmlTable } from "@/components/chat/XmlTable"
import { XmlChart } from "@/components/chat/XmlChart"
import { XmlMetrics } from "@/components/chat/XmlMetrics"
import { XmlEmail } from "@/components/chat/XmlEmail"
import { XmlFunnel } from "@/components/chat/XmlFunnel"
import { XmlKanban } from "@/components/chat/XmlKanban"
import { XmlSchedule } from "@/components/chat/XmlSchedule"
import { XmlWeather } from "@/components/chat/XmlWeather"
import { XmlMap } from "@/components/chat/XmlMap"
import { XmlSteps } from "@/components/chat/XmlSteps"
import { XmlCallout } from "@/components/chat/XmlCallout"
import { XmlTags } from "@/components/chat/XmlTags"
import { WidgetReveal, WidgetSkeleton } from "@/components/chat/WidgetSkeleton"
import type { WebCitation } from "@/types/chat"

// ---------------------------------------------------------------------------
// Incomplete block notice
// ---------------------------------------------------------------------------

/**
 * Shown, once the response is over, for a structured block whose closing tag
 * never arrived (stopped or interrupted mid-block). The raw XML stays
 * reachable under a disclosure; text after the block still renders.
 */
function IncompleteBlockNotice({ tag, xml }: { tag: StructuredTag; xml: string }) {
  return (
    <div style={{ margin: "12px 0", fontFamily: "var(--font-body)", fontSize: 13, lineHeight: "20px", color: "var(--neutral-600)" }}>
      <p style={{ margin: 0 }}>Couldn&apos;t display this {tag} — the response ended early.</p>
      <details>
        <summary style={{ width: "fit-content", marginTop: 4, fontSize: 12, cursor: "pointer" }}>Show raw output</summary>
        <pre className="kaya-scrollbar" style={{ fontSize: 12, color: "var(--neutral-500)", overflowX: "auto", margin: "8px 0 0", padding: "10px 14px", background: "var(--neutral-800-05)", borderRadius: 8, border: "1px solid var(--neutral-100)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "var(--font-code)" }}>
          {xml}
        </pre>
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

type WidgetSegment = Extract<ContentSegment, { type: StructuredTag }>

function renderWidget(seg: WidgetSegment, isStreaming?: boolean) {
  switch (seg.type) {
    case "table":    return <XmlTable xml={seg.xml} animate={isStreaming} />
    case "chart":    return <XmlChart xml={seg.xml} />
    case "metrics":  return <XmlMetrics xml={seg.xml} />
    case "email":    return <XmlEmail xml={seg.xml} />
    case "funnel":   return <XmlFunnel xml={seg.xml} />
    case "kanban":   return <XmlKanban xml={seg.xml} />
    case "schedule": return <XmlSchedule xml={seg.xml} />
    case "weather":  return <XmlWeather xml={seg.xml} />
    case "map":      return <XmlMap xml={seg.xml} />
    case "steps":    return <XmlSteps xml={seg.xml} animate={isStreaming} />
    case "callout":  return <XmlCallout xml={seg.xml} />
    case "tags":     return <XmlTags xml={seg.xml} animate={isStreaming} />
  }
}

// ---------------------------------------------------------------------------
// Streaming cursor
// ---------------------------------------------------------------------------

/**
 * Holds the streaming cursor just below the last block without taking up
 * space: a zero-height anchor with the cursor absolutely positioned inside,
 * so the layout doesn't shift when the cursor goes away at completion.
 */
function CursorAnchor({ cursor }: { cursor: React.ReactNode }) {
  return (
    <div style={{ position: "relative", height: 0 }}>
      <span style={{ position: "absolute", top: 0, left: 0, lineHeight: "var(--prose-line-body)", whiteSpace: "nowrap" }}>
        {cursor}
      </span>
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
  // Start loading the syntax highlighter as soon as a reply opens a code
  // fence, so the block is highlighted by the time it renders.
  const hasCodeFence = content.includes("```") || content.includes("~~~")
  useEffect(() => {
    if (hasCodeFence) prefetchHighlighter()
  }, [hasCodeFence])

  const segments = parseContentSegments(content, { streaming: Boolean(isStreaming) })

  // Keep the preview's breathing cursor visible during the short interval
  // before the first queued word is revealed.
  if (segments.length === 0) {
    return isStreaming ? <>{cursor}</> : null
  }

  // Segments are positional (markdown, table, chart, pending) — index is the
  // only stable key because adjacent same-type segments are possible.
  const rendered = segments.map((seg, i) => {
    switch (seg.type) {
      case "pending":
        return <WidgetSkeleton key={i} tag={seg.tag} />

      case "incomplete":
        return <IncompleteBlockNotice key={i} tag={seg.tag} xml={seg.xml} />

      case "markdown":
        // Whitespace-only segments (between structured blocks) render nothing.
        if (!seg.text.trim()) return null
        return (
          <MarkdownRenderer
            key={i}
            content={seg.text}
            webCitations={webCitations}
            highlights={isStreaming ? undefined : highlights}
            streaming={Boolean(isStreaming) && i === segments.length - 1}
          />
        )

      default:
        return (
          <WidgetReveal key={i} animate={isStreaming}>
            {renderWidget(seg, isStreaming)}
          </WidgetReveal>
        )
    }
  })

  return (
    <>
      {rendered}
      {isStreaming && cursor ? <CursorAnchor cursor={cursor} /> : null}
    </>
  )
}
