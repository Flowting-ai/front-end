import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetch, apiFetchJson } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiFetchJson: vi.fn(),
}))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetch, apiFetchJson }
})

import { getOrgSlackStatus, getSlackAppConfig, removeOrgSlackInstallation, updateSlackAppConfig, uploadSlackSkill } from './slack'

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

  it('normalizes model and skill config', async () => {
    apiFetchJson.mockResolvedValue({
      name: 'Souvenir', description: '', prompt: 'Be brief.', model_id: 'model-1',
      skills: ['pdf'], available_skills: [{ name: 'pdf', description: 'Work with PDFs.' }],
    })

    await expect(getSlackAppConfig('org-1')).resolves.toMatchObject({
      prompt: 'Be brief.', modelId: 'model-1', skills: ['pdf'],
      availableSkills: [{ name: 'pdf', description: 'Work with PDFs.' }],
    })
  })

  it('serializes model and skill updates for the backend', async () => {
    apiFetchJson.mockResolvedValue({
      name: 'Souvenir', description: '', prompt: '', model_id: null,
      skills: ['documents'], available_skills: [],
    })

    await updateSlackAppConfig('org-1', { modelId: null, skills: ['documents'] })

    expect(apiFetchJson).toHaveBeenCalledWith(expect.any(String), {
      method: 'PATCH',
      body: JSON.stringify({ model_id: null, skills: ['documents'] }),
    })
  })

  it('uploads a Markdown skill as multipart form data', async () => {
    apiFetchJson.mockResolvedValue({
      name: 'Souvenir', description: '', prompt: '', model_id: null,
      skills: ['briefing'], available_skills: [{ name: 'briefing', description: 'Write briefs.' }],
    })
    const file = new File(['# Briefing'], 'briefing.md', { type: 'text/markdown' })

    await expect(uploadSlackSkill('org-1', file)).resolves.toMatchObject({
      skills: ['briefing'],
    })
    const options = apiFetchJson.mock.calls[0]?.[1]
    expect(options).toMatchObject({ method: 'POST' })
    expect(options?.body).toBeInstanceOf(FormData)
    expect((options?.body as FormData).get('file')).toBe(file)
  })
})
