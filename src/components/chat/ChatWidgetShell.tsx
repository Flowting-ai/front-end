"use client"

import type { ReactNode } from "react"
import { m, useReducedMotion } from "framer-motion"
import styles from "./ChatWidget.module.css"

/** Shared KDS surface for inline assistant widgets. */
export function ChatWidgetShell({ title, eyebrow, icon, actions, children }: {
  title: string; eyebrow?: string; icon: ReactNode; actions?: ReactNode; children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <m.section className={styles.shell} aria-label={title}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true">{icon}</span>
        <div className={styles.heading}>
          {eyebrow && <div className={styles.caption}>{eyebrow}</div>}
          <h3 className={styles.title}>{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </m.section>
  )
}
