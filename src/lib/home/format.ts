// Number formatting for the Home page. Everything goes through Intl so locale-aware grouping and
// currency symbols come for free; the page never hand-writes "$1.9M" style strings.

const LOCALE = 'en-US'

/** $8,900 / $385.27 — two decimals below $1,000, whole dollars above. */
export function formatCurrency(value: number, currency = 'USD'): string {
  const decimals = Math.abs(value) < 1_000 ? 2 : 0
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value)
}

/** $1.9M / $8.4k — compact from $1,000 up (lower-case k, as the design writes it), else formatCurrency. */
export function formatCurrencyCompact(value: number, currency = 'USD'): string {
  if (Math.abs(value) < 1_000) return formatCurrency(value, currency)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1,
  }).format(value).replace('K', 'k')
}

/** 4,893 */
export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value)
}

/** A ratio given in percent units (0.53 → "0.53%"). */
export function formatPercent(value: number, fractionDigits = 2): string {
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  }).format(value)}%`
}

export type MetricFormat = 'currency' | 'count' | 'percent'

export function formatMetric(value: number, format: MetricFormat): string {
  switch (format) {
    case 'currency': return formatCurrencyCompact(value)
    case 'count':    return formatCount(value)
    case 'percent':  return formatPercent(value)
  }
}

export type DeltaDirection = 'up' | 'down' | 'flat'

export function deltaDirection(delta: number): DeltaDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

/** The visible delta: magnitude only, the arrow carries the sign ("3.3%"). */
export function formatDelta(delta: number): string {
  return formatPercent(Math.abs(delta), 1)
}

/** The spoken delta for screen readers ("up 3.3%", "down 0.6%", "no change"). */
export function deltaLabel(delta: number): string {
  const dir = deltaDirection(delta)
  return dir === 'flat' ? 'no change' : `${dir} ${formatDelta(delta)}`
}

/** CSS colour token for a delta: success up, danger down, muted flat. */
export function deltaColor(delta: number): string {
  const dir = deltaDirection(delta)
  if (dir === 'up') return 'var(--success-700)'
  if (dir === 'down') return 'var(--danger-600)'
  return 'var(--neutral-500)'
}

export type OpportunityValueFormat = 'days' | 'currency' | 'signedPercent'

/** The big number on an opportunity row: "5 days", "$8,900", "+3.3%". */
export function formatOpportunityValue(value: number, format: OpportunityValueFormat): string {
  switch (format) {
    case 'days':          return `${formatCount(value)} ${Math.abs(value) === 1 ? 'day' : 'days'}`
    case 'currency':      return formatCurrency(value)
    case 'signedPercent': return `${value > 0 ? '+' : ''}${formatPercent(value, 1)}`
  }
}
