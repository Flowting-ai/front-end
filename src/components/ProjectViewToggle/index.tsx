'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { VIEW_LABELS, VIEW_DESCRIPTION, type ViewMode } from '@/lib/project-filters'

// ── Grid/List toggle — single secondary button + Dropdown, same "view filter"
// pattern as Pinboard's own view switcher (in-place label swap included). ──

// Both accept `size` — DropdownMenuItem clones its `icon` prop with a fixed
// size (20) to fill the row's icon slot; without accepting it these stayed a
// hardcoded 16×16 inside that 20×20 slot, sitting off-center from the label.
function GridViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ListViewGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3"    width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="6.9"  width="12" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="2" y="10.8" width="12" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  )
}

export function ProjectViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
          {/* In-place text swap — same pattern as ScopeFilterDropdown's own trigger. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value}
              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block', transformOrigin: 'left center' }}
            >
              {VIEW_LABELS[value]}
            </m.span>
          </AnimatePresence>
        </Button>
      }
    >
      <Dropdown size="md" maxHeight={false}>
        <Dropdown.Section fluid>
          <Dropdown.Item
            label="Grid"
            subLabel={VIEW_DESCRIPTION.grid}
            icon={<GridViewGlyph />}
            selected={value === 'grid'}
            onClick={() => { onChange('grid'); setOpen(false) }}
            fluid
          />
          <Dropdown.Item
            label="List"
            subLabel={VIEW_DESCRIPTION.list}
            icon={<ListViewGlyph />}
            selected={value === 'list'}
            onClick={() => { onChange('list'); setOpen(false) }}
            fluid
          />
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

export default ProjectViewToggle
