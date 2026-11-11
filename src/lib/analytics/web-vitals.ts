/**
 * Core Web Vitals sampling and shaping for analytics (decision D6). Pure, so
 * the reporter component stays a thin wrapper around next/web-vitals.
 */

export interface VitalMetric {
  name: string
  value: number
  rating?: 'good' | 'needs-improvement' | 'poor'
  navigationType?: string
}

/** Metrics worth sending: the Core Web Vitals plus TTFB and FCP. */
const TRACKED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])

/** Sample rate from env (0–1); default 0.1 so a busy day doesn't flood Mixpanel. */
export function webVitalsSampleRate(raw: string | undefined = process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE): number {
  const n = Number(raw)
  if (raw === undefined || raw === '' || !Number.isFinite(n)) return 0.1
  return Math.min(1, Math.max(0, n))
}

/** One decision per page load, so all of a load's metrics are kept or dropped together. */
export function inSample(rate: number, random: () => number = Math.random): boolean {
  return rate > 0 && random() < rate
}

/** Event props for a metric, or null to skip it. CLS is unitless (×1000 to keep integers); the rest are ms. */
export function vitalEventProps(metric: VitalMetric, screen: string | null): { metric: string; value: number; rating: string; screen: string; navigation?: string } | null {
  if (!TRACKED.has(metric.name) || !Number.isFinite(metric.value)) return null
  return {
    metric: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    rating: metric.rating ?? 'unknown',
    screen: screen ?? 'unmapped',
    ...(metric.navigationType ? { navigation: metric.navigationType } : {}),
  }
}
