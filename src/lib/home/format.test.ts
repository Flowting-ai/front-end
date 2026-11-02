import { describe, expect, it } from 'vitest'
import {
  deltaColor, deltaDirection, deltaLabel, formatCount, formatCurrency, formatCurrencyCompact,
  formatDelta, formatMetric, formatOpportunityValue, formatPercent,
} from './format'
import { DATE_RANGE_OPTIONS, getHomeData } from './mock-data'

describe('currency', () => {
  it('formats whole dollars from $1,000 and cents below', () => {
    expect(formatCurrency(8_900)).toBe('$8,900')
    expect(formatCurrency(385.27)).toBe('$385.27')
  })
  it('compacts from $1,000 with a lower-case k', () => {
    expect(formatCurrencyCompact(1_885_200)).toBe('$1.9M')
    expect(formatCurrencyCompact(8_400)).toBe('$8.4k')
    expect(formatCurrencyCompact(385.27)).toBe('$385.27')
  })
})

describe('counts and percents', () => {
  it('groups counts', () => expect(formatCount(4_893)).toBe('4,893'))
  it('keeps percent digits', () => expect(formatPercent(0.53)).toBe('0.53%'))
  it('routes formatMetric by format', () => {
    expect(formatMetric(1_885_200, 'currency')).toBe('$1.9M')
    expect(formatMetric(4_893, 'count')).toBe('4,893')
    expect(formatMetric(0.53, 'percent')).toBe('0.53%')
  })
  it('formats opportunity values', () => {
    expect(formatOpportunityValue(5, 'days')).toBe('5 days')
    expect(formatOpportunityValue(1, 'days')).toBe('1 day')
    expect(formatOpportunityValue(8_900, 'currency')).toBe('$8,900')
    expect(formatOpportunityValue(3.3, 'signedPercent')).toBe('+3.3%')
    expect(formatOpportunityValue(-1.2, 'signedPercent')).toBe('-1.2%')
  })
})

describe('deltas', () => {
  it('reads direction from the sign', () => {
    expect(deltaDirection(3.3)).toBe('up')
    expect(deltaDirection(-0.6)).toBe('down')
    expect(deltaDirection(0)).toBe('flat')
  })
  it('shows magnitude only and speaks the direction', () => {
    expect(formatDelta(-0.6)).toBe('0.6%')
    expect(deltaLabel(3.3)).toBe('up 3.3%')
    expect(deltaLabel(-0.2)).toBe('down 0.2%')
    expect(deltaLabel(0)).toBe('no change')
  })
  it('colours up green, down red, flat muted', () => {
    expect(deltaColor(1)).toBe('var(--success-700)')
    expect(deltaColor(-1)).toBe('var(--danger-600)')
    expect(deltaColor(0)).toBe('var(--neutral-500)')
  })
})

describe('mock data', () => {
  it('has a dataset for every period option', () => {
    for (const { value } of DATE_RANGE_OPTIONS) expect(getHomeData(value).metrics).toHaveLength(4)
  })
  it('matches the design for the default 30-day period', () => {
    const d = getHomeData('30d')
    expect(d.metrics.map(m => formatMetric(m.value, m.format))).toEqual(['$1.9M', '4,893', '0.53%', '$385.27'])
    expect(d.metrics.map(m => deltaLabel(m.delta))).toEqual(['up 3.3%', 'up 3.5%', 'down 0.6%', 'down 0.2%'])
  })
})
