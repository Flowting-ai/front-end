'use client'

import React, { useState } from 'react'
import { CheckmarkCircleTwoIcon, SearchOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { trackLibrary } from '@/lib/library/analytics'
import { formatDateTime, FORMAT_GROUP_LABELS, pluralize } from '@/lib/library/format'
import { MESSAGES } from '@/lib/library/messages'
import { useLibraryPicker } from '@/lib/library/queries'
import { FORMAT_GROUPS, type FormatGroup } from '@/lib/library/schemas'
import type { LibraryFile } from '@/lib/library/file'
import { FormatGlyph } from '../FormatGlyph'
import { GeneratedMark } from '../FileMarks'

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
}

/**
 * "Add from Library": search, type chips, and a list of files you can open (only Ready, active ones are
 * ever listed). Pick one or several and confirm. It holds ids and rows only for this dialog; nothing is
 * saved or attached until the caller handles `onConfirm`.
 */
export function PickerDialog({ onClose, onConfirm, excludeIds = [], confirmLabel = 'Add to chat', single = false, title = 'Add from Library' }: PickerDialogProps) {
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<TypeChip>('all')
  const [picked, setPicked] = useState<LibraryFile[]>([])
  const debounced = useDebouncedValue(query.trim(), 250)
  const list = useLibraryPicker(
    { q: debounced, types: chip === 'all' || chip === 'runs' ? [] : [chip], generatedOnly: chip === 'runs' },
    true,
  )

  const isPicked = (id: string) => picked.some((file) => file.id === id)
  const toggle = (file: LibraryFile) => {
    if (excludeIds.includes(file.id)) return
    setPicked((current) => (single ? (isPicked(file.id) ? [] : [file]) : isPicked(file.id) ? current.filter((entry) => entry.id !== file.id) : [...current, file]))
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent size="lg" style={{ height: 'min(640px, calc(100dvh - 32px))' }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Files you can open. Nothing is attached until you confirm.</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px 8px' }}>
          <div role="search" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 10, background: 'var(--text-field-bg)', boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--text-field-ring)' }}>
            <SearchOneIcon size={16} style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search library"
              aria-label="Search library"
              autoComplete="off"
              style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}
            />
          </div>
          <div role="group" aria-label="File type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={chip === entry.id}
                onClick={() => setChip(entry.id)}
                style={{
                  padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px',
                  background: chip === entry.id ? 'var(--neutral-900)' : 'var(--color-surface-container)', color: chip === entry.id ? 'var(--card-bg)' : 'var(--neutral-700)',
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '0 16px' }} aria-busy={list.isRefreshing}>
          {list.status === 'loading' ? (
            <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 8px' }}>
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} height={48} radius={10} />)}
            </div>
          ) : list.status === 'error' ? (
            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 32, textAlign: 'center' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)' }}>{debounced ? MESSAGES.searchUnavailable : MESSAGES.listError}</p>
              <Button variant="secondary" onClick={list.refetch}>{MESSAGES.retry}</Button>
            </div>
          ) : list.files.length === 0 ? (
            <p role="status" style={{ margin: 0, padding: 32, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>{debounced || chip !== 'all' ? MESSAGES.noFilesText : MESSAGES.suggestedEmptyText}</p>
          ) : (
            <ul role="listbox" aria-multiselectable={!single} aria-label="Files" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {list.files.map((file) => {
                const already = excludeIds.includes(file.id)
                const selected = already || isPicked(file.id)
                const name = file.name
                return (
                  <li
                    key={file.id}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={already || undefined}
                    tabIndex={already ? -1 : 0}
                    onClick={() => toggle(file)}
                    onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(file) } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '4px 10px', borderRadius: 10, cursor: already ? 'not-allowed' : 'pointer',
                      background: selected ? 'var(--neutral-100)' : 'transparent', opacity: already ? 0.6 : 1,
                    }}
                  >
                    <FormatGlyph format={file.format} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>{name}</span>
                        {file.source === 'generated' && <GeneratedMark />}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>{already ? 'Already attached' : formatDateTime(file.createdAt)}</span>
                    </span>
                    {selected && <CheckmarkCircleTwoIcon size={18} />}
                  </li>
                )
              })}
            </ul>
          )}
          {list.hasNextPage && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={list.fetchNextPage}>Load more</Button>
            </div>
          )}
        </div>

        <DialogFooter style={{ justifyContent: 'space-between', paddingTop: 12 }}>
          <span aria-live="polite" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>{picked.length === 0 ? '' : `${pluralize(picked.length, 'file')} selected`}</span>
          <span style={{ display: 'flex', gap: 8 }}>
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
