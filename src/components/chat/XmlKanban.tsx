"use client"

import React from "react"
import { Columns3 } from "lucide-react"
import { Badge } from "@/components/Badge"
import { parseKanbanXml } from "./XmlKanban.parse"
import { ChatWidgetShell } from "./ChatWidgetShell"
import styles from "./ChatWidget.module.css"

// Each column gets its own accent so the board reads at a glance; they repeat after five.
const COLUMN_ACCENTS = ["var(--widget-accent)", "var(--yellow-500)", "var(--green-500)", "var(--purple-500)", "var(--red-500)"]

export function XmlKanban({ xml }: { xml: string }) {
  const kanban = React.useMemo(() => parseKanbanXml(xml), [xml])
  if (!kanban) return null
  const count = kanban.columns.reduce((total, column) => total + column.cards.length, 0)
  return <ChatWidgetShell title={kanban.title || "Task board"} eyebrow="Board" icon={<Columns3 size={18} />} actions={<Badge color="Neutral" label={`${count} ${count === 1 ? "card" : "cards"}`} />}>
    <div className={`kaya-scrollbar ${styles.board}`}>
      {kanban.columns.map((column, index) => {
        const accent = COLUMN_ACCENTS[index % COLUMN_ACCENTS.length]
        return <section aria-label={column.label} key={`${column.label}-${index}`} className={styles.column} style={{ ["--dot" as string]: accent }}>
          <div className={styles.columnHead}>
            <span className={styles.columnDot} aria-hidden="true" />
            <h4 className={styles.columnName}>{column.label}</h4>
            <span className={styles.columnCount}>{column.cards.length}</span>
          </div>
          {column.cards.length === 0
            ? <p className={styles.emptyColumn}>No cards yet</p>
            : <ul className={styles.cards}>
              {column.cards.map((card, cardIndex) => <li key={`${card.title}-${cardIndex}`} className={styles.card}>
                <div className={styles.cardTitle}>{card.title}</div>
                {card.sub && <div className={styles.caption} style={{ marginTop: 3 }}>{card.sub}</div>}
                {card.tag && <span className={styles.cardTag}>{card.tag}</span>}
              </li>)}
            </ul>}
        </section>
      })}
    </div>
  </ChatWidgetShell>
}
