'use client'

import React, { useState } from 'react'
import { ArrowUpDownIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { chosenSort, sortKeysFor, sortPatch, type LibraryQuery, type SortKey } from '@/lib/library/query-params'
import type { SetLibraryQuery } from '@/lib/library/use-library-query'

const KEY_LABELS: Record<string, string> = { name: 'Name', created: 'Created', shared: 'Date shared' }

/**
 * The Sort button: the same choice as the column headings (only Name and the date column sort). On
 * Shared the untouched order is unread first, then newest, so nothing is ticked until a choice is made.
 */
export function SortMenu({ query, setQuery, tab }: { query: LibraryQuery; setQuery: SetLibraryQuery; tab: 'all' | 'shared' }) {
  const [open, setOpen] = useState(false)
  const chosen = chosenSort(query)
  const untouched = chosen.key === null
  const keys: SortKey[] = sortKeysFor(tab)
  const current: SortKey = chosen.key ?? (tab === 'shared' ? 'shared' : 'created')
  const dated = current !== 'name'
  const choose = (key: SortKey) => setQuery((now) => sortPatch(now, key, key === 'name' ? 'asc' : 'desc'))
  const order = (dir: 'asc' | 'desc') => setQuery((now) => sortPatch(now, current, dir))
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Tooltip content="Sort" side="bottom">
          <IconButton variant="secondary" size="md" icon={<ArrowUpDownIcon size={20} />} aria-label="Sort" aria-haspopup="menu" aria-expanded={open} />
        </Tooltip>
      }
    >
      <Dropdown maxHeight={false} style={{ minWidth: 176 }}>
        <Dropdown.Section fluid label="Sort by">
          {keys.map((key) => (
            <Dropdown.Item key={key} label={KEY_LABELS[key]} fluid selected={!untouched && current === key} onClick={() => choose(key)} />
          ))}
        </Dropdown.Section>
        <Dropdown.Section fluid divider>
          <Dropdown.Item label={dated ? 'Newest first' : 'A to Z'} fluid selected={!untouched && chosen.dir === (dated ? 'desc' : 'asc')} onClick={() => order(dated ? 'desc' : 'asc')} />
          <Dropdown.Item label={dated ? 'Oldest first' : 'Z to A'} fluid selected={!untouched && chosen.dir === (dated ? 'asc' : 'desc')} onClick={() => order(dated ? 'asc' : 'desc')} />
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}
