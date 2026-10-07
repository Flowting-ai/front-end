import { describe, expect, it } from 'vitest'
import { parseSidebarCollapsed } from './storage-keys'

describe('parseSidebarCollapsed', () => {
  it('is collapsed only for "true"', () => {
    expect(parseSidebarCollapsed('true')).toBe(true)
  })

  it.each([undefined, null, '', 'false', 'TRUE', '1', ' true'])('is expanded for %j', (value) => {
    expect(parseSidebarCollapsed(value)).toBe(false)
  })
})
