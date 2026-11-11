import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./user', () => ({ fetchCurrentUser: vi.fn() }))

import { fetchCurrentUser, type UserProfile } from './user'
import { getQueryClient } from '@/lib/query-client'
import { invalidateCredits } from '@/lib/query-invalidation'
import { currentUser } from './current-user'

const mockFetch = vi.mocked(fetchCurrentUser)
const profile = (name: string) => ({ id: 1, first_name: name }) as unknown as UserProfile

afterEach(() => {
  mockFetch.mockReset()
  currentUser.clear()
})

describe('currentUser (["me"] query)', () => {
  it('shares one request between concurrent loads and serves the cache after', async () => {
    mockFetch.mockResolvedValue(profile('Ana'))
    const [a, b] = await Promise.all([currentUser.load(), currentUser.load()])
    expect(a).toBe(b)
    await currentUser.load()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(currentUser.isFresh()).toBe(true)
  })

  it('refresh bypasses the cache; a failed read keeps the last good profile', async () => {
    mockFetch.mockResolvedValueOnce(profile('Ana')).mockResolvedValueOnce(null)
    await currentUser.load()
    await expect(currentUser.refresh()).resolves.toMatchObject({ first_name: 'Ana' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('a credits invalidation refetches the profile even with no observers', async () => {
    mockFetch.mockResolvedValueOnce(profile('Ana')).mockResolvedValueOnce(profile('Ana, topped up'))
    await currentUser.load()
    invalidateCredits(getQueryClient())
    await vi.waitFor(() => expect(currentUser.peek()).toMatchObject({ first_name: 'Ana, topped up' }))
  })
})
