import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import {
  bustConnectorCatalogCache,
  completeZapierLink,
  ConnectorCatalog,
  listConnectors,
} from './connectors'

const GMAIL_LIST = {
  slug: 'gmail',
  display_name: 'Gmail',
  auth_mode: 'oauth2',
  provider: 'pipedream',
  description: 'Send and read mail.',
  logo_url: 'https://cdn.example.com/gmail.png',
  categories: ['Communication'],
  catalog_metadata: { name_slug: 'gmail', featured_weight: 12 },
  tools: [],
  api_key_fields: [],
  linked: true,
  connections: [
    {
      id: '2b0b8f8e-0000-4000-8000-000000000002',
      nickname: 'Personal Gmail',
      scope: 'personal',
      connector_slug: 'gmail',
      account_identifier: 'me@example.com',
      connected: true,
      status: 'active',
      version: 1,
      linked_by_user_id: null,
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    },
    {
      id: '2b0b8f8e-0000-4000-8000-000000000001',
      nickname: 'Marketing Gmail',
      scope: 'shared',
      connector_slug: 'gmail',
      account_identifier: 'marketing@example.com',
      connected: true,
      status: 'active',
      version: 1,
      linked_by_user_id: 'auth0|editor',
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    },
  ],
}

const GMAIL_DETAIL = {
  ...GMAIL_LIST,
  tools: [
    {
      key: 'gmail-find-email',
      name: 'Find Email',
      description: 'Search the mailbox.',
      read_only: true,
      permission: 'ask',
    },
    {
      key: 'gmail-send-email',
      name: 'Send Email',
      description: 'Send a message.',
      read_only: false,
      permission: 'allowed',
    },
  ],
}

describe('ConnectorCatalog', () => {
  it('parses a ds-dev member catalog with private and shared connections', () => {
    const entry = ConnectorCatalog.parse(GMAIL_LIST)

    expect(entry.slug).toBe('gmail')
    expect(entry.description).toBe('Send and read mail.')
    expect(entry.linked).toBe(true)
    expect(entry.connections.map(row => row.visibility)).toEqual(['private', 'shared'])
    expect(entry.privateConnections[0].nickname).toBe('Personal Gmail')
    expect(entry.sharedConnections[0].nickname).toBe('Marketing Gmail')
    expect(entry.sharedConnections[0].email).toBe('marketing@example.com')
    expect(entry.tools).toEqual([])
  })

  it('uses backend tool name, description, and read_only grouping', () => {
    const entry = ConnectorCatalog.parse(GMAIL_DETAIL)
    expect(entry.tools.map(tool => tool.key)).toEqual(['gmail-find-email', 'gmail-send-email'])
    expect(entry.tools[0].name).toBe('Find Email')
    expect(entry.tools[0].description).toBe('Search the mailbox.')
    expect(entry.tools[0].group).toBe('read-only')
    expect(entry.tools[1].group).toBe('write')
    expect(entry.tools[1].permissionMode).toBe('always')
    expect(entry.permissionSummary).toBe('custom')
  })

  it('parses a bare connector with no connections', () => {
    const entry = ConnectorCatalog.parse({
      slug: 'notion',
      display_name: 'Notion',
      auth_mode: 'oauth2',
      provider: 'pipedream',
      description: 'Read and write pages.',
      linked: false,
    })
    expect(entry.linked).toBe(false)
    expect(entry.connections).toEqual([])
    expect(entry.apiKeyFields).toEqual([])
    expect(entry.provider).toBe('pipedream')
  })
})

describe('listConnectors', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
    bustConnectorCatalogCache()
  })

  it('parses GET /connectors from ds-dev', async () => {
    apiFetchJson.mockResolvedValue({ connectors: [GMAIL_LIST] })
    const [entry] = await listConnectors()
    expect(entry).toBeInstanceOf(ConnectorCatalog)
    expect(entry.connections.map(row => row.scope)).toEqual(['personal', 'shared'])
  })

  it('parses a Zapier catalog row and completes a Connect UI id', async () => {
    apiFetchJson.mockResolvedValueOnce({
      connectors: [{
        slug: 'slackcliapi',
        display_name: 'Slack',
        auth_mode: 'oauth2',
        provider: 'zapier',
        description: 'Slack via Zapier.',
        logo_url: 'https://cdn.zapier.com/slack.png',
        catalog_metadata: { id: 'SlackCLIAPI', title: 'Slack' },
        linked: false,
      }],
    })

    const [entry] = await listConnectors()
    expect(entry.provider).toBe('zapier')
    expect(entry.catalogMetadata.id).toBe('SlackCLIAPI')

    bustConnectorCatalogCache()
    apiFetchJson.mockResolvedValueOnce({
      slug: 'slackcliapi',
      display_name: 'Slack',
      auth_mode: 'oauth2',
      provider: 'zapier',
      description: 'Slack via Zapier.',
      linked: true,
      connections: [{
        id: '2b0b8f8e-0000-4000-8000-000000000077',
        nickname: 'Slack',
        scope: 'personal',
        connector_slug: 'slackcliapi',
        connected: true,
        created_at: '2026-06-18T00:00:00Z',
        updated_at: '2026-06-18T00:00:00Z',
      }],
    })
    const completed = await completeZapierLink('slackcliapi', 'conn-77')
    expect(completed.linked).toBe(true)
    expect(apiFetchJson).toHaveBeenLastCalledWith(
      expect.stringContaining('/connectors/slackcliapi/complete'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ connection_id: 'conn-77' }),
      }),
    )
  })
})
