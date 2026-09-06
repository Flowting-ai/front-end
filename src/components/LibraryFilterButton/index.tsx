'use client'

import React, { useState } from 'react'
import { FilterMailIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'

// ── LibraryFilterButton ───────────────────────────────────────────────────────
// Switches the merged Chats/Tasks library page (src/app/(app)/chats/page.tsx)
// between its two modes. Same trigger pattern as Pinboard's own Filter button
// (components/Pinboard/index.tsx) — Tooltip + secondary IconButton +
// Dropdown.Float — just with a plain two-item mode picker instead of
// Pinboard's multi-select tag/category/content-type menu.

export type LibraryMode = 'chats' | 'tasks'

export interface LibraryFilterButtonProps {
  value: LibraryMode
  onChange: (mode: LibraryMode) => void
}

const MODE_OPTIONS: { value: LibraryMode; label: string }[] = [
  { value: 'chats', label: 'Chats' },
  { value: 'tasks', label: 'Tasks' },
]

export function LibraryFilterButton({ value, onChange }: LibraryFilterButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Tooltip content="Filter" side="bottom">
          <IconButton
            variant="secondary"
            size="sm"
            icon={<FilterMailIcon size={20} />}
            aria-label="Filter chats and tasks"
          />
        </Tooltip>
      }
    >
      <Dropdown style={{ width: 160 }}>
        <Dropdown.Section fluid>
          {MODE_OPTIONS.map((opt) => (
            <Dropdown.Item
              key={opt.value}
              fluid
              label={opt.label}
              selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

LibraryFilterButton.displayName = 'LibraryFilterButton'
export default LibraryFilterButton
