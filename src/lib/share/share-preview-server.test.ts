import { describe, expect, it, vi } from 'vitest'

// The module imports next/headers through lib/server/backend; only the pure mapper is tested.
vi.mock('@/lib/server/backend', () => ({ BACKEND_BASE: '', getSessionToken: async () => null, isSafeId: () => true }))

import { initialFromResponse } from './share-preview-server'

const preview = {
  share_id: 's1', persona_name: 'Researcher', description: null, prompt: 'p', model_id: null,
  temperature: null, image_url: null, shared_by_name: 'Sam', shared_by_email: 's@x.com',
  expires_at: '2026-12-01T00:00:00Z', credit_limit: null, credit_remaining: null,
}

describe('initialFromResponse', () => {
  it('returns the parsed preview on 200', () => {
    expect(initialFromResponse(200, preview)).toMatchObject({ kind: 'preview', preview: { persona_name: 'Researcher' } })
  })

  it('maps 404 and 410 to their states so the page renders them at once', () => {
    expect(initialFromResponse(404, { detail: 'nope' })).toEqual({ kind: 'failure', failure: { state: 'not_found' } })
    expect(initialFromResponse(410, {})).toEqual({ kind: 'failure', failure: { state: 'expired' } })
  })

  it('leaves auth, server errors and malformed bodies to the browser fetch', () => {
    expect(initialFromResponse(401, { detail: 'expired token' })).toBeNull()
    expect(initialFromResponse(503, null)).toBeNull()
    expect(initialFromResponse(200, { persona_name: 1 })).toBeNull()
  })
})
