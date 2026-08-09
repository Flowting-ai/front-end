"use client"

/**
 * XmlTags.tsx
 *
 * Renders a <tags>...</tags> XML block from the assistant as a row of pills:
 *
 *   <tags title="Risk categories">
 *     <tag label="DS handoff timing" color="#C8920A"/>
 *     <tag label="Revamp scope creep"/>
 *   </tags>
 *
 * `color` is optional and must be a 6-digit hex; AnimatedTags falls back to its
 * cycling palette for anything else.
 * See: docs/ui/frontend-rendering.md - Tags section.
 */

import React from "react"
import { AnimatedTags } from "@/components/chat/ResponseBlocks"
import { scanTags } from "@/lib/xml-widgets"
import type { TagsData } from "@/hooks/use-chat-state"

export function parseTagsXml(xml: string): TagsData | null {
  const [block] = scanTags(xml, "tags")
  if (!block) return null
  const tags = scanTags(block.inner, "tag")
    .map(({ attrs }) => ({ label: attrs.label ?? "", color: attrs.color }))
    .filter((tag) => tag.label)
  if (tags.length === 0) return null
  return { title: block.attrs.title, tags }
}

const noop = () => {}

export function XmlTags({ xml, animate }: { xml: string; animate?: boolean }) {
  const data = React.useMemo(() => parseTagsXml(xml), [xml])
  const [animateOnMount] = React.useState(() => Boolean(animate))
  if (!data) return null

  return (
    <div style={{ margin: "14px 0" }}>
      <AnimatedTags data={data} onComplete={noop} animate={animateOnMount} />
    </div>
  )
}
