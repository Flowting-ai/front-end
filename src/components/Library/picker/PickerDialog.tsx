'use client'

import React, { useState } from 'react'
import { CheckmarkCircleTwoIcon, SearchOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { trackLibrary } from '@/lib/library/analytics'
import { formatDateTime, FORMAT_GROUP_LABELS, pluralize } from '@/lib/library/format'
import { MESSAGES, pickerLimitHint } from '@/lib/library/messages'
import { useLibraryPicker } from '@/lib/library/queries'
import { FORMAT_GROUPS, type FormatGroup } from '@/lib/library/schemas'
import type { LibraryFile } from '@/lib/library/file'
import { nextRowIndex } from '@/lib/library/table-focus'
import { FormatGlyph } from '../FormatGlyph'
import { GeneratedMark } from '../FileMarks'
import { togglePick } from './togglePick'
import styles from './PickerDialog.module.css'

type TypeChip = 'all' | FormatGroup | 'runs'

const CHIPS: { id: TypeChip; label: string }[] = [
  { id: 'all', label: 'All files' },
  ...FORMAT_GROUPS.map((group) => ({ id: group as TypeChip, label: FORMAT_GROUP_LABELS[group] })),
  { id: 'runs', label: 'Run outputs' },
]

export interface PickerDialogProps {
  onClose: () => void
  /** The chosen files, in the order they were picked. */
  onConfirm: (files: LibraryFile[]) => void
  /** Ids already attached, shown ticked and not pickable again. */
  excludeIds?: string[]
  confirmLabel?: string
  /** One file only (attaching to a routine's single input), instead of several. */
  single?: boolean
  title?: string
  /** Most files that may be picked (the attachment slots left). Further picks are disabled once reached. */
  max?: number
}

/**
 * "Add from Library": search, type chips, and a list of files you can open (only Ready, active ones are
 * ever listed). Pick one or several and confirm. It holds ids and rows only for this dialog; nothing is
 * saved or attached until the caller handles `onConfirm`.
 */
export function PickerDialog({ onClose, onConfirm, excludeIds = [], confirmLabel = 'Add to chat', single = false, title = 'Add from Library', max }: PickerDialogProps) {
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<TypeChip>('all')
  const [picked, setPicked] = useState<LibraryFile[]>([])
  const debounced = useDebouncedValue(query.trim(), 250)
  const list = useLibraryPicker(
    { q: debounced, types: chip === 'all' || chip === 'runs' ? [] : [chip], generatedOnly: chip === 'runs' },
    true,
  )

  // One tab stop for the whole list; the arrows, Home and End move between files.
  const [activeIndex, setActiveIndex] = useState(0)
  const rovingIndex = Math.min(activeIndex, Math.max(list.files.length - 1, 0))
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const next = nextRowIndex(event.key, rovingIndex, list.files.length)
    if (next === null) return
    event.preventDefault()
    setActiveIndex(next)
    const option = event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')[next]
    option?.focus()
    option?.scrollIntoView({ block: 'nearest' })
  }

  const isPicked = (id: string) => picked.some((file) => file.id === id)
  const toggle = (file: LibraryFile) => {
    if (excludeIds.includes(file.id)) return
    setPicked((current) => togglePick(current, file, single, max))
  }
  const atLimit = !single && max !== undefined && picked.length >= max

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent size="lg" style={{ height: 'min(640px, calc(100dvh - 32px))' }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Files you can open. Nothing is attached until you confirm.</DialogDescription>
        </DialogHeader>
        <div className={styles.tools}>
          <div role="search" className={styles.search}>
            <SearchOneIcon size={16} className={styles.searchIcon} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search library"
              aria-label="Search library"
              autoComplete="off"
              className={styles.input}
            />
          </div>
          <div role="group" aria-label="File type" className={styles.chips}>
            {CHIPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={chip === entry.id}
                onClick={() => setChip(entry.id)}
                className={styles.chip}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`kaya-scrollbar ${styles.results}`} aria-busy={list.isRefreshing}>
          {list.status === 'loading' ? (
            <div aria-busy="true" className={styles.loading}>
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} height={48} radius={10} />)}
            </div>
          ) : list.status === 'error' ? (
            <div role="alert" className={styles.error}>
              <p className={styles.message}>{debounced ? MESSAGES.searchUnavailable : MESSAGES.listError}</p>
              <Button variant="secondary" onClick={list.refetch}>{MESSAGES.retry}</Button>
            </div>
          ) : list.files.length === 0 ? (
            <p role="status" className={styles.empty}>{debounced || chip !== 'all' ? MESSAGES.noFilesText : MESSAGES.suggestedEmptyText}</p>
          ) : (
            <ul role="listbox" aria-multiselectable={!single} aria-label="Files" className={styles.list} onKeyDown={onListKeyDown}>
              {list.files.map((file, index) => {
                const already = excludeIds.includes(file.id)
                const selected = already || isPicked(file.id)
                const blocked = already || (atLimit && !selected)
                const name = file.name
                return (
                  <li
                    key={file.id}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={blocked || undefined}
                    // Already-attached files stay focusable (so the arrows can pass them) but cannot be picked.
                    tabIndex={index === rovingIndex ? 0 : -1}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => toggle(file)}
                    onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(file) } }}
                    className={styles.option}
                  >
                    <FormatGlyph format={file.format} />
                    <span className={styles.text}>
                      <span className={styles.nameLine}>
                        <span className={styles.name}>{name}</span>
                        {file.source === 'generated' && <GeneratedMark />}
                      </span>
                      <span className={styles.meta}>{already ? 'Already attached' : formatDateTime(file.createdAt)}</span>
                    </span>
                    {selected && <CheckmarkCircleTwoIcon size={18} />}
                  </li>
                )
              })}
            </ul>
          )}
          {list.hasNextPage && (
            <div className={styles.loadMore}>
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={list.fetchNextPage}>Load more</Button>
            </div>
          )}
        </div>

        <DialogFooter style={{ justifyContent: 'space-between', paddingTop: 12 }}>
          <span aria-live="polite" className={styles.count}>{atLimit && max !== undefined ? `${pluralize(picked.length, 'file')} selected. ${pickerLimitHint(max)}` : picked.length === 0 ? '' : `${pluralize(picked.length, 'file')} selected`}</span>
          <span className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              disabled={picked.length === 0}
              onClick={() => {
                trackLibrary('pick_from_library', { count: picked.length })
                onConfirm(picked)
                onClose()
              }}
            >
              {confirmLabel}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
