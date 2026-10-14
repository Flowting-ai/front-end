import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { isAuthError, loginUrlFor } from './auth-error'

describe('isAuthError', () => {
  it('recognises lost sessions', () => {
    expect(isAuthError(new ApiError(401, 'x', 'Signed out'))).toBe(true)
    expect(isAuthError({ code: 'login_required' })).toBe(true)
    expect(isAuthError(new Error('Your session has expired'))).toBe(true)
  })
  it('leaves other failures to the generic screen', () => {
    expect(isAuthError(new ApiError(403, 'x', 'No access'))).toBe(false)
    expect(isAuthError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })
  it('builds a login URL that returns to the page', () => {
    expect(loginUrlFor('/auth/login', '/chat?id=1')).toBe('/auth/login?returnTo=%2Fchat%3Fid%3D1')
  })
})
