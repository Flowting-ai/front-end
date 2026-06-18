import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import { fetchProjects } from './projects'

describe('fetchProjects', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
  })

  it('preserves the owning team from the project summary', async () => {
    apiFetchJson.mockResolvedValue([{
      id: 'project-1',
      team_id: 'team-1',
      title: 'Launch',
      description: '',
      updated_at: '2026-06-18T00:00:00Z',
      chat_count: 2,
      document_count: 3,
    }])

    await expect(fetchProjects()).resolves.toEqual([{
      id: 'project-1',
      teamId: 'team-1',
      title: 'Launch',
      description: '',
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])
  })
})
