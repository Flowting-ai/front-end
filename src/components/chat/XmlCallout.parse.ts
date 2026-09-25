/**
 * XmlCallout.parse.ts
 *
 * Pure parsing for the <callout> XML block, split out from XmlCallout.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

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
