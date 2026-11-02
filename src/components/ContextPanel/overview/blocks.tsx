'use client'

import React, { useId, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { CAPTION, EASE, ONE_LINE, ROW_CLASS, TEXT, TWO_LINES } from './styles'

// ── Building blocks ───────────────────────────────────────────────────────────

/** The one card every section sits in, divided by hairlines. */
export function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        borderRadius:    16,
        backgroundColor: 'var(--card-bg)',
        boxShadow:       'inset 0 0 0 1px var(--neutral-200)',
        overflow:        'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function PanelSection({
  title,
  count,
  aside,
  action,
  open,
  onToggle,
  first,
  loading,
  children,
}: {
  title:    string
  count?:   number
  /** Shown in the header, so it stays visible while the section is collapsed. */
  aside?:   React.ReactNode
  /** A header control of its own, e.g. "Download all". */
  action?:  React.ReactNode
  open:     boolean
  onToggle: () => void
  first?:   boolean
  /** Sweep a hairline along the header's bottom edge — visible open or collapsed. */
  loading?: boolean
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const bodyId = useId()
  // A body already open on first paint appears in place; every later open slides. This is
  // per element on purpose — AnimatePresence initial={false} would also block the mount
  // animation of everything inside the body for its whole life, freezing spinners and the
  // progress sweep.
  const [animateEntry, setAnimateEntry] = useState(!open)
  const toggle = () => {
    setAnimateEntry(true)
    onToggle()
  }
  return (
    <section style={{ borderTop: first ? undefined : '1px solid var(--border-default)' }}>
      {/* The toggle covers the whole header; the visible pieces sit over it, inert, so only
          `action` is a separate target. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 10px 0 14px' }}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className="bg-transparent hover:bg-[color-mix(in_srgb,var(--neutral-200)_50%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue-500)]"
          style={{ position: 'absolute', inset: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer', transition: 'background-color 150ms ease' }}
        >
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{title}</span>
        </button>
        <h3 aria-hidden style={{ ...TEXT, color: 'var(--neutral-600)', pointerEvents: 'none', position: 'relative' }}>{title}</h3>
        {count !== undefined && count > 0 && (
          <span aria-hidden style={{ ...CAPTION, position: 'relative', pointerEvents: 'none', minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--border-default)', color: 'var(--neutral-600)' }}>
            {count}
          </span>
        )}
        <div style={{ flex: '1 1 0' }} />
        {aside && <span style={{ ...CAPTION, position: 'relative', pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{aside}</span>}
        {action && <span style={{ position: 'relative', display: 'inline-flex' }}>{action}</span>}
        <m.span
          aria-hidden
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE }}
          style={{ position: 'relative', pointerEvents: 'none', display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-500)' }}
        >
          <ArrowDownOneIcon size={16} />
        </m.span>
        {loading && <LoadingLine />}
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            key="body"
            id={bodyId}
            initial={animateEntry ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.18 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px 10px' }}>
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/** One line item. A link when given `href`, a button when given `onClick`. */
export function ItemRow({
  icon,
  label,
  detail,
  right,
  href,
  onClick,
  labelStyle,
  wrap,
}: {
  icon:        React.ReactNode
  label:       React.ReactNode
  detail?:     string
  right?:      React.ReactNode
  href?:       string
  onClick?:    () => void
  labelStyle?: React.CSSProperties
  /** Let the label run to two lines instead of one. */
  wrap?:       boolean
}) {
  const body = (
    <>
      <span aria-hidden style={{ minWidth: 20, minHeight: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-500)' }}>
        {icon}
      </span>
      <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ ...TEXT, ...(wrap ? TWO_LINES : ONE_LINE), ...labelStyle }}>{label}</span>
        {detail && <span style={{ ...CAPTION, ...ONE_LINE }}>{detail}</span>}
      </span>
      {right && <span style={{ ...CAPTION, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{right}</span>}
    </>
  )
  const style: React.CSSProperties = {
    display:        'flex',
    alignItems:     wrap ? 'flex-start' : 'center',
    gap:            10,
    width:          '100%',
    minWidth:       0,
    padding:        '6px 6px',
    borderRadius:   8,
    border:         0,
    textAlign:      'left',
    textDecoration: 'none',
    color:          'inherit',
    transition:     'background-color 150ms ease',
  }
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={`group ${ROW_CLASS}`} style={style}>{body}</a>
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={`group ${ROW_CLASS}`} style={{ ...style, cursor: 'pointer' }}>{body}</button>
  }
  return <div style={style}>{body}</div>
}

/** Rows that slide in as they arrive. Rows present on first paint don't animate — decided
 *  per row, not with AnimatePresence initial={false} (see PanelSection for why). */
export function AnimatedList({ children }: { children: React.ReactNode[] }) {
  const reduceMotion = useReducedMotion()
  const [firstKeys] = useState(() => new Set<React.Key | null>(React.Children.map(children, child => (React.isValidElement(child) ? child.key : null))))
  return (
    <AnimatePresence>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child
        return (
          <m.div
            key={child.key}
            initial={firstKeys.has(child.key) ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE }}
          >
            {child}
          </m.div>
        )
      })}
    </AnimatePresence>
  )
}

export const EmptyHint = ({ children }: { children: React.ReactNode }) => (
  <p style={{ ...CAPTION, padding: '4px 6px 2px' }}>{children}</p>
)

export function MoreButton({ hidden, expanded, onClick, noun }: { hidden: number; expanded: boolean; onClick: () => void; noun: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={ROW_CLASS}
      style={{ ...CAPTION, alignSelf: 'flex-start', marginTop: 2, padding: '4px 6px', border: 0, borderRadius: 6, cursor: 'pointer', color: 'var(--neutral-600)' }}
    >
      {expanded ? 'Show less' : `Show ${hidden} ${noun}`}
    </button>
  )
}

/** A hairline sweep along a section header's bottom edge — "this is still loading". */
function LoadingLine() {
  const reduceMotion = useReducedMotion()
  return (
    <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* x is a share of the segment's own width (30% of the line): -100% starts it just off
          the left edge, 334% just off the right. A transform, not `left`, which framer won't
          sweep between percentage keyframes. */}
      <m.span
        initial={{ x: reduceMotion ? '0%' : '-100%' }}
        animate={reduceMotion ? { x: '0%' } : { x: ['-100%', '334%'] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position:        'absolute',
          top:             0,
          bottom:          0,
          left:            0,
          width:           '30%',
          borderRadius:    2,
          backgroundImage: 'linear-gradient(90deg, transparent, var(--blue-500), transparent)',
          opacity:         reduceMotion ? 0.5 : 0.9,
        }}
      />
    </span>
  )
}
