// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@auth0/nextjs-auth0/client', () => ({ getAccessToken: vi.fn() }))

import { getAccessToken } from '@auth0/nextjs-auth0/client'
import {
  clearInMemoryAccessToken,
  ensureFreshToken,
  getAuth0AccessToken,
  getAuthHeaders,
  getInMemoryAccessToken,
  isTokenExpiringSoon,
  setInMemoryAccessToken,
} from './jwt-utils'

const mockGet = vi.mocked(getAccessToken)
const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const tokenExpiringIn = (seconds: number) => `h.${b64({ exp: Math.floor(Date.now() / 1000) + seconds, sub: 'auth0|u' })}.s`

afterEach(() => {
  mockGet.mockReset()
  clearInMemoryAccessToken()
})

describe('token module', () => {
  it('shares one Auth0 request between concurrent callers', async () => {
    let resolve: (t: string) => void = () => {}
    mockGet.mockReturnValue(new Promise<string>(r => { resolve = r }) as never)
    const a = getAuth0AccessToken()
    const b = getAuth0AccessToken()
    resolve(tokenExpiringIn(3600))
    expect(await a).toBe(await b)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('a failed fetch clears the token instead of keeping a stale one', async () => {
    setInMemoryAccessToken(tokenExpiringIn(3600))
    mockGet.mockRejectedValue(new Error('login_required') as never)
    await expect(getAuth0AccessToken()).resolves.toBeNull()
    expect(getInMemoryAccessToken()).toBeNull()
    expect(getAuthHeaders()).toEqual({})
  })

  it('ensureFreshToken reuses a valid token and refreshes one inside the 60 s buffer', async () => {
    const valid = tokenExpiringIn(3600)
    setInMemoryAccessToken(valid)
    await expect(ensureFreshToken()).resolves.toBe(valid)
    expect(mockGet).not.toHaveBeenCalled()

    setInMemoryAccessToken(tokenExpiringIn(30))
    expect(isTokenExpiringSoon()).toBe(true)
    const fresh = tokenExpiringIn(3600)
    mockGet.mockResolvedValue(fresh as never)
    await expect(ensureFreshToken()).resolves.toBe(fresh)
  })

  it('adds the bearer header only while a token is held', () => {
    expect(getAuthHeaders({ X: '1' })).toEqual({ X: '1' })
    setInMemoryAccessToken('a.b.c')
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer a.b.c' })
    clearInMemoryAccessToken()
    expect(getAuthHeaders()).toEqual({})
  })
})
