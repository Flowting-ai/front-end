"use client"

/**
 * XmlCallout.tsx
 *
 * Renders a <callout>...</callout> XML block from the assistant as a
 * left-accented notice. The body is the inner text, not an attribute, so it
 * can carry inline Markdown:
 *
 *   <callout variant="warning" title="May 11 is the single point of failure">
 *     Every component not specced by **Apr 30** is a direct risk.
 *   </callout>
 *
 * Parsing only — the visual is AnimatedCallout, shared with the response-block
 * renderer.
 * See: docs/ui/frontend-rendering.md - Callout section.
 */

import React from "react"
import { AnimatedCallout } from "@/components/chat/ResponseBlocks"
import { scanTags, unescapeXml } from "@/lib/xml-widgets"
import type { CalloutData } from "@/hooks/use-chat-state"

const CALLOUT_VARIANTS = new Set<CalloutData["variant"]>(["info", "warning", "success", "error", "tip"])

export function parseCalloutXml(xml: string): CalloutData | null {
  const [block] = scanTags(xml, "callout")
  if (!block) return null
  const body = unescapeXml(block.inner).trim()
  if (!body) return null
  // An unknown variant would index CALLOUT_CFG to undefined and take the whole
  // message down with it, so it degrades to the neutral one.
  const requested = (block.attrs.variant ?? "").toLowerCase() as CalloutData["variant"]
  const variant = CALLOUT_VARIANTS.has(requested) ? requested : "info"
  return { variant, title: block.attrs.title, body }
}

const noop = () => {}

export function XmlCallout({ xml }: { xml: string }) {
  const data = React.useMemo(() => parseCalloutXml(xml), [xml])
  if (!data) return null

  return (
    <div style={{ margin: "14px 0" }}>
      <AnimatedCallout data={data} onComplete={noop} />
    </div>
  )
}
