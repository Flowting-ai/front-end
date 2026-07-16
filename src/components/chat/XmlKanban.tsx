"use client"

/**
 * XmlKanban.tsx
 *
 * Renders a <kanban>...</kanban> XML block from the assistant as a
 * horizontally scrolling board of columns and cards:
 *
 *   <kanban title="Sprint 14">
 *     <column label="To do">
 *       <card title="Fix login bug" sub="Alice · due Jul 20" tag="High"/>
 *     </column>
 *     <column label="Done">
 *       <card title="Ship connector page"/>
 *     </column>
 *   </kanban>
 *
 * See: docs/frontend-rendering.md - Kanban section.
 */

import React from "react"
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

export function XmlKanban({ xml }: { xml: string }) {
  const kanban = React.useMemo(() => parseKanbanXml(xml), [xml])
  if (!kanban) return null

  return (
    <div style={{ margin: "12px 0" }}>
      {kanban.title && (
        <div
          style={{
            marginBottom: 8,
            fontFamily:   "var(--font-body)",
            fontSize:     "var(--font-size-body)",
            fontWeight:   500,
            color:        "var(--neutral-900)",
          }}
        >
          {kanban.title}
        </div>
      )}
      <div className="kaya-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {kanban.columns.map((column, ci) => (
          <div
            key={`${column.label}-${ci}`}
            style={{
              flex:            "0 0 210px",
              display:         "flex",
              flexDirection:   "column",
              gap:             8,
              padding:         10,
              borderRadius:    10,
              backgroundColor: "var(--neutral-50)",
              border:          "1px solid var(--neutral-100)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontFamily:    "var(--font-body)",
                  fontSize:      "var(--font-size-caption)",
                  fontWeight:    500,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color:         "var(--neutral-500)",
                }}
              >
                {column.label}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-400)" }}>
                {column.cards.length}
              </span>
            </div>
            {column.cards.map((card, i) => (
              <div
                key={`${card.title}-${i}`}
                style={{
                  display:         "flex",
                  flexDirection:   "column",
                  gap:             4,
                  padding:         "8px 10px",
                  borderRadius:    8,
                  backgroundColor: "var(--neutral-white)",
                  border:          "1px solid var(--neutral-100)",
                  boxShadow:       "0px 1px 1.5px 0px rgba(82,75,71,0.08)",
                }}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", fontWeight: 500, color: "var(--neutral-900)" }}>
                  {card.title}
                </span>
                {card.sub && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-500)" }}>
                    {card.sub}
                  </span>
                )}
                {card.tag && (
                  <span
                    style={{
                      alignSelf:       "flex-start",
                      padding:         "1px 8px",
                      borderRadius:    999,
                      backgroundColor: "var(--neutral-100)",
                      fontFamily:      "var(--font-body)",
                      fontSize:        11,
                      color:           "var(--neutral-600)",
                    }}
                  >
                    {card.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
