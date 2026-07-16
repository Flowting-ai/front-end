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
import { m, useReducedMotion } from "framer-motion"
import { Columns3, Layers3 } from "lucide-react"
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
  const reduceMotion = Boolean(useReducedMotion())
  if (!kanban) return null

  const columnThemes = [
    { accent: "#496E8B", soft: "rgba(73, 110, 139, 0.10)" },
    { accent: "#A28847", soft: "rgba(162, 136, 71, 0.11)" },
    { accent: "#6D5C91", soft: "rgba(109, 92, 145, 0.10)" },
    { accent: "#287A47", soft: "rgba(40, 122, 71, 0.10)" },
  ]
  const cardCount = kanban.columns.reduce((total, column) => total + column.cards.length, 0)

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        margin: "14px 0",
        padding: "14px 14px 12px",
        borderRadius: 18,
        border: "1px solid rgba(73, 110, 139, 0.14)",
        background: "linear-gradient(135deg, #F2F6F8 0%, #FFFDFC 50%, #F1ECE7 100%)",
        boxShadow: "0 10px 28px rgba(82, 75, 71, 0.09), 0 2px 4px rgba(82, 75, 71, 0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <m.span
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            borderRadius: 11,
            color: "#496E8B",
            backgroundColor: "rgba(222, 235, 244, 0.78)",
            border: "1px solid rgba(73, 110, 139, 0.16)",
          }}
        >
          <Columns3 size={17} strokeWidth={1.8} />
        </m.span>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", color: "var(--neutral-500)" }}>Board</div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-body)", fontWeight: "var(--font-weight-semibold)", color: "var(--neutral-950)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {kanban.title || "Task board"}
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.62)", border: "1px solid rgba(82,75,71,0.10)", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-500)" }}>
          <Layers3 size={12} />
          {cardCount} {cardCount === 1 ? "card" : "cards"}
        </span>
      </div>

      <div className="kaya-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "1px 1px 5px" }}>
        {kanban.columns.map((column, ci) => {
          const theme = columnThemes[ci % columnThemes.length]!
          return (
          <m.div
            key={`${column.label}-${ci}`}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduceMotion ? 0 : ci * 0.07, duration: 0.3 }}
            style={{
              flex: "0 0 226px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 9,
              borderRadius: 13,
              backgroundColor: theme.soft,
              border: `1px solid ${theme.accent}20`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 24, padding: "0 2px" }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: theme.accent, boxShadow: `0 0 0 3px ${theme.accent}18` }} />
              <span
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--font-size-caption)",
                  fontWeight: "var(--font-weight-semibold)",
                  letterSpacing: "0.01em",
                  color: "var(--neutral-700)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {column.label}
              </span>
              <span style={{ minWidth: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.65)", border: "1px solid rgba(82,75,71,0.08)", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-500)" }}>
                {column.cards.length}
              </span>
            </div>
            {column.cards.map((card, i) => (
              <m.div
                key={`${card.title}-${i}`}
                initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={reduceMotion ? undefined : { y: -3, scale: 1.01 }}
                transition={{ delay: reduceMotion ? 0 : ci * 0.06 + i * 0.045, duration: 0.24 }}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  padding: "10px 11px 9px",
                  borderRadius: 11,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(82,75,71,0.10)",
                  boxShadow: "0 2px 6px rgba(82,75,71,0.07)",
                  overflow: "hidden",
                }}
              >
                <span aria-hidden style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: theme.accent, opacity: 0.72 }} />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--font-size-caption)", lineHeight: "18px", fontWeight: "var(--font-weight-medium)", color: "var(--neutral-900)" }}>
                  {card.title}
                </span>
                {card.sub && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, lineHeight: "16px", color: "var(--neutral-500)" }}>
                    {card.sub}
                  </span>
                )}
                {card.tag && (
                  <span
                    style={{
                      alignSelf:       "flex-start",
                      padding: "2px 7px",
                      borderRadius: 999,
                      backgroundColor: theme.soft,
                      border: `1px solid ${theme.accent}20`,
                      fontFamily: "var(--font-body)",
                      fontSize: 10,
                      color: theme.accent,
                    }}
                  >
                    {card.tag}
                  </span>
                )}
              </m.div>
            ))}
            {column.cards.length === 0 && (
              <div style={{ padding: "14px 8px", borderRadius: 10, border: `1px dashed ${theme.accent}30`, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--neutral-400)" }}>
                No cards yet
              </div>
            )}
          </m.div>
        )})}
      </div>
    </m.div>
  )
}
