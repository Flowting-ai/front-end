import { describe, expect, it } from 'vitest'
import { inSample, vitalEventProps, webVitalsSampleRate } from './web-vitals'

describe('web vitals', () => {
  it('reads the sample rate, clamped, defaulting to 10%', () => {
    expect(webVitalsSampleRate(undefined)).toBe(0.1)
    expect(webVitalsSampleRate('1')).toBe(1)
    expect(webVitalsSampleRate('5')).toBe(1)
    expect(webVitalsSampleRate('-1')).toBe(0)
    expect(webVitalsSampleRate('junk')).toBe(0.1)
  })

  it('samples per load and never at 0', () => {
    expect(inSample(0.5, () => 0.2)).toBe(true)
    expect(inSample(0.5, () => 0.8)).toBe(false)
    expect(inSample(0, () => 0)).toBe(false)
  })

  it('shapes tracked metrics only; CLS scaled to an integer', () => {
    expect(vitalEventProps({ name: 'LCP', value: 1234.6, rating: 'good' }, 'chat')).toEqual({ metric: 'LCP', value: 1235, rating: 'good', screen: 'chat' })
    expect(vitalEventProps({ name: 'CLS', value: 0.123 }, null)).toMatchObject({ value: 123, rating: 'unknown', screen: 'unmapped' })
    expect(vitalEventProps({ name: 'Next.js-hydration', value: 10 }, 'chat')).toBeNull()
  })
})
