'use client'

import React from 'react'
import { m } from 'framer-motion'

// ── Template card list ────────────────────────────────────────────────────────
// Single-column stack of starter cards. Items fade + drift in one after another,
// using the same stagger/fade/drift values as the left-sidebar chat items
// (sectionStaggerVariants / sectionItemVariants in Sidebar/index.tsx).

const listVariants = {
  open:   { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
  closed: { transition: {} },
}

const itemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

export function TemplateCardList({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial="closed"
      animate="open"
      variants={listVariants}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
    >
      {React.Children.map(children, (child) => (
        <m.div variants={itemVariants} style={{ display: 'flex' }}>
          {child}
        </m.div>
      ))}
    </m.div>
  )
}

export default TemplateCardList
