'use client'

import React from 'react'
import { FileTwoIcon } from '@strange-huge/icons'
import { ItemRow } from '@/components/ContextPanel/overview/blocks'
import { Skeleton } from '@/components/Skeleton'
import { Switch } from '@/components/Switch'
import type { SourceRow } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import { LockGlyph } from './LockGlyph'

export interface SourceFileRowProps {
  /** From `buildSourceRows` (lib/library/sources.ts). */
  row: SourceRow
  /** Switch the file off (or back on) for the rest of this chat. */
  onToggle: (fileId: string) => void
  /** Open the file beside the chat. Not offered for a deleted file. */
  onOpen?: (fileId: string) => void
}

/**
 * One Library file in the Context panel's Sources, laid out like the web-page rows under it: what
 * the file is (cited, attached, found, processing, locked, deleted, still loading) and its off switch.
 * A locked or deleted file never shows its name; a loading one shows "Loading…", never "File deleted".
 */
export function SourceFileRow({ row, onToggle, onOpen }: SourceFileRowProps) {
  const icon =
    row.status === 'loading' ? <Skeleton width={20} height={20} radius={6} /> :
    // The 24px tile, pulled in to the row's 20px icon column so names line up with the web rows.
    row.ref?.state === 'open' ? <span style={{ display: 'inline-flex', margin: -2 }}><FormatGlyph format={row.ref.format} size="xs" /></span> :
    row.status === 'locked' ? <LockGlyph size={16} /> :
    <FileTwoIcon size={16} />
  const muted = row.off || row.status === 'deleted' || row.status === 'loading'
  return (
    <div data-source-file={row.id} data-status={row.status} aria-busy={row.status === 'loading' || undefined}>
      <ItemRow
        icon={icon}
        label={row.name}
        detail={row.detail}
        labelStyle={muted ? { color: 'var(--neutral-500)', textDecoration: row.off ? 'line-through' : undefined } : undefined}
        onClick={onOpen && row.status !== 'deleted' ? () => onOpen(row.id) : undefined}
        trailing={row.canToggle && (
          <Switch checked={!row.off} aria-label={`Use ${row.name} in answers`} onCheckedChange={() => onToggle(row.id)} />
        )}
      />
    </div>
  )
}
