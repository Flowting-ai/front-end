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
import { parseCalloutXml } from "@/components/chat/XmlCallout.parse"

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
