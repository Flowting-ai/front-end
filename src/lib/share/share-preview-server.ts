import { cache } from 'react'
import { BACKEND_BASE, getSessionToken, isSafeId } from '@/lib/server/backend'
import { sharePreviewSchema } from '@/lib/api/share-schemas'
import type { PersonaSharePreview } from '@/lib/api/persona-shares'
import { previewFailure, type PreviewFailure } from './share-accept'

/**
 * Server-side load of a Super Link preview for /share/[id], so the page renders
 * the card (and its <title>) without a client round trip. `null` means "let the
 * browser fetch it" (no session, network trouble, timeout); the client keeps
 * its own fetch as the fallback.
 */
export type InitialSharePreview =
  | { kind: 'preview'; preview: PersonaSharePreview }
  | { kind: 'failure'; failure: PreviewFailure }

const PREVIEW_TIMEOUT_MS = 4_000

/** Pure mapping of the backend response; exported for tests. */
export function initialFromResponse(status: number, body: unknown): InitialSharePreview | null {
  if (status >= 200 && status < 300) {
    const parsed = sharePreviewSchema.safeParse(body)
    return parsed.success ? { kind: 'preview', preview: parsed.data } : null
  }
  const detail = body && typeof body === 'object' && 'detail' in body ? (body as { detail: unknown }).detail : undefined
  const failure = previewFailure({ status, message: typeof detail === 'string' ? detail : undefined })
  // Auth and server errors are better retried by the browser (token refresh, retry).
  if (failure.state === 'error') return null
  return { kind: 'failure', failure }
}

/** Deduped per request, so generateMetadata and the page share one backend call. */
export const loadSharePreviewOnServer = cache(async (id: string): Promise<InitialSharePreview | null> => {
  if (!isSafeId(id) || !BACKEND_BASE) return null
  const token = await getSessionToken()
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND_BASE}/persona-shares/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    })
    return initialFromResponse(res.status, await res.json().catch(() => null))
  } catch {
    return null
  }
})
