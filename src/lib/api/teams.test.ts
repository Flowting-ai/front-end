import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import { listTeamConnections } from './teams'

describe('listTeamConnections', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
  })

  it('preserves credential field metadata for team account linking', async () => {
    apiFetchJson.mockResolvedValue([{
      slug: 'shopify',
      display_name: 'Shopify',
      auth_mode: 'oauth2',
      api_key_fields: [{
        name: 'subdomain',
        label: 'Store Subdomain',
        help: 'your-store',
        secret: false,
        required: true,
      }],
      status: 'approved',
      tools: [],
      accounts: [],
    }])

    const [connection] = await listTeamConnections('org-1', 'team-1')

    expect(connection.apiKeyFields).toEqual([{
      name: 'subdomain',
      label: 'Store Subdomain',
      help: 'your-store',
      secret: false,
      required: true,
    }])
  })
})
