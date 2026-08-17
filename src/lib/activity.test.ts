import { describe, expect, it } from 'vitest'

import { normalizeActivityStatus, toolNameToType } from '@/lib/activity'

describe('activity normalization', () => {
  it('renders the browser capability as web activity', () => {
    expect(toolNameToType('browser')).toBe('web-search')
  })

  it('keeps backend failures terminal instead of turning them green', () => {
    expect(normalizeActivityStatus('error')).toBe('error')
    expect(normalizeActivityStatus('failed')).toBe('error')
    expect(normalizeActivityStatus('failure')).toBe('error')
  })
})
