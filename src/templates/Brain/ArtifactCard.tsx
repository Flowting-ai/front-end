'use client'

import React from 'react'
import { m } from 'framer-motion'
import { ArrowRightOneIcon, FileTwoIcon } from '@strange-huge/icons'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ArtifactCardProps {
  /** Icon to show on the left — defaults to a file icon. Pass size 20 icons. */
  icon?:    React.ReactNode
  /** Title of the artifact — e.g. "Q1 Friction Report" */
  title:    string
  /** Secondary metadata — e.g. "Notion · Saved 2 min ago" */
  meta?:    string
  /** Makes the card clickable — shows a right arrow indicator. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

// ── CARD_SHADOW ─────────────────────────────────────────────────────────────────
const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

// ── ArtifactCard ────────────────────────────────────────────────────────────────
/**
 * Inline full-width card representing a tangible output Brain produced:
 * a report, document, scheduled event, or saved item.
 *
 * Sits below the streaming output in the thread.
 */
export function ArtifactCard({ icon, title, meta, onClick }: ArtifactCardProps) {
  const defaultIcon = <FileTwoIcon size={20} color="var(--neutral-500)" />
  const isClickable = onClick != null

  const inner = (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             12,
      padding:         '12px 16px',
      borderRadius:    12,
      backgroundColor: 'var(--color-surface-glass)',
      boxShadow:       CARD_SHADOW,
      width:           '100%',
      textAlign:       'left',
    }}>
      {/* Icon */}
      <div style={{ flexShrink: 0, lineHeight: 0 }}>
        {icon ?? defaultIcon}
      </div>

      {/* Text */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           2,
        flex:          '1 0 0',
        minWidth:      0,
      }}>
        <span style={{
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body)',
          fontWeight:   'var(--font-weight-medium)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--neutral-800)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {title}
        </span>
        {meta && (
          <span style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-400)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {meta}
          </span>
        )}
      </div>

      {/* Right arrow for clickable variant */}
      {isClickable && (
        <div style={{ flexShrink: 0, lineHeight: 0 }}>
          <ArrowRightOneIcon size={16} color="var(--neutral-400)" />
        </div>
      )}
    </div>
  )

  if (!isClickable) return inner

  return (
    <m.button
      type="button"
      className="brain-artifact-card"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        display:      'block',
        width:        '100%',
        background:   'none',
        border:       'none',
        padding:      0,
        cursor:       'pointer',
        borderRadius: 12,
        // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
        outline:      'none',
      }}
    >
      {inner}
    </m.button>
  )
}

ArtifactCard.displayName = 'ArtifactCard'
