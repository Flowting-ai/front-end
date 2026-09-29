'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown } from '@/components/Dropdown'
import { SCOPE_VALUES, SCOPE_LABEL, SCOPE_DESCRIPTION, type ScopeFilter } from '@/lib/project-filters'

// ── Scope filter — Personal/Workspace/Shared/Recently Deleted as a Dropdown.Float
// instead of a Tabs bar, composed the same way AccountMenu wires its own
// Dropdown.Float + Dropdown.Section + Dropdown.Item (see AccountMenu/index.tsx).
// Trigger shows plain text (not a colored Badge/tag) — same convention as
// ProjectViewToggle's own Grid/List trigger. ──

export function ScopeFilterDropdown({ value, onChange }: { value: ScopeFilter; onChange: (v: ScopeFilter) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      trigger={
        <Button variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={16} />}>
          {/* In-place text swap — same transition ProjectViewToggle's own
              trigger label uses. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value}
              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ display: 'block', transformOrigin: 'left center' }}
            >
              {SCOPE_LABEL[value]}
            </m.span>
          </AnimatePresence>
        </Button>
      }
    >
      <Dropdown size="md" maxHeight={false}>
        <Dropdown.Section fluid>
          {SCOPE_VALUES.map(v => (
            <Dropdown.Item
              key={v}
              label={SCOPE_LABEL[v]}
              subLabel={SCOPE_DESCRIPTION[v]}
              selected={value === v}
              onClick={() => { onChange(v); setOpen(false) }}
              fluid
            />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

export default ScopeFilterDropdown
