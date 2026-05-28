'use client'

import React from 'react'
import { m } from 'framer-motion'
import { ArrowRightOneIcon, FileTwoIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'

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
  /** When set, shows "Draft v{N}" badge and a "See history" link. */
  draftVersion?: number
  /** Called when "See history" is clicked. */
  onViewHistory?: () => void
}

// ── CARD_SHADOW ─────────────────────────────────────────────────────────────────
const CARD_SHADOW = 'var(--shadow-card-default)'

// ── ArtifactCard ────────────────────────────────────────────────────────────────
/**
 * Inline full-width card representing a tangible output Brain produced:
 * a report, document, scheduled event, or saved item.
 *
 * Sits below the streaming output in the thread.
 */
export function ArtifactCard({ icon, title, meta, onClick, draftVersion, onViewHistory }: ArtifactCardProps) {
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
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {meta}
          </span>
        )}
        {draftVersion != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Badge color="Blue" label={`Draft v${draftVersion}`} />
            {onViewHistory && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onViewHistory() }}
                style={{
                  fontFamily:          'var(--font-body)',
                  fontSize:            'var(--font-size-caption)',
                  lineHeight:          'var(--line-height-caption)',
                  color:               'var(--neutral-400)',
                  background:          'none',
                  border:              'none',
                  padding:             0,
                  cursor:              'pointer',
                  textDecoration:      'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                See history
              </button>
            )}
          </div>
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
      className="brain-artifact-card brain-card-action"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
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
