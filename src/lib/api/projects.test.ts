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

  it('normalizes the camelCase backend shape and derives canEdit from ownership', async () => {
    apiFetchJson.mockResolvedValue([{
      id: 'project-1',
      ownerUserId: 'user-1',
      organizationId: 'org-1',
      visibility: 'workspace',
      title: 'Launch',
      description: '',
      tags: [],
      createdAt: '2026-06-18T00:00:00Z',
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])

    await expect(fetchProjects('user-1')).resolves.toEqual([{
      id: 'project-1',
      ownerUserId: 'user-1',
      teamId: 'org-1',
      visibility: 'workspace',
      canEdit: true,
      canManageVisibility: false,
      title: 'Launch',
      description: '',
      tags: [],
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])
  })

  it('falls back to personal visibility when the backend omits the field', async () => {
    apiFetchJson.mockResolvedValue([{
      id: 'project-1',
      ownerUserId: 'user-1',
      organizationId: 'org-1',
      title: 'Launch',
      description: '',
      tags: [],
      createdAt: '2026-06-18T00:00:00Z',
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])

    const [project] = await fetchProjects('user-1')
    expect(project.visibility).toBe('personal')
  })

  it('marks a project not owned by the caller as read-only', async () => {
    apiFetchJson.mockResolvedValue([{
      id: 'project-1',
      ownerUserId: 'user-1',
      organizationId: 'org-1',
      title: 'Launch',
      description: '',
      tags: [],
      createdAt: '2026-06-18T00:00:00Z',
      updatedAt: '2026-06-18T00:00:00Z',
      chatCount: 2,
      documentCount: 3,
    }])

    const [project] = await fetchProjects('some-other-user')
    expect(project.canEdit).toBe(false)
  })
})
