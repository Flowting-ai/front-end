import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDraft } from './agent-draft'

const api = vi.hoisted(() => ({
  bustPersonasCache:    vi.fn(),
  createPersonaRepo:    vi.fn(),
  publishPersonaVersion: vi.fn(),
  updateVersion:        vi.fn(),
  urlToImageFile:       vi.fn(),
}))
const track = vi.hoisted(() => ({ trackBrowserEvent: vi.fn() }))
const repoApi = vi.hoisted(() => ({ fetchPersonaRepo: vi.fn() }))

vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/analytics/events', () => track)
vi.mock('@/lib/api/persona-repo', () => repoApi)

import { AgentSaveError, avatarToFile, createAgent, dataUrlToFile, saveAgentChanges } from './agent-save'

const DRAFT: AgentDraft = {
  name: '  Support Triage ',
  description: ' Sorts support emails. ',
  instructions: 'You triage support emails.',
  modelId: 'claude',
  temperature: 0.3,
  avatarUrl: '/persona-avatars/a.jpg',
  tags: ['support'],
}

const PNG_FILE = new File([new Uint8Array([1, 2, 3])], 'avatar.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vi.resetAllMocks()
  api.urlToImageFile.mockResolvedValue(PNG_FILE)
  api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: { id: 'ver-1', image_url: 'https://cdn/a.jpg' } })
  api.updateVersion.mockResolvedValue({ image_url: 'https://cdn/b.jpg' })
  api.publishPersonaVersion.mockResolvedValue({})
})

describe('dataUrlToFile', () => {
  it('decodes a base64 data URL', () => {
    const file = dataUrlToFile('data:image/png;base64,AQID', 'avatar')
    expect(file?.type).toBe('image/png')
    expect(file?.name).toBe('avatar.png')
    expect(file?.size).toBe(3)
  })

  it('returns null for malformed input', () => {
    expect(dataUrlToFile('not-a-data-url', 'avatar')).toBeNull()
    expect(dataUrlToFile('data:image/png;base64', 'avatar')).toBeNull()
    expect(dataUrlToFile('data:image/png;base64,***', 'avatar')).toBeNull()
  })
})

describe('avatarToFile', () => {
  it('is null without an avatar', async () => {
    expect(await avatarToFile(null)).toBeNull()
    expect(api.urlToImageFile).not.toHaveBeenCalled()
  })

  it('fetches paths and URLs, decodes data URLs locally', async () => {
    expect(await avatarToFile('/persona-avatars/a.jpg')).toBe(PNG_FILE)
    expect(api.urlToImageFile).toHaveBeenCalledWith('/persona-avatars/a.jpg')
    await avatarToFile('data:image/png;base64,AQID')
    expect(api.urlToImageFile).toHaveBeenCalledTimes(1)
  })
})

describe('createAgent', () => {
  it('creates with its tags and publishes, trimmed', async () => {
    const result = await createAgent(DRAFT, { templateSlug: 'Support' })

    expect(api.createPersonaRepo).toHaveBeenCalledWith({
      name: 'Support Triage',
      modelId: 'claude',
      prompt: 'You triage support emails.',
      description: 'Sorts support emails.',
      temperature: 0.3,
      tags: ['support'],
      image: PNG_FILE,
    })
    expect(api.updateVersion).not.toHaveBeenCalled()
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-1')
    expect(track.trackBrowserEvent).toHaveBeenCalledWith('agent_created', { from_template: true, template_slug: 'Support' })
    expect(api.bustPersonasCache).toHaveBeenCalled()
    expect(result).toEqual({ repoId: 'repo-1', versionId: 'ver-1', published: true, imageUrl: 'https://cdn/a.jpg' })
  })

  it('creates without tags when there are none', async () => {
    const result = await createAgent({ ...DRAFT, tags: [] })
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }))
    expect(result.imageUrl).toBe('https://cdn/a.jpg')
    expect(track.trackBrowserEvent).toHaveBeenCalledWith('agent_created', { from_template: false, template_slug: undefined })
  })

  it('rejects an incomplete draft before touching the network', async () => {
    await expect(createAgent({ ...DRAFT, modelId: null })).rejects.toMatchObject({ reason: 'invalid' })
    await expect(createAgent({ ...DRAFT, name: '  ' })).rejects.toBeInstanceOf(AgentSaveError)
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  it('refuses to create an agent whose avatar cannot be read', async () => {
    api.urlToImageFile.mockResolvedValue(null)
    await expect(createAgent(DRAFT)).rejects.toMatchObject({ reason: 'avatar' })
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  it('creates without an avatar when none was chosen', async () => {
    await createAgent({ ...DRAFT, avatarUrl: null })
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({ image: null }))
  })

  it('wraps a backend failure', async () => {
    api.createPersonaRepo.mockRejectedValue(new Error('boom'))
    await expect(createAgent(DRAFT)).rejects.toMatchObject({ reason: 'create', message: 'boom' })
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
    expect(track.trackBrowserEvent).not.toHaveBeenCalled()
  })

  it('reports an unpublished agent instead of throwing when publish fails', async () => {
    api.publishPersonaVersion.mockRejectedValue(new Error('nope'))
    const result = await createAgent(DRAFT)
    expect(result).toMatchObject({ repoId: 'repo-1', published: false })
    expect(api.bustPersonasCache).toHaveBeenCalled()
  })

  // The backend can answer the create before the new version is pinned as active.
  it('reads the agent back when the create response carries no version, then publishes', async () => {
    api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: null, active_version_id: null })
    repoApi.fetchPersonaRepo.mockResolvedValue({ workingVersionId: 'ver-7', liveVersionId: null, currentVersion: { imageUrl: 'https://cdn/z.jpg' } })
    const result = await createAgent(DRAFT)
    expect(repoApi.fetchPersonaRepo).toHaveBeenCalledWith('repo-1')
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-7')
    expect(result).toEqual({ repoId: 'repo-1', versionId: 'ver-7', published: true, imageUrl: 'https://cdn/z.jpg' })
  })

  it('uses the active version id when the response has the id but not the summary', async () => {
    api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: null, active_version_id: 'ver-3' })
    const result = await createAgent(DRAFT)
    expect(repoApi.fetchPersonaRepo).not.toHaveBeenCalled()
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-3')
    expect(result.versionId).toBe('ver-3')
  })

  it('tells the user the agent exists when no version can be found even after reading it back', async () => {
    api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: null, active_version_id: null })
    repoApi.fetchPersonaRepo.mockResolvedValue({ workingVersionId: null, liveVersionId: null, currentVersion: null })
    await expect(createAgent(DRAFT)).rejects.toMatchObject({ reason: 'create', message: expect.stringContaining('was created') })
    expect(api.bustPersonasCache).toHaveBeenCalled()
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
  })

  it('does the same when reading the agent back fails', async () => {
    api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: null, active_version_id: null })
    repoApi.fetchPersonaRepo.mockRejectedValue(new Error('500'))
    await expect(createAgent(DRAFT)).rejects.toMatchObject({ reason: 'create' })
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
  })
})

describe('saveAgentChanges', () => {
  const BASELINE: AgentDraft = { ...DRAFT, name: 'Support Triage', description: 'Sorts support emails.', avatarUrl: 'https://cdn/a.jpg' }
  const input = (over: Partial<AgentDraft>, isLive = true) => ({
    repoId: 'repo-1', versionId: 'ver-1', isLive, baseline: BASELINE, draft: { ...BASELINE, ...over },
  })

  it('patches only what changed and does not touch the avatar', async () => {
    await saveAgentChanges(input({ instructions: 'New instructions.', temperature: 0.8 }))
    expect(api.updateVersion).toHaveBeenCalledWith({
      repoId: 'repo-1',
      versionId: 'ver-1',
      name: 'Support Triage',
      description: undefined,
      prompt: 'New instructions.',
      modelId: undefined,
      temperature: 0.8,
      image: null,
    })
    expect(api.urlToImageFile).not.toHaveBeenCalled()
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
    expect(api.bustPersonasCache).toHaveBeenCalled()
  })

  it('uploads a changed avatar', async () => {
    const result = await saveAgentChanges(input({ avatarUrl: '/persona-avatars/b.jpg' }))
    expect(api.urlToImageFile).toHaveBeenCalledWith('/persona-avatars/b.jpg')
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({ image: PNG_FILE }))
    expect(result.imageUrl).toBe('https://cdn/b.jpg')
  })

  it('does not save at all when the new avatar cannot be read', async () => {
    api.urlToImageFile.mockResolvedValue(null)
    await expect(saveAgentChanges(input({ avatarUrl: '/persona-avatars/b.jpg' }))).rejects.toMatchObject({ reason: 'avatar' })
    expect(api.updateVersion).not.toHaveBeenCalled()
  })

  it('publishes a draft version so the edit goes live', async () => {
    const result = await saveAgentChanges(input({ name: 'Renamed' }, false))
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-1')
    expect(result.published).toBe(true)
  })

  it('keeps the saved changes and reports it when the publish step fails', async () => {
    api.publishPersonaVersion.mockRejectedValue(new Error('nope'))
    const result = await saveAgentChanges(input({ name: 'Renamed' }, false))
    expect(result.published).toBe(false)
    expect(api.bustPersonasCache).toHaveBeenCalled()
  })

  it('wraps an update failure and never publishes after it', async () => {
    api.updateVersion.mockRejectedValue(new Error('403'))
    await expect(saveAgentChanges(input({ name: 'Renamed' }, false))).rejects.toMatchObject({ reason: 'update', message: '403' })
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
  })

  it('rejects an incomplete draft', async () => {
    await expect(saveAgentChanges(input({ instructions: '   ' }))).rejects.toMatchObject({ reason: 'invalid' })
    expect(api.updateVersion).not.toHaveBeenCalled()
  })
})
