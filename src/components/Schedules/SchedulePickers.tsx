'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDownOneIcon, SearchOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { InputField } from '@/components/InputField'
import { DAYS, filterTimezones, timezoneList, zoneLabel, type DayOfWeek } from '@/lib/schedules/schedule-form'

/** Frequency, Day, Time and Timezone controls share this width so they line up as one column. */
export const FIELD_WIDTH = 200

export function DayPicker({ value, onChange, labelId }: { value: DayOfWeek; onChange: (d: DayOfWeek) => void; labelId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={setOpen}
      placement="top-end"
      trigger={
        <Button id="schedule-day" variant="outline" size="sm" fluid aria-labelledby={labelId} rightIcon={<ArrowDownOneIcon animated />} style={{ width: FIELD_WIDTH }}>
          {value}
        </Button>
      }
    >
      <Dropdown maxHeight={false}>
        <Dropdown.Section>
          {DAYS.map(d => (
            <Dropdown.Item key={d} label={d} selected={value === d} onClick={() => { onChange(d); setOpen(false) }} fluid />
          ))}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}

export function TimezonePicker({ value, onChange, labelId }: { value: string; onChange: (tz: string) => void; labelId: string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const zones = useMemo(() => timezoneList(), [])
  const filtered = useMemo(() => filterTimezones(zones, search), [zones, search])
  return (
    <Dropdown.Float
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setSearch('') // fresh search each time it opens
      }}
      placement="top-end"
      trigger={
        <Button id="schedule-timezone" variant="outline" size="sm" fluid aria-labelledby={labelId} rightIcon={<ArrowDownOneIcon animated />} style={{ width: FIELD_WIDTH }}>
          {/* Long zone names truncate and the chevron stays pinned right. */}
          <span className="min-w-0 flex-1 truncate text-left">{zoneLabel(value)}</span>
        </Button>
      }
    >
      <Dropdown
        size="lg"
        header={
          <div className="p-2">
            <InputField size="small" showLabel={false} label="Search timezone" showSubtitle={false} leftIcon={<SearchOneIcon size={16} />} placeholder="Search timezone…" value={search} onChange={setSearch} fluid />
          </div>
        }
      >
        <Dropdown.Section divider fluid>
          {filtered.length > 0 ? (
            filtered.map(tz => (
              <Dropdown.Item key={tz} label={zoneLabel(tz)} selected={value === tz} onClick={() => { onChange(tz); setOpen(false) }} fluid />
            ))
          ) : (
            <div className="px-1.5 py-2 text-center text-[length:var(--font-size-caption)] text-[var(--neutral-500)]">
              {`No timezones matching "${search}"`}
            </div>
          )}
        </Dropdown.Section>
      </Dropdown>
    </Dropdown.Float>
  )
}
