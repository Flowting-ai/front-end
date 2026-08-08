import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import { getChatBrowserLiveView } from './browser'

describe('getChatBrowserLiveView', () => {
  beforeEach(() => apiFetchJson.mockReset())

  it('loads and normalizes the authenticated chat browser URL', async () => {
    apiFetchJson.mockResolvedValue({
      url: 'https://6080-sandbox.e2b.app/vnc.html?auth=secret',
      view_only: true,
      expires_at: '2026-08-07T12:30:00Z',
    })

    await expect(getChatBrowserLiveView('chat-1')).resolves.toEqual({
      url: 'https://6080-sandbox.e2b.app/vnc.html?auth=secret',
      viewOnly: true,
      expiresAt: '2026-08-07T12:30:00Z',
    })
    expect(apiFetchJson).toHaveBeenCalledWith(expect.stringContaining('/chats/chat-1/browser/live'))
  })

  it('rejects a non-HTTPS remote stream URL', async () => {
    apiFetchJson.mockResolvedValue({ url: 'http://attacker.example/vnc.html' })
    await expect(getChatBrowserLiveView('chat-1')).rejects.toThrow('insecure live-view URL')
  })
})
