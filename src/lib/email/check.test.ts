import { describe, expect, it } from 'vitest'
import { isValidEmail, suggestEmail } from './check'

describe('isValidEmail', () => {
  it.each(['sam@company.com', 'sam.lee+x@mail.company.co.uk', 'a1@b-c.io'])('accepts %s', email => {
    expect(isValidEmail(email)).toBe(true)
  })
  it.each(['sam', 'sam@company', 'sam @company.com', 'sam@@x.com', '.sam@x.com', 'sam.@x.com', 'sa..m@x.com', 'a@b.c', 'sam@-x.com', 'sam@x..com'])('rejects %s', email => {
    expect(isValidEmail(email)).toBe(false)
  })
})

describe('suggestEmail', () => {
  it('fixes near misses of common providers', () => {
    expect(suggestEmail('sam@gmial.com')).toBe('sam@gmail.com')
    expect(suggestEmail('sam@hotmial.com')).toBe('sam@hotmail.com')
    expect(suggestEmail('sam@outlok.com')).toBe('sam@outlook.com')
  })
  it('fixes mistyped endings on any domain', () => {
    expect(suggestEmail('sam@acme.con')).toBe('sam@acme.com')
    expect(suggestEmail('sam@acme.ogr')).toBe('sam@acme.org')
  })
  it('leaves correct and unknown domains alone', () => {
    expect(suggestEmail('sam@gmail.com')).toBeNull()
    expect(suggestEmail('sam@acme.com')).toBeNull()
    expect(suggestEmail('sam@souvenir.ai')).toBeNull()
  })
})
