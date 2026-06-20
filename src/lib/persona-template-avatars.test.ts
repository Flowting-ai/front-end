import { describe, expect, it } from 'vitest'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'

describe('getPersonaFallbackAvatar', () => {
  it('returns a stable marble avatar for the same backend persona id', () => {
    const id = '97b146f2-1111-2222-3333-444444444444'
    expect(getPersonaFallbackAvatar(id)).toBe(getPersonaFallbackAvatar(id))
    expect(getPersonaFallbackAvatar(id)).toMatch(/^\/persona-avatars\/.+\.jpg$/)
  })
})
