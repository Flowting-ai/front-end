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
// Pages fit the column. A small page (or a narrow slide) may grow to fill it, but not past this.
const MAX_SCALE = 2
// The canvas follows the screen's pixel density, up to 3x, and is never wider than MAX_CANVAS_PX.
const MAX_DENSITY = 3
const MAX_CANVAS_PX = 4096

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

/** The room a page has: the column's width and, when pages fit the screen (slides), the visible height. */
type Fit = { width: number; height: number | null }

function fitScale(size: PageSize, fit: Fit): number {
  const byWidth = fit.width / size.width
  const byHeight = fit.height ? fit.height / size.height : Infinity
  return Math.min(byWidth, byHeight, MAX_SCALE)
}

function PdfPage({ doc, pageNumber, fit, density, estimate, highlighted, passage }: { doc: PDFDocumentProxy; pageNumber: number; fit: Fit; density: number; estimate: PageSize; highlighted: boolean; passage?: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  // Pages can differ in size and orientation: each one is sized as page 1 until it is near the
  // viewport, then by its own size (only pages close to view change, so scrolling stays steady).
  const [own, setOwn] = useState<PageSize | null>(null)
  const size = own ?? estimate
  const scale = fitScale(size, fit)
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
    // Observed against the file page's scroller: the margin only reaches pages it clips when it is the root.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    }, { root: element.closest('.kaya-scrollbar'), rootMargin: '600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || own) return
    let cancelled = false
    doc.getPage(pageNumber)
      .then((page) => {
        if (cancelled) return
        const viewport = page.getViewport({ scale: 1 })
        setOwn({ width: viewport.width, height: viewport.height })
      })
      .catch((error: unknown) => { if (!cancelled) captureError(error, { boundary: 'pdf-page' }) })
    return () => { cancelled = true }
  }, [visible, own, doc, pageNumber])

  useEffect(() => {
    if (!visible || !own) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    ;(async () => {
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled || !canvasRef.current) return
        const base = page.getViewport({ scale })
        const ratio = Math.min(density, MAX_DENSITY, MAX_CANVAS_PX / base.width)
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
  }, [visible, own, doc, pageNumber, scale, density])

  return (
    <div
      ref={boxRef}
      id={`pdf-page-${pageNumber}`}
      style={{
        width: size.width * scale, height: size.height * scale, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)',
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
  /** Fit each page inside the visible area, not just the column width: a slide is seen whole, without scrolling. */
  fitScreen?: boolean
}

// What the file page lays over its scroller (top bar, the Ask composer) and some air: a page fit to the
// screen leaves this much of the scroller's height free.
const SCREEN_RESERVE = 220
const MIN_FIT_HEIGHT = 240

// Sizes are rounded down to this step so a small resize does not redraw every page.
const roundDown = (value: number) => Math.floor(value / 8) * 8

/** The screen's pixel density, updated when it changes (browser zoom, a move to another monitor). */
function useDevicePixelRatio(): number {
  const [ratio, setRatio] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  useEffect(() => {
    // A resolution query matches only the current density, so it is re-made after each change. Browser
    // zoom also fires resize, which covers browsers whose resolution queries do not report changes.
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`)
    const update = () => setRatio(window.devicePixelRatio || 1)
    query.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [ratio])
  return ratio
}

/** A PDF as a scrolling stack of pages with zoom. Scripting is off; only the page images are drawn. */
export default function PdfViewer({ url, highlightPage, passage, fitScreen = false }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<PageSize | null>(null)
  const [failed, setFailed] = useState(false)
  const density = useDevicePixelRatio()
  // Pages fit the column (and, for slides, the visible height), so a page of any size is drawn at the
  // size it is shown instead of squeezed or stretched.
  const columnRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(0)
  const [screenHeight, setScreenHeight] = useState(0)
  useEffect(() => {
    const element = columnRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setColumnWidth(roundDown(entry.contentRect.width)))
    observer.observe(element)
    // The file page's scroller; without one (another host), the window.
    const scroller = fitScreen ? element.closest<HTMLElement>('.kaya-scrollbar') : null
    const measureHeight = () => setScreenHeight(roundDown(scroller?.clientHeight ?? window.innerHeight))
    let heightObserver: ResizeObserver | null = null
    if (fitScreen) {
      measureHeight()
      if (scroller) {
        heightObserver = new ResizeObserver(measureHeight)
        heightObserver.observe(scroller)
      } else {
        window.addEventListener('resize', measureHeight)
      }
    }
    return () => {
      observer.disconnect()
      heightObserver?.disconnect()
      window.removeEventListener('resize', measureHeight)
    }
  }, [doc, fitScreen])
  const fit: Fit = {
    width: columnWidth,
    height: fitScreen && screenHeight > 0 ? Math.max(screenHeight - SCREEN_RESERVE, MIN_FIT_HEIGHT) : null,
  }

  // A URL that is not safe to load is decided during render, not in an effect.
  const allowed = isPdfUrlAllowed(url)

  useEffect(() => {
    const source = resolvePdfSource(url)
    if (!source) return
    let cancelled = false
    const task = getDocument({ url: source.url, withCredentials: false, enableXfa: false })
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
    <div ref={columnRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: PAGE_GAP, width: '100%' }}>
      {columnWidth > 0 && Array.from({ length: doc.numPages }, (_, index) => (
        <PdfPage key={index} doc={doc} pageNumber={index + 1} fit={fit} density={density} estimate={size} highlighted={highlightPage === index + 1} passage={highlightPage === index + 1 ? passage : null} />
      ))}
    </div>
  )
}
