import { describe, expect, it, vi } from 'vitest'
import { decodeEntities, formatBuilt, formatBytes, loadTemplate, stateForStatus } from './template-view'

const UUID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b'
const VALID = {
  id: UUID,
  title: 'Revenue &amp; funnel',
  url: '/template/x',
  byte_size: 2048,
  created_at: '2026-10-01T12:00:00Z',
  revoked: false,
}

describe('decodeEntities', () => {
  it.each([
    ['Revenue &amp; funnel', 'Revenue & funnel'],
    ['&lt;b&gt; &quot;x&quot; &apos;y&apos;', `<b> "x" 'y'`],
    ['&#65;&#x42;&#X43;', 'ABC'],
    ['&unknown; stays', '&unknown; stays'],
    ['&#x110000; stays', '&#x110000; stays'],
    ['&#99999999999; stays', '&#99999999999; stays'],
  ])('%s', (input, expected) => {
    expect(decodeEntities(input)).toBe(expected)
  })
})

describe('format helpers', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('survives an invalid date', () => {
    expect(formatBuilt('nope')).toBe('at an unknown time')
  })
})

describe('loadTemplate', () => {
  const load = (fetchImpl: typeof fetch) => loadTemplate('http://be', UUID, 'tok', fetchImpl)

  it('returns the parsed template', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(VALID))
    expect(await load(fetchImpl)).toEqual({ state: 'ok', template: VALID })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`http://be/templates/${UUID}`)
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    [403, 'forbidden'],
    [404, 'not_found'],
    [410, 'revoked'],
    [500, 'error'],
  ])('maps %i to %s', async (status, state) => {
    expect(await load(vi.fn().mockResolvedValue(new Response('x', { status })))).toEqual({ state })
  })

  it('treats invalid JSON and schema mismatches as errors', async () => {
    expect(await load(vi.fn().mockResolvedValue(new Response('<html>')))).toEqual({ state: 'error' })
    expect(await load(vi.fn().mockResolvedValue(Response.json({ id: 'x' })))).toEqual({ state: 'error' })
  })

  it('distinguishes timeouts from network errors', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
    expect(await load(vi.fn().mockRejectedValue(timeout))).toEqual({ state: 'timeout' })
    expect(await load(vi.fn().mockRejectedValue(new TypeError('fetch failed')))).toEqual({ state: 'error' })
  })

  it('maps 504 to timeout', () => {
    expect(stateForStatus(504)).toBe('timeout')
  })
})
