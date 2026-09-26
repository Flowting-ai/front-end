/**
 * XmlSteps.parse.ts
 *
 * Pure parsing for the <steps> XML block, split out from XmlSteps.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

import { scanTags } from "@/lib/xml-widgets"
import type { StepsData } from "@/types/chat"

export function parseStepsXml(xml: string): StepsData | null {
  const [block] = scanTags(xml, "steps")
  if (!block) return null
  const steps = scanTags(block.inner, "step")
    .map(({ attrs }) => ({ label: attrs.label ?? "", description: attrs.description }))
    .filter((step) => step.label)
  if (steps.length === 0) return null
  return { title: block.attrs.title, steps }
}
