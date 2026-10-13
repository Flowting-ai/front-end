'use client'

import React from 'react'
import { CancelOneIcon, FolderLibraryIcon } from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { Switch } from '@/components/Switch'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import type { SourceRow } from '@/lib/library/sources'
import { FormatGlyph } from '../FormatGlyph'
import { InfoTip } from '../InfoTip'
import { LockGlyph } from './LockGlyph'
import styles from './LibraryChat.module.css'

export interface SourcesPanelProps {
  /** From `buildSourceRows` (lib/library/sources.ts). */
  rows: SourceRow[]
  /** Switch a file off (or back on) for the rest of this chat. */
  onToggle: (fileId: string) => void
  onClose: () => void
}

/** Every file this chat can use: what each one is (cited, attached, found), with a per-file off switch. */
export function SourcesPanel({ rows, onToggle, onClose }: SourcesPanelProps) {
  return (
    <aside className={styles.panel} aria-label={CHAT_MESSAGES.sources}>
      <div className={styles.panelHead}>
        <h3>{CHAT_MESSAGES.sources}</h3>
        <IconButton variant="ghost" size="sm" aria-label={CHAT_MESSAGES.closeSources} icon={<CancelOneIcon size={16} />} onClick={onClose} />
      </div>
      <div className={styles.panelBody}>
        <div className={styles.group}>
          <h4>
            {CHAT_MESSAGES.filesInThisChat}
            <InfoTip text={CHAT_MESSAGES.sourcesOffTip} />
          </h4>
          {rows.length === 0 && <p className={styles.explain}>{CHAT_MESSAGES.noFilesYet}</p>}
          {rows.map((row) => (
            <div className={`${styles.row} ${row.off ? styles.off : ''}`} key={row.id}>
              {row.ref?.state === 'open' ? (
                <FormatGlyph format={row.ref.format} size="sm" />
              ) : (
                <span className={styles.tile} aria-hidden="true"><LockGlyph size={16} /></span>
              )}
              <span className={styles.grow}>
                <span>{row.name}</span>
                <small>{row.detail}</small>
              </span>
              {row.canToggle && (
                <Switch checked={!row.off} aria-label={`Use ${row.name} in answers`} onCheckedChange={() => onToggle(row.id)} />
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

/** The chat header button that opens the panel: "Sources · 3". */
export function SourcesButton({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" aria-pressed={open} leftIcon={<FolderLibraryIcon size={16} />} onClick={onClick}>
      {CHAT_MESSAGES.sources}{count ? ` · ${count}` : ''}
    </Button>
  )
}
