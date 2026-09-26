/**
 * XmlTags.parse.ts
 *
 * Pure parsing for the <tags> XML block, split out from XmlTags.tsx so that
 * file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

import { scanTags } from "@/lib/xml-widgets"
import type { TagsData } from "@/types/chat"

export function parseTagsXml(xml: string): TagsData | null {
  const [block] = scanTags(xml, "tags")
  if (!block) return null
  const tags = scanTags(block.inner, "tag")
    .map(({ attrs }) => ({ label: attrs.label ?? "", color: attrs.color }))
    .filter((tag) => tag.label)
  if (tags.length === 0) return null
  return { title: block.attrs.title, tags }
}
