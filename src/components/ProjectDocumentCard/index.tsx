'use client'

/**
 * ProjectDocumentCard: one project file, styled like a chat output card (ChatOutputCard): format
 * glyph, name, "Format · .ext · size", then remove. The Files card grows by one card per file.
 */

import { Tooltip } from '@/components/Tooltip'
import * as React from 'react'
import { m } from 'framer-motion'
import { CancelOneIcon } from '@strange-huge/icons'
import { FormatGlyph } from '@/components/Library/FormatGlyph'
import { formatLabel } from '@/lib/library/format'
import { extensionOf } from '@/lib/library/upload/validate'
import type { Format } from '@/lib/library/schemas'

//

// The Library format for a project file, so it gets the same glyph and label as a chat output card.
const FORMAT_BY_EXT: Record<string, Format> = {
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', ods: 'sheet',
  ppt: 'slides', pptx: 'slides', key: 'slides', odp: 'slides',
  html: 'web', htm: 'web',
  eml: 'email', msg: 'email',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
}

/** Trusts an already-known type (`ProjectFile.type`) and falls back to the name for optimistic uploads. */
function fileFormat(name: string, fileType?: string): { format: Format; ext: string } {
  const ext = (fileType || extensionOf(name)).toLowerCase()
  return { format: FORMAT_BY_EXT[ext] ?? 'text', ext }
}

const NAME_STYLE: React.CSSProperties = { display: 'block', fontSize: 14, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

//

export interface ProjectDocumentCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  name:       string
  sizeLabel?: string
  /** Already-known file type (e.g. `ProjectFile.type`) - drives the badge
   *  label/color directly instead of re-parsing `name`. Omit for optimistic
   *  upload rows, which don't have one yet. */
  fileType?:  string
  /** Download/view URL for the uploaded file. When present, the filename opens
   *  it in a new tab - absent for optimistic upload rows, which have no server
   *  URL yet. */
  url?:       string
  /** Shows a spinner instead of remove button - for optimistic upload rows. */
  uploading?: boolean
  onRemove?:  React.MouseEventHandler<HTMLButtonElement>
}

//

export function ProjectDocumentCard(
  { name, sizeLabel, fileType, url, uploading, onRemove, style, onMouseEnter, onMouseLeave, ref, ...props }: ProjectDocumentCardProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const [removeButtonFocused, setRemoveButtonFocused] = React.useState(false)

    const { format, ext } = fileFormat(name, fileType)

    return (
      <m.div
        ref={ref}
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
        {/* Same card as a file Souvenir made in chat (ChatOutputCard): format glyph, name, then
            "Format · .ext · size", with remove (or the upload spinner) at the end. */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '10px 8px 10px 12px',
            border:       '1px solid var(--border-default)',
            borderRadius: 14,
            background:   uploading ? 'var(--neutral-100)' : 'var(--field-surface)',
            fontFamily:   'var(--font-body)',
            boxSizing:    'border-box',
            width:        '100%',
            transition:   'background 200ms',
          }}
        >
          <FormatGlyph format={format} size="md" />
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            {url ? (
              <Tooltip content={`Open ${name}`} maxWidth={280}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ ...NAME_STYLE, textDecoration: 'none' }}>
                  {name}
                </a>
              </Tooltip>
            ) : (
              <span style={{ ...NAME_STYLE, color: uploading ? 'var(--neutral-600)' : NAME_STYLE.color }}>{name}</span>
            )}
            <small style={{ fontSize: 12, color: 'var(--neutral-600)' }}>
              {[formatLabel(format), ext ? `.${ext}` : null, sizeLabel].filter(Boolean).join(' · ')}
            </small>
          </span>
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
      </m.div>
    )
}

ProjectDocumentCard.displayName = 'ProjectDocumentCard'
export default ProjectDocumentCard
