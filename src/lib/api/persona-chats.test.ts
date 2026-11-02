import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetch, apiFetchJson, listVersions, fetchPersonas } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiFetchJson: vi.fn(),
  listVersions: vi.fn(),
  fetchPersonas: vi.fn(),
}))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetch, apiFetchJson }
})
vi.mock('./persona-versions', () => ({ listVersions }))
vi.mock('./persona-list', () => ({ fetchPersonas }))

import { CHATS_ENDPOINT, CHATS_RENAME_ENDPOINT } from '@/lib/config'
import {
  bustPersonaChatsCache,
  deletePersonaChat,
  fetchAgentChatsFor,
  fetchPersonaChats,
  renamePersonaChat,
} from './persona-chats'

function chatRow(id: string, personaId: string | null) {
  return { id, chat_title: `Chat ${id}`, message_count: 1, persona_id: personaId, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }
}

beforeEach(() => {
  bustPersonaChatsCache()
  vi.clearAllMocks()
  apiFetch.mockResolvedValue(new Response(null, { status: 200 }))
})

describe('fetchPersonaChats', () => {
  it('lists GET /chats filtered to every version of the agent', async () => {
    apiFetchJson.mockResolvedValue([chatRow('c1', 'v1'), chatRow('c2', 'v-other'), chatRow('c3', 'v2'), chatRow('c4', null)])
    listVersions.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])

    const chats = await fetchPersonaChats('repo-1')

    expect(apiFetchJson).toHaveBeenCalledWith(CHATS_ENDPOINT)
    expect(listVersions).toHaveBeenCalledWith('repo-1')
    expect(chats.map(c => [c.id, c.versionId])).toEqual([['c1', 'v1'], ['c3', 'v2']])
  })

  it('falls back to the live and working versions when the version list is owner-only', async () => {
    apiFetchJson.mockResolvedValue([chatRow('c1', 'live'), chatRow('c2', 'old'), chatRow('c3', 'work')])
    listVersions.mockRejectedValue(new Error('403'))
    fetchPersonas.mockResolvedValue([{ id: 'repo-1', activeVersionId: 'live', workingVersionId: 'work' }])

    expect((await fetchPersonaChats('repo-1')).map(c => c.id)).toEqual(['c1', 'c3'])
  })

  it('shares one GET /chats across agents', async () => {
    apiFetchJson.mockResolvedValue([chatRow('a1', 'va'), chatRow('b1', 'vb')])
    listVersions.mockImplementation(async (repoId: string) => [{ id: repoId === 'a' ? 'va' : 'vb' }])

    const { chats, failed } = await fetchAgentChatsFor([{ id: 'a' }, { id: 'b' }])

    expect(apiFetchJson).toHaveBeenCalledTimes(1)
    expect(failed).toBe(0)
    expect(chats.map(c => [c.id, c.personaId])).toEqual([['a1', 'a'], ['b1', 'b']])
  })
})

describe('agent chat requests', () => {
  it('renames and deletes through the regular /chats routes', async () => {
    await renamePersonaChat('repo-1', 'chat-1', 'New title')
    await deletePersonaChat('repo-1', 'chat-1')

    expect(apiFetch).toHaveBeenNthCalledWith(1, CHATS_RENAME_ENDPOINT, {
      method: 'PATCH',
      body: JSON.stringify({ chat_id: 'chat-1', chat_title: 'New title' }),
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, CHATS_ENDPOINT, {
      method: 'DELETE',
      body: JSON.stringify({ chat_id: 'chat-1' }),
    })
  })
})
