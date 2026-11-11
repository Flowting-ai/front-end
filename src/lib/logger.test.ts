import { describe, expect, it, vi } from 'vitest'
import { logger, redact } from './logger'

describe('redact', () => {
  it('hides sensitive keys at any depth, including camelCase variants', () => {
    expect(redact({ user: { accessToken: 'abc', name: 'n' }, Authorization: 'x' })).toEqual({
      user: { accessToken: '[REDACTED]', name: 'n' },
      Authorization: '[REDACTED]',
    })
  })

  it('hides bearer tokens and JWTs inside strings and errors', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart'
    expect(redact(`header Bearer ${jwt} end`)).toBe('header Bearer [REDACTED] end')
    expect(redact(`token=${jwt}`)).toBe('token=[REDACTED_JWT]')
    expect(redact(new Error(`bad ${jwt}`))).toEqual({ name: 'Error', message: 'bad [REDACTED_JWT]' })
  })

  it('logger.event writes one redacted JSON line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.event('auth_login_failed', { code: 'access_denied', token: 't' })
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ event: 'auth_login_failed', code: 'access_denied', token: '[REDACTED]' })
    warn.mockRestore()
  })
})
