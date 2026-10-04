import { describe, expect, it } from 'vitest'
import { getPersonaFallbackAvatar, pickDifferentTemplateAvatar, pickTemplateAvatar } from '@/lib/persona-template-avatars'

describe('getPersonaFallbackAvatar', () => {
  it('returns a stable marble avatar for the same backend persona id', () => {
    const id = '97b146f2-1111-2222-3333-444444444444'
    expect(getPersonaFallbackAvatar(id)).toBe(getPersonaFallbackAvatar(id))
    expect(getPersonaFallbackAvatar(id)).toMatch(/^\/persona-avatars\/.+\.jpg$/)
  })
})

describe('pickDifferentTemplateAvatar', () => {
  it('never returns the current avatar', () => {
    const current = pickTemplateAvatar()
    for (let i = 0; i < 50; i++) expect(pickDifferentTemplateAvatar(current)).not.toBe(current)
  })

  it('still returns a pool avatar when the current one is not from the pool', () => {
    expect(pickDifferentTemplateAvatar('data:image/jpeg;base64,AAAA')).toMatch(/^\/persona-avatars\/.+\.jpg$/)
    expect(pickDifferentTemplateAvatar(null)).toMatch(/^\/persona-avatars\/.+\.jpg$/)
  })
})
