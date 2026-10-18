'use client'

import React, { useState } from 'react'
import { CancelOneIcon, FilterMailIcon, TickTwoIcon } from '@strange-huge/icons'
import { FileAudio, FileSpreadsheet, FileText, Image as ImageIcon, Sparkles, Upload, Users } from 'lucide-react'
import { IconButton } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { FORMAT_GROUP_LABELS } from '@/lib/library/format'
import { activeFilterCount, type LibraryQuery } from '@/lib/library/query-params'
import { FORMAT_GROUPS, SOURCE_FILTERS, type FormatGroup, type SourceFilter } from '@/lib/library/schemas'
import type { SetLibraryQuery } from '@/lib/library/use-library-query'
import { PdfGlyph, formatTintText } from './FormatGlyph'

const SOURCE_LABELS: Record<SourceFilter, string> = { uploaded: 'Uploaded', generated: 'Generated', shared: 'Shared' }

const ICON = 18

/** The menu sizes its icons by passing `size`, so the PDF mark takes one too. */
function PdfTypeIcon({ size = ICON }: { size?: number }) {
  return <span style={{ display: 'inline-flex', color: formatTintText('pdf') }}><PdfGlyph size={size} /></span>
}
const SOURCE_ICONS: Record<SourceFilter, React.ReactElement> = {
  uploaded: <Upload size={ICON} strokeWidth={1.7} aria-hidden />,
  generated: <Sparkles size={ICON} strokeWidth={1.7} aria-hidden />,
  shared: <Users size={ICON} strokeWidth={1.7} aria-hidden />,
}
// One icon per type, in the type's own colour, as in the prototype.
const TYPE_ICONS: Record<FormatGroup, React.ReactElement> = {
  images: <ImageIcon size={ICON} strokeWidth={1.7} color={formatTintText('image')} aria-hidden />,
  documents: <FileText size={ICON} strokeWidth={1.7} color={formatTintText('document')} aria-hidden />,
  spreadsheets: <FileSpreadsheet size={ICON} strokeWidth={1.7} color={formatTintText('sheet')} aria-hidden />,
  pdfs: <PdfTypeIcon />,
  audio: <FileAudio size={ICON} strokeWidth={1.7} color={formatTintText('audio')} aria-hidden />,
}

function toggle<T extends string>(list: T[], value: T, order: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  return order.filter((item) => next.includes(item))
}

/** One chip per section: "Uploaded, Generated" for one or two ticks, "3 picked" for more. */
export function chipLabel<T extends string>(picked: T[], labels: Record<T, string>): string {
  return picked.length <= 2 ? picked.map((value) => labels[value]).join(', ') : `${picked.length} picked`
}

type Chip = { key: string; label: string; remove: () => void }

const resetStyle: React.CSSProperties = {
  marginLeft: 'auto', padding: '0 4px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6,
  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)',
}

/**
 * Filter: two sections, Source (Uploaded, Generated, Shared) and File type. Nothing ticked shows
 * everything; ticking narrows (OR within a section, AND across sections). Each section with ticks
 * shows one chip beside the button (so two at most), and a chip clears its own section. "Reset"
 * sits in the Source heading row and clears both.
 */
export function FilterPanel({ query, setQuery }: { query: LibraryQuery; setQuery: SetLibraryQuery }) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(query)

  const chips: Chip[] = []
  if (query.source.length) chips.push({ key: 'source', label: chipLabel(query.source, SOURCE_LABELS), remove: () => setQuery({ source: [] }) })
  if (query.type.length) chips.push({ key: 'type', label: chipLabel(query.type, FORMAT_GROUP_LABELS), remove: () => setQuery({ type: [] }) })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 6px 0 12px', borderRadius: 999, border: '1px solid var(--border-default)', boxSizing: 'border-box',
            background: 'var(--color-surface-container)', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-900)', whiteSpace: 'nowrap',
          }}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.remove}
            aria-label={`Remove ${chip.label}`}
            style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, padding: 0, border: 'none', borderRadius: 999, background: 'transparent', cursor: 'pointer', color: 'var(--neutral-600)' }}
          >
            <CancelOneIcon size={12} />
          </button>
        </span>
      ))}
      <Dropdown.Float
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        trigger={
          <Tooltip content="Filter" side="bottom">
            <IconButton
              variant={count > 0 ? 'default' : 'secondary'}
              size="md"
              icon={<FilterMailIcon size={20} />}
              aria-label={count > 0 ? 'Filter, on' : 'Filter'}
              aria-haspopup="menu"
              aria-expanded={open}
            />
          </Tooltip>
        }
      >
        <Dropdown style={{ minWidth: 240 }} maxHeight={false}>
          <Dropdown.Section fluid>
            <Dropdown.Item variant="header" label="Source" fluid>
              {count > 0 && (
                <button type="button" style={resetStyle} onClick={() => setQuery({ source: [], type: [] })}>Reset</button>
              )}
            </Dropdown.Item>
            {SOURCE_FILTERS.map((value) => (
              <Dropdown.Item
                key={value}
                label={SOURCE_LABELS[value]}
                fluid
                icon={SOURCE_ICONS[value]}
                selected={query.source.includes(value)}
                rightIcon={query.source.includes(value) ? <TickTwoIcon aria-hidden /> : undefined}
                onClick={() => setQuery((current) => ({ source: toggle(current.source, value, SOURCE_FILTERS) }))}
              />
            ))}
          </Dropdown.Section>
          <Dropdown.Section fluid label="File type" divider>
            {FORMAT_GROUPS.map((value: FormatGroup) => (
              <Dropdown.Item
                key={value}
                label={FORMAT_GROUP_LABELS[value]}
                fluid
                icon={TYPE_ICONS[value]}
                selected={query.type.includes(value)}
                rightIcon={query.type.includes(value) ? <TickTwoIcon aria-hidden /> : undefined}
                onClick={() => setQuery((current) => ({ type: toggle(current.type, value, FORMAT_GROUPS) }))}
              />
            ))}
          </Dropdown.Section>
        </Dropdown>
      </Dropdown.Float>
    </div>
  )
}
