/**
 * XmlFunnel.parse.ts
 *
 * Pure parsing for the <funnel> XML block, split out from XmlFunnel.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

import { scanTags } from "@/lib/xml-widgets"

export interface ParsedFunnel {
  title?: string
  stages: Array<{ label: string; value: number }>
}

export function parseFunnelXml(xml: string): ParsedFunnel | null {
  const [funnel] = scanTags(xml, "funnel")
  if (!funnel) return null
  const stages = scanTags(funnel.inner, "stage")
    .map(({ attrs }) => ({ label: attrs.label ?? "", value: Number(attrs.value) }))
    .filter((s) => s.label && Number.isFinite(s.value) && s.value >= 0)
  if (stages.length === 0) return null
  return { title: funnel.attrs.title, stages }
}
