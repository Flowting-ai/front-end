'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { routeToScreen } from '@/lib/analytics/screens'
import { inSample, vitalEventProps, webVitalsSampleRate } from '@/lib/analytics/web-vitals'

const SAMPLED = inSample(webVitalsSampleRate())

/**
 * Sends Core Web Vitals (LCP, INP, CLS, FCP, TTFB) as `web_vital` events,
 * tagged with the screen concept (not the URL, which can carry ids). Sampled
 * per page load (NEXT_PUBLIC_WEB_VITALS_SAMPLE, default 10%; decision D6).
 */
export function WebVitalsReporter() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  useReportWebVitals(metric => {
    if (!SAMPLED) return
    const props = vitalEventProps(metric, routeToScreen(pathRef.current ?? ''))
    if (props) trackBrowserEvent('web_vital', props)
  })
  return null
}
