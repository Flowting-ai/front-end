// Warms the file page's chunks while the pointer is over a row, so opening a file does not wait on a
// download. The same dynamic import() calls the page itself makes, so the bundler shares the chunks.
// Only the PDF viewer (pdf.js) is large enough to matter; it is fetched only for PDF rows.

import type { Format } from '@/lib/library/schemas'

let pagePreloaded = false

export function preloadFilePage(format: Format): void {
  if (!pagePreloaded) {
    pagePreloaded = true
    void import('./FilePreview')
  }
  if (format === 'pdf') void import('./PdfViewer')
}
