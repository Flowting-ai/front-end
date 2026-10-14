'use client'

import React from 'react'
import Link from 'next/link'
import {
  AlertTwoIcon,
  ArrowRightOneIcon,
  BubbleChatIcon,
  CancelCircleIcon,
  CancelOneIcon,
  CheckmarkCircleTwoIcon,
  PlusSignIcon,
  TestTubeIcon,
} from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { formatLabel } from '@/lib/library/format'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import { DEFAULT_QUERY, patchQuery, toLibraryHref } from '@/lib/library/query-params'
import type { Format } from '@/lib/library/schemas'
import type { LibraryFile } from '@/lib/library/file'
import { attachmentRowText, runKindLabel, unavailableNote, type RoutineAttachment, type RunKind } from '@/lib/library/sources'
import { LIBRARY_FILE_ROUTE, LIBRARY_ROUTE } from '@/lib/routes'
import { FormatGlyph } from '../FormatGlyph'
import { useAddFromLibrary } from '../chat/useAddFromLibrary'
import styles from './Routines.module.css'

/** All files filtered to Source: Generated, where every run output lives (no separate view). */
export const RUN_OUTPUTS_HREF = toLibraryHref(LIBRARY_ROUTE, patchQuery(DEFAULT_QUERY, { tab: 'all', source: ['generated'] }))

// ── Paused ───────────────────────────────────────────────────────────────────

/** The routine's owner left: it waits for a new owner. Resume only for whoever owns it now. */
export function RoutinePausedNote({ canResume, onResume }: { canResume: boolean; onResume: () => void }) {
  return (
    <div className={`${styles.warn} ${styles.warnCenter}`} role="status">
      <AlertTwoIcon size={16} />
      <span className={styles.warnText}>{CHAT_MESSAGES.pausedNote}</span>
      {canResume && <Button variant="secondary" size="sm" onClick={onResume}>{CHAT_MESSAGES.resume}</Button>}
    </div>
  )
}

// ── Unavailable files ────────────────────────────────────────────────────────

/** "Return policy 2026 is unavailable. The next run skips it." Nothing when every file is usable. */
export function RoutineUnavailableNote({ files }: { files: RoutineAttachment[] }) {
  const text = unavailableNote(files)
  if (!text) return null
  return (
    <div className={styles.warn} role="status">
      <AlertTwoIcon size={16} />
      <span className={styles.warnText}>{text}</span>
    </div>
  )
}

// ── Attached files ───────────────────────────────────────────────────────────

export interface RoutineAttachedFilesProps {
  routineTitle: string
  files: RoutineAttachment[]
  /** Only the routine's owner adds or removes files. */
  canEdit: boolean
  onAdd: (files: LibraryFile[]) => void
  onRemove: (fileId: string) => void
}

/** Files every run reads. Add files opens the Library picker; an unusable file stays listed with "Next run skips it". */
export function RoutineAttachedFiles({ routineTitle, files, canEdit, onAdd, onRemove }: RoutineAttachedFilesProps) {
  const picker = useAddFromLibrary({ excludeIds: files.map((file) => file.id), confirmLabel: 'Attach', onAdd })
  return (
    <section className={styles.section} aria-label={CHAT_MESSAGES.attachedFiles}>
      <h4>
        {CHAT_MESSAGES.attachedFiles}
        {canEdit && (
          <Button variant="ghost" size="sm" leftIcon={<PlusSignIcon size={14} />} onClick={picker.open}>{CHAT_MESSAGES.addFiles}</Button>
        )}
      </h4>
      {files.length === 0 && <p className={styles.empty}>{CHAT_MESSAGES.noFilesAttached}</p>}
      {files.map((file) => {
        const text = attachmentRowText(file, formatLabel)
        const ok = file.state === 'ok'
        return (
          <div className={styles.row} key={file.id}>
            {ok && file.format ? <FormatGlyph format={file.format} size="sm" /> : <span className={styles.tile} aria-hidden="true"><AlertTwoIcon size={16} /></span>}
            {ok ? (
              <Link className={styles.rowLink} href={LIBRARY_FILE_ROUTE(file.id)}>
                <span>{text.name}</span>
                <small>{text.detail}</small>
              </Link>
            ) : (
              <span className={styles.rowLink} aria-disabled="true">
                <span>{text.name}</span>
                <small>{text.detail}</small>
              </span>
            )}
            {canEdit && (
              <IconButton
                variant="ghost"
                size="xs"
                title={CHAT_MESSAGES.removeFromRoutine}
                aria-label={`Remove ${file.title ?? 'file'} from ${routineTitle}`}
                icon={<CancelOneIcon size={14} />}
                onClick={() => onRemove(file.id)}
              />
            )}
          </div>
        )
      })}
      {picker.dialog}
    </section>
  )
}

// ── Run outputs ──────────────────────────────────────────────────────────────

export type RunOutput = { id: string; title: string; format: Format; /** "Run of Oct 6" or "Test run". */ runLabel: string }

export interface RoutineRunOutputsProps {
  /** Newest first. The pane shows the latest three. */
  outputs: RunOutput[]
  /** A message-only routine keeps results in run history, not in Library. */
  messageOnly: boolean
}

export function RoutineRunOutputs({ outputs, messageOnly }: RoutineRunOutputsProps) {
  if (messageOnly) {
    return (
      <section className={styles.section}>
        <p className={styles.empty}>{CHAT_MESSAGES.messageOnlyNote}</p>
      </section>
    )
  }
  return (
    <section className={styles.section} aria-label={CHAT_MESSAGES.runOutputs}>
      <h4>{CHAT_MESSAGES.runOutputs}</h4>
      {outputs.length === 0 && <p className={styles.empty}>{CHAT_MESSAGES.noRunOutputs}</p>}
      {outputs.slice(0, 3).map((file) => (
        <div className={styles.row} key={file.id}>
          <FormatGlyph format={file.format} size="sm" />
          <Link className={styles.rowLink} href={`${LIBRARY_FILE_ROUTE(file.id)}?from=all`}>
            <span>{file.title}</span>
            <small>{file.runLabel}</small>
          </Link>
        </div>
      ))}
      <Link
        href={RUN_OUTPUTS_HREF}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, color: 'var(--neutral-900)', textDecoration: 'none' }}
      >
        {CHAT_MESSAGES.allRunOutputs}
        <ArrowRightOneIcon size={14} />
      </Link>
    </section>
  )
}

// ── Run history ──────────────────────────────────────────────────────────────

export type RunEntry = { id: string; kind: RunKind; text: string; at: string }

const RUN_ICON: Record<RunKind, React.ReactNode> = {
  fail: <CancelCircleIcon size={16} />,
  message: <BubbleChatIcon size={16} />,
  test: <TestTubeIcon size={16} />,
  output: <CheckmarkCircleTwoIcon size={16} />,
}

/** Latest runs: a saved Run output, a test run, a message-only run, or a failed run (which leaves no file). */
export function RoutineRunHistory({ entries }: { entries: RunEntry[] }) {
  return (
    <section className={styles.section} aria-label={CHAT_MESSAGES.runHistory}>
      <h4>{CHAT_MESSAGES.runHistory}</h4>
      {entries.length === 0 && <p className={styles.empty}>{CHAT_MESSAGES.noRuns}</p>}
      {entries.slice(0, 8).map((entry) => (
        <div className={`${styles.row} ${entry.kind === 'fail' ? styles.fail : ''}`} key={entry.id}>
          {RUN_ICON[entry.kind]}
          <span className={styles.grow}>
            <span>{runKindLabel(entry.kind)}</span>
            <small>{entry.text}</small>
          </span>
          <small className={styles.at}>{entry.at}</small>
        </div>
      ))}
    </section>
  )
}
