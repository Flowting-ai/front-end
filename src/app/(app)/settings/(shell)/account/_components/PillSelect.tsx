'use client'

import React, { useState } from 'react'
import { Dropdown } from '@/components/Dropdown'
import { Spinner } from '@/components/Spinner'

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 8l5 5 5-5" stroke="var(--neutral-400,#9c938b)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Caps the list at 4 visible rows, scrolling (kaya-scrollbar, via Popover's
// own ScrollArea) for the rest — same row-math convention as ModelMenu's
// MODEL_LIST_MAX_HEIGHT, but for rows WITH a subLabel (descriptions are
// always passed for the model list): 5px top pad + 22px label line-height +
// 16px subLabel line-height + 5px bottom pad = 48px/row (DropdownMenuItem's
// own documented content height), + 4px gap between rows (this component's
// item-wrapper gap below).
const VISIBLE_OPTION_ROWS = 4
const OPTION_ROW_HEIGHT = 48
const OPTION_ROW_GAP = 4
const OPTION_LIST_MAX_HEIGHT =
  VISIBLE_OPTION_ROWS * OPTION_ROW_HEIGHT + (VISIBLE_OPTION_ROWS - 1) * OPTION_ROW_GAP

// ── Compact pill select — Figma "Button" (18:27528/18:27537) ─────────────────
export function PillSelect<T extends string>({
  value,
  options,
  onChange,
  descriptions,
  icons,
  sections,
  pending = false,
  label,
}: {
  /** What the control chooses; the trigger only shows the current value. */
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  /** Optional one-line "what this means" caption shown under each option's label. */
  descriptions?: Partial<Record<T, string>>
  /** Optional leading icon per option (e.g. a model's provider logo). */
  icons?: Partial<Record<T, React.ReactElement>>
  /**
   * Optional grouping — when provided, renders under labeled mini-headers
   * (e.g. "Auto Routing" / "Models") instead of one flat list. `options`
   * should still list every value (used for the trigger/type-checking);
   * `sections` only changes how the open list is rendered. Sections with an
   * empty `options` array are skipped entirely (no empty header).
   */
  sections?: Array<{ label: string; options: readonly T[] }>
  /** True while the change request is in flight — dims the trigger, blocks reopening. */
  pending?: boolean
}) {
  const visibleSections = sections?.filter(s => s.options.length > 0)
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open && !pending}
      onOpenChange={(v) => { if (!pending) setOpen(v) }}
      placement="bottom-end"
      offset={4}
      // Flips to open upward when there isn't enough room below the trigger
      // (e.g. this row sitting near the bottom of the viewport) — same
      // mechanism already used for the sidebar's project-row menus.
      autoFlipVertical
      trigger={
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        aria-haspopup="listbox"
        aria-label={`${label}: ${value}`}
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             8,
          // minWidth (not a fixed width) — a fixed 100px truncated/cramped
          // longer values (model names, especially once an icon eats into
          // the same space); this keeps the compact Tone trigger's size but
          // lets the button grow for whatever content actually needs it.
          minWidth:        100,
          padding:         '5px 8px',
          borderRadius:    8,
          border:          'none',
          backgroundColor: 'var(--field-surface)',
          boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100,#F5F5F5)',
          cursor:          pending ? 'not-allowed' : 'pointer',
          opacity:         pending ? 0.6 : 1,
          fontFamily:      'var(--font-body)',
          fontWeight:      500,
          fontSize:        14,
          lineHeight:      '22px',
          color:           'var(--neutral-700,#524b47)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          {icons?.[value]}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </span>
        {pending ? <Spinner size={14} /> : <ChevronDownIcon />}
      </button>
    }>
      {visibleSections ? (
        // Dropdown.Section is safe here (unlike the flat branch below)
        // because `size="lg"` below gives the popover an explicit width —
        // DropdownSection's own width:100%-on-nested-divs chain only
        // produces a few px of edge slack when the popover's own width is
        // indeterminate (shrink-to-fit); a known ancestor width removes
        // that step entirely, same reason ModelMenu's sectioned dropdown
        // (which also uses an explicit `size`) doesn't have the issue.
        <Dropdown size="lg" maxHeight={OPTION_LIST_MAX_HEIGHT}>
          {visibleSections.map((section, i) => (
            <Dropdown.Section key={section.label} label={section.label} fluid divider={i > 0}>
              {section.options.map(option => (
                <Dropdown.Item
                  key={option}
                  fluid
                  icon={icons?.[option]}
                  label={option}
                  subLabel={descriptions?.[option]}
                  selected={option === value}
                  onClick={() => { onChange(option); setOpen(false) }}
                />
              ))}
            </Dropdown.Section>
          ))}
        </Dropdown>
      ) : (
        <Dropdown maxHeight={OPTION_LIST_MAX_HEIGHT}>
          {/* Not Dropdown.Section — its item wrapper hardcodes width:100% (fluid)
              or width:217px on every nested div, a percentage/fixed chain that
              left a few px of slack between the widest item and the popover's
              own shrink-to-fit edge (this branch has no explicit `size`, so
              the popover's own width is indeterminate/shrink-to-fit).
              Omitting width entirely here (on both this wrapper and each
              item, via style below) lets the container and items resolve
              through plain flex `align-items: stretch` (the default) instead
              — a single, first-pass-then-stretch computation with no
              percentage-of-indeterminate-ancestor step, so the item's right
              edge lands exactly on the container's own edge. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: OPTION_ROW_GAP, padding: 8 }}>
            {options.map(option => (
              <Dropdown.Item
                key={option}
                icon={icons?.[option]}
                label={option}
                subLabel={descriptions?.[option]}
                selected={option === value}
                onClick={() => { onChange(option); setOpen(false) }}
                style={{ width: 'auto' }}
              />
            ))}
          </div>
        </Dropdown>
      )}
    </Dropdown.Float>
  )
}
