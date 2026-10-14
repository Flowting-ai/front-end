'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/Skeleton'
import { parsePageCite, parseRowCite } from '@/lib/library/cite'
import { isApiError } from '@/lib/library/errors'
import { MESSAGES } from '@/lib/library/messages'
import { useFilePreview } from '@/lib/library/queries'
import type { CiteLocator, PreviewRequest } from '@/lib/library/schemas'
import type { LibraryFileDetail } from '@/lib/library/file'
import AudioViewer from './AudioViewer'
import ImageViewer from './ImageViewer'
import { PreviewBoundary } from './PreviewBoundary'
import SheetViewer, { SHEET_WINDOW } from './SheetViewer'
import TextViewer from './TextViewer'

// pdf.js is large; it loads only when a PDF is opened.
const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => <Skeleton height={520} radius={12} style={{ width: '100%', maxWidth: 640 }} />,
})

/** Where a sheet preview should start: around the cited row, or the top. */
function initialRequest(file: LibraryFileDetail, cite: CiteLocator | null): PreviewRequest {
  if (file.previewKind === 'sheet' && cite?.type === 'row') {
    const target = parseRowCite(cite.value)
    if (target) return { sheet: target.sheet, rowStart: Math.max(0, target.row - 1 - 20), rowCount: SHEET_WINDOW }
  }
  return { rowStart: 0, rowCount: SHEET_WINDOW }
}

export interface FilePreviewProps {
  file: LibraryFileDetail
  cite: CiteLocator | null
  onDownload: () => void
}

/** Picks the viewer for a file's preview kind and loads the preview payload (a short-lived cache: it can hold storage URLs). */
export default function FilePreview({ file, cite, onDownload }: FilePreviewProps) {
  const [request, setRequest] = useState<PreviewRequest>(() => initialRequest(file, cite))
  const enabled = file.phase === 'ready' && file.previewKind !== 'none'
  const preview = useFilePreview(file.id, request, enabled)

  if (file.previewKind === 'none') {
    return <NoPreview onDownload={onDownload} />
  }
  if (preview.isPending) return <Skeleton height={420} radius={12} style={{ width: '100%', maxWidth: 720 }} />
  if (preview.isError || !preview.data) {
    if (isApiError(preview.error) && preview.error.code === 'no_preview') return <NoPreview onDownload={onDownload} />
    return (
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>Couldn&apos;t load the preview.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => void preview.refetch()}>{MESSAGES.retry}</Button>
          <Button onClick={onDownload}>Download</Button>
        </div>
      </div>
    )
  }

  const data = preview.data
  return (
    <PreviewBoundary fileId={file.id} onDownload={onDownload}>
      {data.kind === 'pdf' && <PdfViewer url={data.url} highlightPage={cite?.type === 'page' ? parsePageCite(cite.value) : null} passage={cite?.passage} />}
      {data.kind === 'text' && <TextViewer pages={data.pages} citePage={cite?.type === 'page' ? cite.value : null} passage={cite?.passage} />}
      {data.kind === 'image' && <ImageViewer url={data.url} caption={data.caption} />}
      {data.kind === 'audio' && <AudioViewer url={data.url} lines={data.lines} citeMs={cite?.type === 'time' ? Number(cite.value) : null} />}
      {data.kind === 'sheet' && (
        <SheetViewer
          preview={data}
          loading={preview.isFetching}
          onSheetChange={(sheet) => setRequest({ sheet, rowStart: 0, rowCount: SHEET_WINDOW })}
          onRowStart={(rowStart) => setRequest((current) => ({ ...current, rowStart, rowCount: SHEET_WINDOW }))}
          citeRow={cite?.type === 'row' ? (parseRowCite(cite.value)?.row ?? 0) - 1 : null}
        />
      )}
    </PreviewBoundary>
  )
}

function NoPreview({ onDownload }: { onDownload: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }}>No preview for this file</p>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>You can download it to open it.</p>
      <Button onClick={onDownload}>Download</Button>
    </div>
  )
}
