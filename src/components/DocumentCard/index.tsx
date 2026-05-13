'use client'

import React from 'react'
import { Badge } from '@/components/Badge'
import type { BadgeColor } from '@/components/Badge'

// ── File type → badge color ───────────────────────────────────────────────────

function fileBadgeColor(type: string): BadgeColor {
  const t = type.toUpperCase()
  if (t === 'PDF')                  return 'Red'
  if (t === 'FIG')                  return 'Blue'
  if (t === 'DOC' || t === 'DOCX') return 'Blue'
  if (t === 'MD')                   return 'Neutral'
  if (t === 'URL')                  return 'Green'
  return 'Neutral'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentCardProps {
  name:       string
  type:       string
  sizeLabel:  string
  onRemove?:  () => void
  onClick?:   () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DocumentCard = React.forwardRef<HTMLDivElement, DocumentCardProps>(
  function DocumentCard({ name, type, sizeLabel, onRemove, onClick }, ref) {
    return (
      <div
        ref={ref}
        onClick={onClick}
        style={{
          display:         'flex',
          flexDirection:   'column',
          justifyContent:  'space-between',
          gap:             '24px',
          padding:         '12px',
          borderRadius:    '12px',
          background:      'var(--neutral-white)',
          border:          '1px solid var(--neutral-100)',
          boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.10), 0px 0px 0px 1px rgba(59,54,50,0.06)',
          cursor:          onClick ? 'pointer' : 'default',
          boxSizing:       'border-box',
        }}
      >
        {/* File name */}
        <p
          style={{
            fontFamily:  'var(--font-body)',
            fontWeight:  'var(--font-weight-medium)',
            fontSize:    '14px',
            lineHeight:  '22px',
            color:       '#1a1714',
            margin:      0,
            wordBreak:   'break-word',
            overflowWrap:'break-word',
          }}
        >
          {name}
        </p>

        {/* Footer: badge + optional remove */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge
            label={`${type} • ${sizeLabel}`}
            color={fileBadgeColor(type)}
          />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label={`Remove ${name}`}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                width:          '20px',
                height:         '20px',
                padding:        0,
                border:         'none',
                background:     'none',
                cursor:         'pointer',
                color:          '#a39b95',
                borderRadius:   '4px',
                flexShrink:     0,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  },
)

DocumentCard.displayName = 'DocumentCard'
export default DocumentCard
