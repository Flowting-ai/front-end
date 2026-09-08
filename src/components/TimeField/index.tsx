'use client'

// A precise (minute-level) time picker built from the same primitives as
// every other picker in the design system: a Button trigger opening a
// Dropdown.Float popover, with DropdownMenuItem rows for each option — not
// a native <input type="time">, whose popup picker is OS/browser chrome and
// can't be restyled to match. The whole trigger is a single <Button>, so
// clicking anywhere on it (not just an icon) opens it.
//
// Three independently-scrolling columns (Hour / Minute / AM-PM) rather than
// one flat list of pre-set times — Popover's own ScrollArea only scrolls a
// single vertical region, so this hand-rolls three narrow ones instead,
// each still using DropdownMenuItem directly (so its padding/typography
// match every other dropdown) inside the same 8px-padding/4px-gap wrapper
// DropdownSection uses for its own list.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Dropdown, type DropdownPlacement } from '@/components/Dropdown'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TimeFieldProps {
  id?: string
  /** Label rendered above the field - rendered as <label> for accessibility */
  label?: string
  /** Show/hide the label slot. Defaults to true. */
  showLabel?: boolean
  /** 24-hour "HH:MM" value, or '' for no selection. */
  value: string
  /** Called with a new 24-hour "HH:MM" value. */
  onChange: (value: string) => void
  /** Size variant - medium (default) or small. */
  size?: 'medium' | 'small'
  disabled?: boolean
  placeholder?: string
  /** Stretch to fill parent width instead of a fixed 140px. */
  fluid?: boolean
  /** Popover placement, same options as every other Dropdown.Float. @default 'top-start' */
  placement?: DropdownPlacement
  /** Applied to the outer wrapper (label + trigger), not the trigger button itself. */
  style?: React.CSSProperties
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1)         // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i)             // 0..59
type Period = 'AM' | 'PM'
const PERIODS: Period[] = ['AM', 'PM']

function to12Hour(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12    = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${pad(minute)} ${period}`
}

// ── One scrollable picker column ────────────────────────────────────────────
// Mirrors DropdownSection's own layout (8px padding, 4px item gap) rather
// than an ad-hoc value, so each row's spacing matches the rest of the
// design system exactly — only Section itself can't be reused here since it
// stacks a single vertical list at the full popover width, not three narrow
// side-by-side columns. The column title reuses DropdownMenuItem's own
// `variant="header"` treatment (same one DropdownSection's `label` prop
// renders) rather than a bespoke label style, and stays fixed above the
// scroll region instead of scrolling away with the options.

function PickerColumn<T extends string | number>({
  title, options, selected, onSelect,
}: { title: string; options: { value: T; label: string }[]; selected: T | null; onSelect: (v: T) => void }) {
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scrolls the current value into view once, when the column mounts (i.e.
  // each time the popover opens) — not on every `selected` change, so
  // picking a new value doesn't fight the user's own scroll position.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Dropdown.Item variant="header" label={title} fluid />
      </div>
      <div
        role="listbox"
        aria-label={title}
        className="kaya-scrollbar-sm"
        style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto', padding: '4px 8px 8px' }}
      >
        {options.map(opt => (
          <div key={opt.value} ref={selected === opt.value ? selectedRef : undefined}>
            <Dropdown.Item
              label={opt.label}
              selected={selected === opt.value}
              onClick={() => onSelect(opt.value)}
              fluid
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TimeField({
  id,
  label,
  showLabel = true,
  value,
  onChange,
  size        = 'medium',
  disabled    = false,
  placeholder = 'Select time',
  fluid       = false,
  placement   = 'top-start',
  style,
  className,
  ...aria
}: TimeFieldProps) {
  const [open, setOpen] = useState(false)

  const timeParts = value.match(/^(\d{2}):(\d{2})$/)
  const hour24    = timeParts ? parseInt(timeParts[1], 10) : null
  const minute    = timeParts ? parseInt(timeParts[2], 10) : null
  const period: Period = hour24 !== null && hour24 >= 12 ? 'PM' : 'AM'
  const hour12    = hour24 !== null ? (hour24 % 12 === 0 ? 12 : hour24 % 12) : null

  // The trigger keeps showing the last CONFIRMED value — column picks only
  // update this draft, never `value` itself, until "Confirm time" is clicked.
  const [draftHour,   setDraftHour]   = useState(hour12)
  const [draftMinute, setDraftMinute] = useState(minute)
  const [draftPeriod, setDraftPeriod] = useState(period)

  // Re-seed the draft from the current value each time the popover opens, so
  // it starts from the last confirmed time rather than a stale in-progress
  // pick left over from a previous open-then-dismiss.
  useEffect(() => {
    if (open) {
      setDraftHour(hour12)
      setDraftMinute(minute)
      setDraftPeriod(period)
    }
    // hour12/minute/period are derived from `value`, which this component
    // only ever changes via the Confirm button below (after the popover has
    // closed) — so this only needs to re-sync on the open transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const currentLabel = hour24 !== null && minute !== null ? to12Hour(hour24, minute) : null

  const confirm = () => {
    if (draftHour !== null && draftMinute !== null) {
      const h24 = (draftHour % 12) + (draftPeriod === 'PM' ? 12 : 0)
      onChange(`${pad(h24)}:${pad(draftMinute)}`)
    }
    setOpen(false)
  }

  const hourOptions   = useMemo(() => HOURS.map(h => ({ value: h, label: String(h) })), [])
  const minuteOptions = useMemo(() => MINUTES.map(m => ({ value: m, label: pad(m) })), [])
  const periodOptions = useMemo(() => PERIODS.map(p => ({ value: p, label: p })), [])

  const isSmall = size === 'small'

  return (
    <div className={cn(className)} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: fluid ? '100%' : '140px', ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={
            showLabel
              ? {
                  fontFamily: 'var(--font-body)',
                  fontWeight: 'var(--font-weight-regular)',
                  fontSize:   isSmall ? 'var(--font-size-caption)' : 'var(--font-size-body)',
                  lineHeight: isSmall ? 'var(--line-height-caption)' : 'var(--line-height-body)',
                  color:      'var(--text-field-label)',
                  display:    'block',
                }
              : {
                  position:   'absolute',
                  width:      1,
                  height:     1,
                  padding:    0,
                  margin:     -1,
                  overflow:   'hidden',
                  clip:       'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border:     0,
                }
          }
        >
          {label}
        </label>
      )}

      <Dropdown.Float
        open={open}
        onOpenChange={(next) => { if (!disabled) setOpen(next) }}
        placement={placement}
        trigger={
          <Button
            id={id}
            variant="outline"
            size={isSmall ? 'sm' : 'md'}
            disabled={disabled}
            fluid
            rightIcon={<ArrowDownOneIcon animated />}
            {...aria}
          >
            {currentLabel ?? placeholder}
          </Button>
        }
      >
        <Dropdown size={isSmall ? 'md' : 'lg'} maxHeight={false}>
          <div style={{ display: 'flex' }}>
            <PickerColumn
              title="Hour"
              options={hourOptions}
              selected={draftHour}
              onSelect={setDraftHour}
            />
            <div style={{ width: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
            <PickerColumn
              title="Min"
              options={minuteOptions}
              selected={draftMinute}
              onSelect={setDraftMinute}
            />
            <div style={{ width: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
            <PickerColumn
              title="AM/PM"
              options={periodOptions}
              selected={draftPeriod}
              onSelect={setDraftPeriod}
            />
          </div>
          <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', flexShrink: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}>
            <Button variant="default" size="sm" onClick={confirm}>
              Confirm time
            </Button>
          </div>
        </Dropdown>
      </Dropdown.Float>
    </div>
  )
}

TimeField.displayName = 'TimeField'

export default TimeField
