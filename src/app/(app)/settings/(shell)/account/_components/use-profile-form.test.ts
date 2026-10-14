import { describe, expect, it } from 'vitest'
import { validateForm } from '@/lib/forms/zod-form'
import { MAX_NAME_LENGTH, profileChanges, profileSchema } from './use-profile-form'

const base = { firstName: 'Ada', lastName: 'Lovelace', avatar: null }

describe('profileChanges', () => {
  it('ignores spacing around names, as the backend stores them trimmed', () => {
    expect(profileChanges(base, { ...base, firstName: ' Ada ' }).isDirty).toBe(false)
  })

  it('tracks name and picture changes separately', () => {
    expect(profileChanges(base, { ...base, lastName: 'Byron' })).toEqual({ nameChanged: true, avatarChanged: false, isDirty: true })
    expect(profileChanges(base, { ...base, avatar: 'data:image/png;base64,x' })).toEqual({ nameChanged: false, avatarChanged: true, isDirty: true })
  })
})

describe('profileSchema', () => {
  it('trims names and allows them empty', () => {
    expect(validateForm(profileSchema, { firstName: ' Ada ', lastName: '', avatar: null }).data).toEqual({ firstName: 'Ada', lastName: '', avatar: null })
  })

  it('caps the name length', () => {
    expect(validateForm(profileSchema, { ...base, firstName: 'a'.repeat(MAX_NAME_LENGTH + 1) }).errors.firstName).toMatch(/characters or fewer/)
  })
})
