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

  it('preserves the owning organization from the project summary', async () => {
    apiFetchJson.mockResolvedValue([{
      id: 'project-1',
      owner_user_id: 'user-1',
      organization_id: 'org-1',
      visibility: 'org',
      can_edit: true,
      can_manage_visibility: true,
      title: 'Launch',
      description: '',
      tags: [],
      updated_at: '2026-06-18T00:00:00Z',
      chat_count: 2,
      document_count: 3,
    }])

    await expect(fetchProjects()).resolves.toEqual([{
      id: 'project-1',
      ownerUserId: 'user-1',
      teamId: 'org-1',
      visibility: 'team',
      canEdit: true,
      canManageVisibility: true,
      title: 'Launch',
      description: '',
      tags: [],
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])
  })
})
