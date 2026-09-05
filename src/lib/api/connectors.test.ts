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
  connectorsListUrl,
  listConnectors,
  listLinkedConnectors,
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
      owner_id: 'auth0|me',
      owned: true,
      permissions: [{ key: 'gmail-send-email', permission: 'allowed' }],
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    },
    {
      // Someone else's account, shared with this workspace: usable, not editable.
      id: '2b0b8f8e-0000-4000-8000-000000000001',
      nickname: 'Marketing Gmail',
      scope: 'shared',
      connector_slug: 'gmail',
      account_identifier: 'marketing@example.com',
      connected: true,
      status: 'active',
      version: 1,
      owner_id: 'auth0|editor',
      owned: false,
      permissions: [],
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    },
  ],
}

const GMAIL_DETAIL = {
  ...GMAIL_LIST,
  tools: [
    { key: 'gmail-find-email', name: 'Find Email', description: 'Search the mailbox.', read_only: true },
    { key: 'gmail-send-email', name: 'Send Email', description: 'Send a message.', read_only: false },
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
  })

  it('reads each account\'s own permissions, so two accounts differ', () => {
    const entry = ConnectorCatalog.parse(GMAIL_DETAIL)
    const [mine, theirs] = entry.connections

    // The catalog says what the tools are; the account says what it decided.
    expect(mine.toolsFrom(entry.tools).map(t => t.permission)).toEqual(['ask', 'allowed'])
    expect(mine.permissionFor('gmail-send-email')).toBe('allowed')
    expect(mine.permissionSummary(entry.tools)).toBe('custom')

    // A tool with no stored row is Ask, never inherited from another account.
    expect(theirs.permissionFor('gmail-send-email')).toBe('ask')
    expect(theirs.permissionSummary(entry.tools)).toBe('ask')
  })

  it('only the owner can manage an account', () => {
    const [mine, theirs] = ConnectorCatalog.parse(GMAIL_LIST).connections
    expect(mine.canManage).toBe(true)
    expect(mine.ownerId).toBe('auth0|me')
    // Shared with you: still usable, still not yours to change.
    expect(theirs.canManage).toBe(false)
    expect(theirs.isShared).toBe(true)
    expect(theirs.ownerId).toBe('auth0|editor')
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

  it('builds list query params', () => {
    expect(connectorsListUrl()).toMatch(/\/connectors$/)
    expect(connectorsListUrl({ q: 'hubspot', cursor: 'gmail', limit: 10, linked: false }))
      .toContain('q=hubspot')
    expect(connectorsListUrl({ linked: true })).toContain('linked=true')
  })

  it('parses a page from GET /connectors', async () => {
    apiFetchJson.mockResolvedValue({
      connectors: [GMAIL_LIST],
      next_cursor: 'gmail',
      has_more: true,
    })
    const page = await listConnectors({ linked: true })
    expect(page.connectors[0]).toBeInstanceOf(ConnectorCatalog)
    expect(page.connectors[0].connections.map(row => row.scope)).toEqual(['personal', 'shared'])
    expect(page.nextCursor).toBe('gmail')
    expect(page.hasMore).toBe(true)
    expect(apiFetchJson).toHaveBeenCalledWith(expect.stringContaining('linked=true'))
  })

  it('drains linked pages', async () => {
    apiFetchJson
      .mockResolvedValueOnce({
        connectors: [GMAIL_LIST],
        next_cursor: 'gmail',
        has_more: true,
      })
      .mockResolvedValueOnce({
        connectors: [{
          slug: 'notion',
          display_name: 'Notion',
          auth_mode: 'oauth2',
          provider: 'pipedream',
          description: 'Pages.',
          linked: true,
        }],
        next_cursor: null,
        has_more: false,
      })
    const rows = await listLinkedConnectors()
    expect(rows.map(row => row.slug)).toEqual(['gmail', 'notion'])
    expect(apiFetchJson).toHaveBeenCalledTimes(2)
  })

  it('completes a Zapier Connect UI id', async () => {
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
        owner_id: 'auth0|me',
        owned: true,
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
