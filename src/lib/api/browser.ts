import { CHAT_BROWSER_LIVE_ENDPOINT } from '@/lib/config'
import { apiFetchJson } from './client'

interface BrowserLiveViewResponse {
  url:         string
  view_only?:  boolean
  expires_at?: string | null
}

export interface BrowserLiveView {
  url:       string
  viewOnly:  boolean
  expiresAt: string | null
}

/** Resolve a fresh authenticated URL for the live browser attached to a chat. */
export async function getChatBrowserLiveView(chatId: string): Promise<BrowserLiveView> {
  const data = await apiFetchJson<BrowserLiveViewResponse>(CHAT_BROWSER_LIVE_ENDPOINT(chatId))
  const url = data.url?.trim()

  if (!url) throw new Error('The browser service returned no live-view URL.')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('The browser service returned an invalid live-view URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('The browser service returned an insecure live-view URL.')
  }

  return {
    url: parsed.toString(),
    viewOnly: data.view_only !== false,
    expiresAt: data.expires_at ?? null,
  }
}
