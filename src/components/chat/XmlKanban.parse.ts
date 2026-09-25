/**
 * XmlKanban.parse.ts
 *
 * Pure parsing for the <kanban> XML block, split out from XmlKanban.tsx so
 * that file only exports the component (Fast Refresh can't safely preserve
 * component state in a file that also exports non-component values).
 */

import { scanTags } from "@/lib/xml-widgets"

export interface ParsedKanban {
  title?: string
  columns: Array<{
    label: string
    cards: Array<{ title: string; sub?: string; tag?: string }>
  }>
}

export function parseKanbanXml(xml: string): ParsedKanban | null {
  const [kanban] = scanTags(xml, "kanban")
  if (!kanban) return null
  const columns = scanTags(kanban.inner, "column")
    .filter((c) => c.attrs.label)
    .map((c) => ({
      label: c.attrs.label,
      cards: scanTags(c.inner, "card")
        .filter((card) => card.attrs.title)
        .map((card) => ({ title: card.attrs.title, sub: card.attrs.sub, tag: card.attrs.tag })),
    }))
  if (columns.length === 0) return null
  return { title: kanban.attrs.title, columns }
}
