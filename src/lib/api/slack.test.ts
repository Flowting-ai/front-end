import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetch, apiFetchJson } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiFetchJson: vi.fn(),
}))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetch, apiFetchJson }
})

import { getOrgSlackStatus, linkSlackIdentity, removeOrgSlackInstallation } from './slack'

describe('removeOrgSlackInstallation', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetchJson.mockReset()
  })

  it('reads installation status for the requested organization', async () => {
    apiFetchJson.mockResolvedValue({
      workspaces: [{
        team_id: 'T1',
        team_name: 'Souvenir',
        installed_at: '2026-06-18T00:00:00Z',
      }],
    })

    await expect(getOrgSlackStatus('org-1')).resolves.toEqual({
      connected: true,
      workspaces: [{
        teamId: 'T1',
        teamName: 'Souvenir',
        installedAt: '2026-06-18T00:00:00Z',
      }],
    })
  })

  it('resolves only when the uninstall endpoint succeeds', async () => {
    apiFetch.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(removeOrgSlackInstallation('org-1')).resolves.toBeUndefined()
  })

  it('surfaces backend uninstall failures', async () => {
    apiFetch.mockResolvedValue(new Response(
      JSON.stringify({ detail: 'The Slack bot is not installed for this organization.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    ))

    await expect(removeOrgSlackInstallation('org-1')).rejects.toMatchObject({
      status: 404,
      rawMessage: 'The Slack bot is not installed for this organization.',
    })
  })
})

describe('linkSlackIdentity', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetchJson.mockReset()
  })

  it('carries the per-person authorization URL back to the caller', async () => {
    // Linking without this URL leaves the identity bound but tokenless, so
    // Souvenir can only read Slack as the bot. Dropping it is the bug.
    apiFetchJson.mockResolvedValue({
      ok: true,
      team_id: 'T1',
      authorization_url: 'https://slack.com/oauth/v2/authorize?user_scope=search%3Aread',
    })

    await expect(linkSlackIdentity('signed-state')).resolves.toEqual({
      teamId: 'T1',
      authorizationUrl: 'https://slack.com/oauth/v2/authorize?user_scope=search%3Aread',
    })
  })
})
