"use client"

import React from "react"
import { Columns3 } from "lucide-react"
import { Badge } from "@/components/Badge"
import { parseKanbanXml } from "./XmlKanban.parse"
import { ChatWidgetShell } from "./ChatWidgetShell"
import styles from "./ChatWidget.module.css"

export function XmlKanban({ xml }: { xml: string }) {
  const kanban = React.useMemo(() => parseKanbanXml(xml), [xml])
  if (!kanban) return null
  const count = kanban.columns.reduce((total, column) => total + column.cards.length, 0)
  return <ChatWidgetShell title={kanban.title || "Task board"} eyebrow="Board" icon={<Columns3 size={18} />} actions={<Badge color="Neutral" label={`${count} ${count === 1 ? "card" : "cards"}`} />}>
    <div className={`kaya-scrollbar ${styles.content}`} style={{ display: "flex", gap: 12, overflowX: "auto" }}>
      {kanban.columns.map((column, index) => <section aria-label={column.label} key={`${column.label}-${index}`} style={{ flex: "0 0 220px", padding: 12, background: "var(--neutral-50)", border: "1px solid var(--neutral-100)", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}><h4 className={styles.title}>{column.label}</h4><Badge color="Neutral" label={String(column.cards.length)} /></div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {column.cards.map((card, cardIndex) => <li key={`${card.title}-${cardIndex}`} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--neutral-100)", background: "var(--neutral-white)", overflowWrap: "anywhere" }}>
            <div className={styles.title}>{card.title}</div>
            {card.sub && <div className={styles.caption} style={{ marginTop: 4 }}>{card.sub}</div>}
            {card.tag && <Badge color="Neutral" label={card.tag} style={{ marginTop: 8 }} />}
          </li>)}
        </ul>
        {column.cards.length === 0 && <p className={styles.caption}>No cards yet</p>}
      </section>)}
    </div>
  </ChatWidgetShell>
}
