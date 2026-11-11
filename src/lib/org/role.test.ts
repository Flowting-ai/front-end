import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminGate, resolveOrgRole } from './role'
import { clearOrgIdCache, orgIdCacheKey } from '@/lib/storage-keys'

describe('resolveOrgRole', () => {
  it.each([
    ['admin', { role: 'admin', resolved: true }],
    ['member', { role: 'member', resolved: true }],
    // Never inferred: a null or missing role is an unresolved member.
    [null, { role: 'member', resolved: false }],
    [undefined, { role: 'member', resolved: false }],
  ] as const)('%s', (apiRole, expected) => {
    expect(resolveOrgRole(apiRole)).toEqual(expected)
  })
})

describe('adminGate', () => {
  it('waits for the org, then allows only admins', () => {
    expect(adminGate(false, 'admin')).toBe('loading')
    expect(adminGate(true, 'admin')).toBe('allowed')
    expect(adminGate(true, 'member')).toBe('denied')
  })
})

describe('clearOrgIdCache', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('removes only org-id entries', () => {
    const store = new Map<string, string>([
      [orgIdCacheKey('u1'), 'o1'],
      [orgIdCacheKey('u2'), 'o2'],
      ['sidebar_collapsed', 'true'],
    ])
    vi.stubGlobal('localStorage', {
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => { store.delete(k) },
    })
    clearOrgIdCache()
    expect([...store.keys()]).toEqual(['sidebar_collapsed'])
  })

  it('does nothing without storage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => clearOrgIdCache()).not.toThrow()
  })
})
