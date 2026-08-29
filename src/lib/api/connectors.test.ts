import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import {
  bustConnectorCatalogCache,
  connectorToolBooleans,
  connectorToolPermission,
  listConnectors,
} from './connectors'


describe('connectorToolPermission', () => {
  it('preserves the backend boolean truth table', () => {
    expect(connectorToolPermission({ allowed: true, blocked: false })).toBe('allowed')
    expect(connectorToolPermission({ allowed: false, blocked: true })).toBe('blocked')
    expect(connectorToolPermission({ allowed: false, blocked: false })).toBe('ask')
  })

  it('keeps blocked as the winning state', () => {
    expect(connectorToolPermission({ allowed: true, blocked: true, permission: 'allowed' })).toBe('blocked')
  })

  it('uses the response projection for a legacy shape without booleans', () => {
    expect(connectorToolPermission({ permission: 'allowed' })).toBe('allowed')
  })

  it('maps editable states back to the binary API shape', () => {
    expect(connectorToolBooleans('allowed')).toEqual({ allowed: true, blocked: false })
    expect(connectorToolBooleans('ask')).toEqual({ allowed: false, blocked: false })
    expect(connectorToolBooleans('blocked')).toEqual({ allowed: false, blocked: true })
  })
})

describe('listConnectors', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
    bustConnectorCatalogCache()
  })

  // GET /connectors as services/connectors/schemas.py actually serializes it
  // for an org member holding both a personal and a shared account.
  // AccountScope is Literal["personal", "shared"] (Workspace Model v2 — Team
  // removed, connections are workspace-wide with no smaller scope).
  it('parses a member catalog carrying a shared account', async () => {
    apiFetchJson.mockResolvedValue({
      connectors: [{
        slug:               'gmail',
        display_name:       'Gmail',
        auth_mode:          'oauth2',
        description:        'Send and read mail.',
        logo_url:           'https://cdn.example.com/gmail.png',
        categories:         ['Communication'],
        catalog_metadata:   { name_slug: 'gmail' },
        tools:              [{ slug: 'GMAIL_SEND_EMAIL', allowed: true, blocked: false, permission: 'allowed' }],
        api_key_fields:     [],
        linked:             true,
        workspace_linked:   true,
        workspace_linked_by: 'auth0|editor',
        shared_account_id:  '2b0b8f8e-0000-4000-8000-000000000001',
        account_label:      'Marketing Gmail',
        account_identifier: 'marketing@example.com',
        accounts: [{
          id:                 '2b0b8f8e-0000-4000-8000-000000000001',
          organization_id:    '2b0b8f8e-0000-4000-8000-0000000000ff',
          connector_slug:     'gmail',
          account_label:      'Marketing Gmail',
          account_identifier: 'marketing@example.com',
          connected:          true,
          scope:              'shared',
          status:             'active',
          version:            1,
          linked_by_user_id:  'auth0|editor',
          created_at:         '2026-06-18T00:00:00Z',
          updated_at:         '2026-06-18T00:00:00Z',
        }],
        account_options: [
          {
            connector_slug:      'gmail',
            scope:               'personal',
            account_label:       'Personal Gmail',
            account_identifier:  null,
            provider_account_id: 'ca_personal',
            connected:           true,
            status:              'active',
            authorized_scopes:   ['https://www.googleapis.com/auth/gmail.send'],
            can_manage:          true,
          },
          {
            connector_slug:      'gmail',
            scope:               'shared',
            account_label:       'Marketing Gmail',
            account_identifier:  'marketing@example.com',
            provider_account_id: 'ca_shared',
            connected:           true,
            status:              'active',
            authorized_scopes:   ['https://www.googleapis.com/auth/gmail.modify'],
            shared_account_id:   '2b0b8f8e-0000-4000-8000-000000000001',
            linked_by_user_id:   'auth0|editor',
            can_manage:          false,
          },
        ],
      }],
    })

    const [entry] = await listConnectors()

    expect(entry.slug).toBe('gmail')
    expect(entry.tools[0].permission).toBe('allowed')
    expect(entry.account_options.map(option => option.scope)).toEqual(['personal', 'shared'])
    expect(entry.account_options[1].provider_account_id).toBe('ca_shared')
    // Absent on the personal option; the schema fills the backend's own defaults.
    expect(entry.account_options[0].shared_account_id).toBeNull()
  })

  it('parses a bare connector with no accounts of either kind', async () => {
    apiFetchJson.mockResolvedValue({
      connectors: [{
        slug:         'notion',
        display_name: 'Notion',
        auth_mode:    'oauth2',
        description:  'Read and write pages.',
        linked:       false,
      }],
    })

    const [entry] = await listConnectors()

    expect(entry.linked).toBe(false)
    expect(entry.workspace_linked).toBe(false)
    expect(entry.accounts).toEqual([])
    expect(entry.account_options).toEqual([])
    expect(entry.api_key_fields).toEqual([])
  })
})
