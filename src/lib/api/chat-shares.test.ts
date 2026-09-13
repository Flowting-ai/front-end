import { afterEach, describe, expect, it, vi } from 'vitest'

import { createChatShare } from './chat-shares'

describe('createChatShare', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends exactly the chat and target user — person-to-person only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'share-1',
      chat_id: 'chat-1',
      shared_by_user_id: 'auth0|owner',
      shared_by_name: 'Owner',
      shared_by_email: 'owner@example.com',
      target_user_id: 'auth0|recipient',
      target_user_name: 'Recipient',
      target_user_email: 'recipient@example.com',
      created_at: '2026-06-18T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createChatShare({
      chatId: 'chat-1',
      userId: 'auth0|recipient',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      chatId: 'chat-1',
      userId: 'auth0|recipient',
    })
    expect(result.targetUserId).toBe('auth0|recipient')
  })
})
