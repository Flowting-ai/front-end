'use client'

/**
 * ProjectDocumentCard â€“ full-width list-item card for project file panels.
 *
 * Design language mirrors ChatThumbnail (same CARD_SHADOW, framer-motion
 * entry/exit, hover-revealed remove button) but laid out as a horizontal
 * two-row card that fills the panel width.
 *
 *   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 *   â”‚  filename.pdf truncatedâ€¦          [Ã—] â”‚
 *   â”‚  [PDF â€¢ 1.2 MB]                        â”‚
 *   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 *
 * Figma: KDS 4174-23401 (Document cards, project variant)
 */

import * as React from 'react'
import { m } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'

// â”€â”€ File-extension â†’ badge colour (mirrors ChatThumbnail) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FILE_EXT_COLOR: Record<string, BadgeColor> = {
  pdf:  'Red',
  docx: 'Blue',
  doc:  'Blue',
  txt:  'Neutral',
  xls:  'Green',
  xlsx: 'Green',
  csv:  'Green',
  ppt:  'Brown',
  pptx: 'Brown',
  html: 'Neutral',
  htm:  'Neutral',
  md:   'Neutral',
  json: 'Neutral',
  png:  'Neutral',
  jpg:  'Neutral',
  jpeg: 'Neutral',
  gif:  'Neutral',
  svg:  'Blue',
  zip:  'Brown',
}

function extractExt(name: string): { ext: string; color: BadgeColor } {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return { ext: ext.toUpperCase() || 'FILE', color: FILE_EXT_COLOR[ext] ?? 'Neutral' }
}

const CARD_SHADOW =
  '0px 4px 4px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ProjectDocumentCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  name:       string
  sizeLabel?: string
  /** Shows a spinner instead of remove button â€“ for optimistic upload rows. */
  uploading?: boolean
  onRemove?:  React.MouseEventHandler<HTMLButtonElement>
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ProjectDocumentCard(
  { name, sizeLabel, uploading, onRemove, style, onMouseEnter, onMouseLeave, ref, ...props }: ProjectDocumentCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [removeButtonFocused, setRemoveButtonFocused] = React.useState(false)

    const { ext, color } = extractExt(name)
    const badgeLabel = ext

    return (
      <m.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.97, filter: 'blur(2px)' }}
        animate={{
          opacity: 1, scale: 1, filter: 'blur(0px)',
          transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        }}
        exit={{
          opacity: 0, scale: 0.97, filter: 'blur(2px)',
          transition: { duration: 0.18, ease: [0.55, 0.085, 0.68, 0.53] },
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ position: 'relative', width: '100%', ...style }}
        {...(props as Record<string, unknown>)}
      >
        <div
          style={{
            display:         'flex',
            flexDirection:   'column',
            gap:             '6px',
            padding:         '10px 12px',
            borderRadius:    '14px',
            background:      uploading ? 'var(--neutral-50)' : 'var(--neutral-white)',
            boxShadow:       CARD_SHADOW,
            boxSizing:       'border-box',
            width:           '100%',
            transition:      'background 200ms',
          }}
        >
          {/* Filename + action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p
              style={{
                flex:         '1 0 0',
                minWidth:     0,
                margin:       0,
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-medium)',
                fontSize:     '13px',
                lineHeight:   '18px',
                color:        uploading ? 'var(--neutral-600)' : 'var(--neutral-900)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                transition:   'color 200ms',
              }}
            >
              {name}
            </p>

            {/* Uploading spinner */}
            {uploading && (
              <svg
                aria-label="Uploading"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0, color: 'var(--neutral-500)', animation: 'spin 1s linear infinite' }}
              >
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <path
                  d="M8 1.5A6.5 6.5 0 1 1 1.5 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/* Remove button */}
            {!uploading && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${name}`}
                tabIndex={0}
                onFocus={(e) => {
                  if (typeof e.target.matches === 'function' && e.target.matches(':focus-visible')) {
                    setRemoveButtonFocused(true)
                  }
                }}
                onBlur={() => setRemoveButtonFocused(false)}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  width:           22,
                  height:          22,
                  flexShrink:      0,
                  padding:         3,
                  border:          'none',
                  borderRadius:    6,
                  background:      'none',
                  cursor:          'pointer',
                  color:           'var(--neutral-400)',
                  outlineStyle:    'solid',
                  outlineWidth:    '2px',
                  outlineOffset:   '1px',
                  outlineColor:    removeButtonFocused ? 'var(--focus-ring)' : 'transparent',
                  transition:      'color 150ms, outline-color 150ms',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--neutral-700)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--neutral-400)' }}
              >
                <CancelOneIcon size={16} color="currentColor" />
              </button>
            )}
          </div>

          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Badge label={badgeLabel} color={uploading ? 'Neutral' : color} />
            {sizeLabel && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   '12px',
                  lineHeight: '16px',
                  color:      'var(--neutral-600)',
                }}
              >
                {sizeLabel}
              </span>
            )}
          </div>
        </div>
      </m.div>
    )
}

ProjectDocumentCard.displayName = 'ProjectDocumentCard'
export default ProjectDocumentCard
