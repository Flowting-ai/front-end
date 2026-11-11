// Warms the file page while the pointer is over a row, so opening a file does not wait on a
// download: its chunks (the same dynamic import() calls the page itself makes, so the bundler shares
// them) and, after a short hover, its details and first preview. Only the PDF viewer (pdf.js) is
// large enough to matter as code; it is fetched only for PDF rows.

import type { Format } from '@/lib/library/schemas'
import { warmFile } from '@/lib/library/warm'

// A pointer sweeping across rows should not fetch every file it passes.
const HOVER_MS = 120

let pagePreloaded = false
let pending: ReturnType<typeof setTimeout> | null = null

export function preloadFilePage(format: Format, id?: string): void {
  if (!pagePreloaded) {
    pagePreloaded = true
    void import('./FilePreview')
  }
  if (format === 'pdf') void import('./PdfViewer')
  if (id === undefined) return
  cancelFilePreload()
  pending = setTimeout(() => { pending = null; warmFile(id) }, HOVER_MS)
}

export function cancelFilePreload(): void {
  if (pending) { clearTimeout(pending); pending = null }
}
