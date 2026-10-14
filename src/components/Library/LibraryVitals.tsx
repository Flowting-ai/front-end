'use client'

import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { isLibraryVital, libraryPageOf, trackLibrary } from '@/lib/library/analytics'

/**
 * Reports LCP, CLS and INP for the Library pages as web_vital events: the metric, its rating and
 * which page (list, trash, file). Never the URL or a file id. Rendered once by the Library layout.
 */
export function LibraryVitals() {
  const pathname = usePathname()
  useReportWebVitals((metric) => {
    const page = libraryPageOf(pathname)
    if (!page || !isLibraryVital(metric.name)) return
    trackLibrary('web_vital', { metric: metric.name, rating: metric.rating, page })
  })
  return null
}
