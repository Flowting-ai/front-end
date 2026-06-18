import { afterEach, describe, expect, it, vi } from 'vitest'

import { createChatShare } from './chat-shares'

describe('createChatShare', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends exactly one team target with the selected access mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'share-1',
      chat_id: 'chat-1',
      mode: 'editable',
      shared_by_user_id: 'auth0|owner',
      shared_by_name: 'Owner',
      target_user_id: null,
      target_user_name: null,
      target_user_email: null,
      target_team_id: 'team-1',
      target_project_id: null,
      created_at: '2026-06-18T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createChatShare({
      chatId: 'chat-1',
      teamId: 'team-1',
      mode: 'editable',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      chatId: 'chat-1',
      mode: 'editable',
      teamId: 'team-1',
    })
    expect(result.targetTeamId).toBe('team-1')
  })
})
