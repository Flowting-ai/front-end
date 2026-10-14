import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkServerEnv } from './env'
import { isCrossSiteMutation } from '@/lib/auth/route-policy'

const good = {
  SERVER_URL: 'https://api.example.com',
  APP_BASE_URL: 'https://app.example.com',
  AUTH0_DOMAIN: 'tenant.us.auth0.com',
  AUTH0_CLIENT_ID: 'id',
  AUTH0_CLIENT_SECRET: 'secret',
  AUTH0_SECRET: 'x'.repeat(32),
}

describe('checkServerEnv', () => {
  it('passes a complete config', () => {
    expect(checkServerEnv(good)).toEqual({ ok: true, missing: [], invalid: [] })
  })
  it('names missing and malformed variables without their values', () => {
    const report = checkServerEnv({ ...good, SERVER_URL: undefined, AUTH0_DOMAIN: 'https://tenant', AUTH0_SECRET: 'short', NEXT_PUBLIC_SERVER_URL: 'nope' })
    expect(report.ok).toBe(false)
    expect(report.missing).toEqual(['SERVER_URL'])
    expect(report.invalid.map(i => i.split(':')[0])).toEqual(['AUTH0_DOMAIN', 'AUTH0_SECRET', 'NEXT_PUBLIC_SERVER_URL'])
    expect(JSON.stringify(report)).not.toContain('short')
  })
})

describe('isCrossSiteMutation', () => {
  const url = 'https://app.example.com/api/chat'
  it('refuses a foreign origin on state-changing methods only', () => {
    expect(isCrossSiteMutation('POST', 'https://evil.example', url)).toBe(true)
    expect(isCrossSiteMutation('GET', 'https://evil.example', url)).toBe(false)
    expect(isCrossSiteMutation('POST', 'https://app.example.com', url)).toBe(false)
    expect(isCrossSiteMutation('POST', null, url)).toBe(false)
    expect(isCrossSiteMutation('DELETE', 'https://alias.example', url, ['https://alias.example'])).toBe(false)
  })
})

describe('GET /api/health', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

  it('is 503 with variable names when config is broken, 200 when all is well', async () => {
    vi.mock('@/lib/auth0', () => ({ auth0: {} }))
    for (const [k, v] of Object.entries(good)) vi.stubEnv(k, v)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    const { GET } = await import('@/app/api/health/route')
    const ok = await GET()
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ status: 'ok', checks: { config: 'ok', backend: 'ok' } })

    vi.stubEnv('AUTH0_CLIENT_SECRET', '')
    const bad = await GET()
    expect(bad.status).toBe(503)
    expect((await bad.json()).checks.config.missing).toEqual(['AUTH0_CLIENT_SECRET'])
  })
})
