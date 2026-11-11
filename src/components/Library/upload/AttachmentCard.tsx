'use client'

import React from 'react'
import { CancelOneIcon, CheckmarkCircleTwoIcon, AlertCircleIcon, LoadingOneIcon } from '@strange-huge/icons'
import { formatBytes, formatLabel, sanitizeDisplayText } from '@/lib/library/format'
import { statusLabel, type UploadItem } from '@/lib/library/upload/machine'
import { FormatGlyph } from '../FormatGlyph'

/**
 * One attachment in the composer: its name and file type, a status word with an icon (never colour
 * alone), a progress bar while uploading, and a button to remove it. Only this card re-renders as
 * its upload progresses (the parent passes the item from a per-draft selector).
 */
export function AttachmentCard({ item, onCancel }: { item: UploadItem; onCancel: (id: string) => void }) {
  const name = sanitizeDisplayText(item.name) || 'Untitled'
  const label = statusLabel(item)
  // A processing file is already uploaded: the server cannot cancel it and it will land in the Library.
  const finishing = item.status === 'processing'
  const icon =
    item.status === 'ready' ? <CheckmarkCircleTwoIcon size={14} /> :
    item.status === 'failed' ? <AlertCircleIcon size={14} /> :
    <LoadingOneIcon size={14} />
  return (
    <div
      role="group"
      aria-label={`Attachment ${name}`}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, width: 232, boxSizing: 'border-box', padding: '8px 36px 8px 10px', borderRadius: 12, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)' }}
    >
      {item.format ? <FormatGlyph format={item.format} /> : <span aria-hidden="true" style={{ width: 32, height: 32 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span title={name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)' }}>{name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>
          <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>
          <span>{item.format ? `${formatLabel(item.format)}, ` : ''}{formatBytes(item.sizeBytes)}</span>
        </span>
        <span aria-live="polite" style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: item.status === 'failed' ? 'var(--color-tag-Red-text)' : 'var(--neutral-600)' }}>{label}</span>
      </div>
      {item.status === 'uploading' && (
        <div
          role="progressbar"
          aria-label={`Uploading ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(item.progress * 100)}
          style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 3, borderRadius: 2, background: 'var(--neutral-100)', overflow: 'hidden' }}
        >
          {/* The width is a CSS variable, so the class string stays static. */}
          <div style={{ ['--progress' as string]: `${item.progress * 100}%`, width: 'var(--progress)', height: '100%', background: 'var(--neutral-900)' } as React.CSSProperties} />
        </div>
      )}
      <button
        type="button"
        onClick={() => onCancel(item.id)}
        disabled={finishing}
        aria-label={finishing ? `${name}: already uploaded, finishing processing` : `Remove ${name}`}
        title={finishing ? 'Already uploaded — finishing processing' : undefined}
        style={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--neutral-500)', cursor: finishing ? 'not-allowed' : 'pointer', opacity: finishing ? 0.4 : 1 }}
      >
        <CancelOneIcon size={12} />
      </button>
    </div>
  )
}
