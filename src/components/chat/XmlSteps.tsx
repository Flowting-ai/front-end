"use client"

/**
 * XmlSteps.tsx
 *
 * Renders a <steps>...</steps> XML block from the assistant as a numbered
 * procedure with a connector line down the left:
 *
 *   <steps title="Connecting Notion to Souvenir">
 *     <step label="Open Settings → Connectors" description="Tap your avatar, then Settings."/>
 *     <step label="Click Connect Notion"/>
 *   </steps>
 *
 * Parsing only — the visual is AnimatedSteps, shared with the response-block
 * renderer so both paths draw an identical list.
 * See: docs/ui/frontend-rendering.md - Steps section.
 */

import React from "react"
import { AnimatedSteps } from "@/components/chat/ResponseBlocks"
import { scanTags } from "@/lib/xml-widgets"
import type { StepsData } from "@/hooks/use-chat-state"

export function parseStepsXml(xml: string): StepsData | null {
  const [block] = scanTags(xml, "steps")
  if (!block) return null
  const steps = scanTags(block.inner, "step")
    .map(({ attrs }) => ({ label: attrs.label ?? "", description: attrs.description }))
    .filter((step) => step.label)
  if (steps.length === 0) return null
  return { title: block.attrs.title, steps }
}

const noop = () => {}

export function XmlSteps({ xml, animate }: { xml: string; animate?: boolean }) {
  const data = React.useMemo(() => parseStepsXml(xml), [xml])
  // Frozen at mount on purpose: `animate` flips when the stream ends, and
  // AnimatedSteps stops advancing its reveal if that happens mid-run, which
  // would leave the list half-drawn.
  const [animateOnMount] = React.useState(() => Boolean(animate))
  if (!data) return null

  return (
    <div style={{ margin: "14px 0" }}>
      <AnimatedSteps data={data} onComplete={noop} animate={animateOnMount} />
    </div>
  )
}
