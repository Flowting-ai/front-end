import { describe, expect, it } from 'vitest'
import { EMAIL_PATTERN, defaultCreditLimit, linkUsageText, parseCreditLimit } from './share-limit'

describe('share limits', () => {
  it('accepts whole numbers within the plan maximum only', () => {
    expect(parseCreditLimit(' 500 ', 1000)).toBe(500)
    expect(parseCreditLimit('0', 1000)).toBeNull()
    expect(parseCreditLimit('1001', 1000)).toBeNull()
    expect(parseCreditLimit('12.5', 1000)).toBeNull()
    expect(parseCreditLimit('', 1000)).toBeNull()
  })

  it('defaults to half the plan allowance, at least 1', () => {
    expect(defaultCreditLimit(1000)).toBe(500)
    expect(defaultCreditLimit(1)).toBe(1)
  })

  it('describes link usage', () => {
    expect(linkUsageText({ credit_limit: 5000, credit_used: 1200 })).toBe('1,200 / 5,000 credits used')
    expect(linkUsageText({ credit_limit: null, credit_used: 3 })).toBe('Unlimited credits')
    expect(linkUsageText(null)).toBeNull()
  })

  it('checks email shape', () => {
    expect(EMAIL_PATTERN.test('a@b.co')).toBe(true)
    expect(EMAIL_PATTERN.test('a@b')).toBe(false)
  })
})
