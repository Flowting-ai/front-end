'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FILE_MESSAGES } from '@/lib/library/messages'
import type { Preview } from '@/lib/library/schemas'
import { CitedLabel } from './CitedLabel'

type SheetPreview = Extract<Preview, { kind: 'sheet' }>

export const SHEET_WINDOW = 100

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

/**
 * A spreadsheet as a table, one window of rows at a time (the API returns the window, so no spreadsheet
 * parser ships to the browser). Cell values are text, never formulas or HTML.
 */
export default function SheetViewer({ preview, loading, onSheetChange, onRowStart, citeRow }: SheetViewerProps) {
  const { rows, rowStart, rowTotal, columns, sheets, sheet } = preview
  const end = rowStart + rows.length
  const markedIndex = citeRow !== null && citeRow !== undefined ? citeRow - rowStart : -1

  useEffect(() => {
    if (markedIndex >= 0 && markedIndex < rows.length) document.getElementById(`sheet-row-${markedIndex}`)?.scrollIntoView({ block: 'center' })
  }, [markedIndex, rows.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {sheets.length > 1 ? (
          <div role="group" aria-label="Sheets" style={{ display: 'flex', gap: 6 }}>
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
              <th scope="col" style={{ ...cell, position: 'sticky', top: 0, background: 'var(--neutral-50)', color: 'var(--neutral-500)', fontWeight: 500 }}>#</th>
              {columns.map((name, index) => (
                <th key={index} scope="col" style={{ ...cell, position: 'sticky', top: 0, background: 'var(--neutral-50)', fontWeight: 500 }}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const marked = index === markedIndex
              const markedCell: React.CSSProperties = marked ? { background: 'var(--color-tag-Yellow-bg)', boxShadow: 'inset 0 1px 0 var(--color-tag-Yellow-text), inset 0 -1px 0 var(--color-tag-Yellow-text)' } : {}
              return (
                <tr key={rowStart + index} id={`sheet-row-${index}`} data-cited={marked || undefined}>
                  <th scope="row" style={{ ...cell, ...markedCell, color: 'var(--neutral-500)', fontWeight: 400 }}>{rowStart + index + 1}</th>
                  {row.map((value, column) => (
                    <td key={column} style={{ ...cell, ...markedCell }}>
                      {value}
                      {marked && column === row.length - 1 && <CitedLabel>{FILE_MESSAGES.citedRow}</CitedLabel>}
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
