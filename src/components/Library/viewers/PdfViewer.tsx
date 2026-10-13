'use client'

import React, { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import { Skeleton } from '@/components/Skeleton'
import { passageRuns } from '@/lib/library/cite'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { captureError } from '@/lib/library/observability'
import { CITED_MARK, CitedLabel } from './CitedLabel'
import { isPdfUrlAllowed, resolvePdfSource } from '@/lib/library/viewers/pdf-source'

// The worker is a hashed build asset (never a hand-copied file in /public): bundlers rewrite this URL
// and serve it with a content hash, so a pdf.js upgrade can never run against a stale cached worker.
if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
}

const PAGE_GAP = 16

type PageSize = { width: number; height: number }

/**
 * One page, drawn to a canvas only when it is near the viewport (and kept once drawn). Until then it
 * is an empty box of the right size, so scrolling a long PDF never shifts the layout.
 */
type Rect = { left: number; top: number; width: number; height: number }

/** Boxes (in CSS px at `scale`) around the text runs of a page that hold the cited passage; empty when it is not there. */
async function passageRects(doc: PDFDocumentProxy, pageNumber: number, scale: number, passage: string): Promise<Rect[]> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const content = await page.getTextContent()
  const items = content.items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item)
  return passageRuns(items.map((item) => item.str), passage).map((index) => {
    const item = items[index]
    const [, , c, d, x, y] = item.transform as number[]
    const height = item.height || Math.hypot(c, d)
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([x, y, x + item.width, y + height])
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
  })
}

function PdfPage({ doc, pageNumber, scale, size, highlighted, passage }: { doc: PDFDocumentProxy; pageNumber: number; scale: number; size: PageSize; highlighted: boolean; passage?: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  // The cited passage's boxes on this page; null until looked up (or when there is no passage to look for).
  const [marks, setMarks] = useState<Rect[] | null>(null)

  useEffect(() => {
    if (!highlighted || !passage) return
    let cancelled = false
    passageRects(doc, pageNumber, scale, passage)
      .then((rects) => { if (!cancelled) setMarks(rects) })
      .catch((error: unknown) => { if (!cancelled) { captureError(error, { boundary: 'pdf-passage' }); setMarks([]) } })
    return () => { cancelled = true }
  }, [doc, pageNumber, scale, highlighted, passage])

  // Once the passage is found, bring it (not just the page top) into view.
  useEffect(() => {
    if (marks && marks.length > 0) boxRef.current?.querySelector('[data-cited]')?.scrollIntoView({ block: 'center' })
  }, [marks])

  const found = Boolean(highlighted && passage && marks && marks.length > 0)
  const last = found && marks ? marks[marks.length - 1] : null

  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    }, { rootMargin: '600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    ;(async () => {
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled || !canvasRef.current) return
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * ratio })
        const canvas = canvasRef.current
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const render = page.render({ canvas, viewport })
        task = render
        await render.promise
      } catch (error) {
        // A cancelled render (scale change, unmount) is expected; anything else is reported once.
        if (!(error instanceof Error && error.name === 'RenderingCancelledException')) captureError(error, { boundary: 'pdf-page' })
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, doc, pageNumber, scale])

  return (
    <div
      ref={boxRef}
      id={`pdf-page-${pageNumber}`}
      style={{
        width: size.width * scale, height: size.height * scale, maxWidth: '100%', background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)',
        // The page is outlined only when there is no passage to mark on it.
        outline: highlighted && !found ? '3px solid var(--color-tag-Yellow-text)' : 'none', outlineOffset: 2, flexShrink: 0, position: 'relative',
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber} of ${doc.numPages}`} style={{ width: '100%', height: '100%', display: 'block' }} />
      {found && marks?.map((rect, index) => (
        <span
          key={index}
          data-cited={index === 0 || undefined}
          aria-hidden="true"
          style={{ ...CITED_MARK, position: 'absolute', left: rect.left - 1, top: rect.top - 1, width: rect.width + 2, height: rect.height + 2, mixBlendMode: 'multiply', pointerEvents: 'none' }}
        />
      ))}
      {last && (
        <span style={{ position: 'absolute', left: Math.min(last.left + last.width, size.width * scale - 110), top: last.top + last.height / 2 - 10 }}>
          <CitedLabel>{FILE_MESSAGES.citedPassage}</CitedLabel>
        </span>
      )}
    </div>
  )
}

export interface PdfViewerProps {
  url: string
  /** 1-based page to scroll to (a page citation). */
  highlightPage?: number | null
  /** The cited passage on that page: marked where it sits. Without it (or when it is not found) the page is outlined. */
  passage?: string | null
}

/** A PDF as a scrolling stack of pages with zoom. Scripting is off; only the page images are drawn. */
export default function PdfViewer({ url, highlightPage, passage }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<PageSize | null>(null)
  const [failed, setFailed] = useState(false)
  const scale = 1

  // A URL that is not safe to load is decided during render, not in an effect.
  const allowed = isPdfUrlAllowed(url)

  useEffect(() => {
    const source = resolvePdfSource(url)
    if (!source) return
    let cancelled = false
    const task = getDocument(
      source.kind === 'data'
        ? { data: source.data, enableXfa: false }
        : { url: source.url, withCredentials: false, enableXfa: false },
    )
    task.promise
      .then(async (loaded) => {
        const first = await loaded.getPage(1)
        if (cancelled) return
        const viewport = first.getViewport({ scale: 1 })
        setSize({ width: viewport.width, height: viewport.height })
        setDoc(loaded)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        captureError(error, { boundary: 'pdf-load' })
        setFailed(true)
      })
    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [url])

  // Jump to a cited page once the document is ready.
  useEffect(() => {
    if (!doc || !highlightPage) return
    document.getElementById(`pdf-page-${highlightPage}`)?.scrollIntoView({ block: 'start' })
  }, [doc, highlightPage])

  if (failed || !allowed) throw new Error('pdf-unreadable')
  if (!doc || !size) return <Skeleton height={520} radius={12} style={{ width: '100%', maxWidth: 640 }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: PAGE_GAP, width: '100%' }}>
      {Array.from({ length: doc.numPages }, (_, index) => (
        <PdfPage key={index} doc={doc} pageNumber={index + 1} scale={scale} size={size} highlighted={highlightPage === index + 1} passage={highlightPage === index + 1 ? passage : null} />
      ))}
    </div>
  )
}
