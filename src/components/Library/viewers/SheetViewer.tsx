'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { PREVIEW_ROW_WINDOW } from '@/lib/library/warm'
import type { Preview } from '@/lib/library/schemas'
import { CitedLabel } from './CitedLabel'

type SheetPreview = Extract<Preview, { kind: 'sheet' }>

export const SHEET_WINDOW = PREVIEW_ROW_WINDOW

export interface SheetViewerProps {
  preview: SheetPreview
  /** True while another window is loading; the current rows stay on screen, dimmed. */
  loading: boolean
  onSheetChange: (sheet: string) => void
  onRowStart: (rowStart: number) => void
  /** 0-based row to mark (a row citation), if it is inside the loaded window. */
  citeRow?: number | null
}

const cell: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-default)',
  fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', color: 'var(--neutral-900)',
}
// A long value is cut with an ellipsis (its full text is the cell's tooltip), so one cell cannot
// stretch its column across the screen. Tables ignore a cell's max-width, so the cut is on a wrapper.
const clip: React.CSSProperties = { display: 'block', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }
// The row number stays in view while the table scrolls sideways.
const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-bg)' }

/**
 * A spreadsheet as a table, one window of rows at a time (the API returns the window, so no spreadsheet
 * parser ships to the browser). Cell values are text, never formulas or HTML.
 */
export default function SheetViewer({ preview, loading, onSheetChange, onRowStart, citeRow }: SheetViewerProps) {
  const { rows, rowStart, rowTotal, columns, sheets, sheet } = preview
  const end = rowStart + rows.length
  const markedIndex = citeRow !== null && citeRow !== undefined ? citeRow - rowStart : -1
  // Rows can be ragged (shorter or longer than the header): every row gets the same cells, so the
  // grid lines run the full width and a value past the last header still has a column.
  const width = rows.reduce((most, row) => Math.max(most, row.length), columns.length)
  const pad = (values: string[]) => (values.length >= width ? values : [...values, ...Array<string>(width - values.length).fill('')])

  useEffect(() => {
    if (markedIndex >= 0 && markedIndex < rows.length) document.getElementById(`sheet-row-${markedIndex}`)?.scrollIntoView({ block: 'center' })
  }, [markedIndex, rows.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {sheets.length > 1 ? (
          <div role="group" aria-label="Sheets" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            {sheets.map((name) => (
              <Button key={name} variant={name === sheet ? 'default' : 'secondary'} size="sm" aria-pressed={name === sheet} onClick={() => onSheetChange(name)}>{name}</Button>
            ))}
          </div>
        ) : (
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)' }}>{sheet}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-live="polite" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>
            {rowTotal === 0 ? 'No rows' : `Rows ${rowStart + 1} to ${end} of ${rowTotal}`}
          </span>
          <Button variant="secondary" size="sm" disabled={loading || rowStart === 0} onClick={() => onRowStart(Math.max(0, rowStart - SHEET_WINDOW))}>Previous</Button>
          <Button variant="secondary" size="sm" disabled={loading || end >= rowTotal} onClick={() => onRowStart(end)}>Next</Button>
        </div>
      </div>
      <div className="kaya-scrollbar" style={{ overflow: 'auto', maxHeight: '65vh', borderRadius: 12, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)', opacity: loading ? 0.6 : 1 }}>
        <table aria-busy={loading} style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
          <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{sheet}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...cell, position: 'sticky', top: 0, left: 0, zIndex: 2, background: 'var(--neutral-50)', color: 'var(--neutral-500)', fontWeight: 500 }}>#</th>
              {pad(columns).map((name, index) => (
                <th key={index} scope="col" title={name || undefined} style={{ ...cell, position: 'sticky', top: 0, background: 'var(--neutral-50)', fontWeight: 500 }}><span style={clip}>{name}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const marked = index === markedIndex
              const markedCell: React.CSSProperties = marked ? { background: 'var(--color-tag-Yellow-bg)', boxShadow: 'inset 0 1px 0 var(--color-tag-Yellow-text), inset 0 -1px 0 var(--color-tag-Yellow-text)' } : {}
              return (
                <tr key={rowStart + index} id={`sheet-row-${index}`} data-cited={marked || undefined}>
                  <th scope="row" style={{ ...cell, ...stickyLeft, ...markedCell, color: 'var(--neutral-500)', fontWeight: 400 }}>{rowStart + index + 1}</th>
                  {pad(row).map((value, column) => (
                    <td key={column} title={value.length > 40 ? value : undefined} style={{ ...cell, ...markedCell }}>
                      <span style={marked && column === width - 1 ? { ...clip, display: 'inline-block', verticalAlign: 'bottom' } : clip}>{value}</span>
                      {marked && column === width - 1 && <CitedLabel>{FILE_MESSAGES.citedRow}</CitedLabel>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
