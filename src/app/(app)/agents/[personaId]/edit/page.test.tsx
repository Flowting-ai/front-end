// @vitest-environment jsdom
//
// Drives the real /agents/[personaId]/edit page in jsdom: ownership, in-place saves
// (live vs draft), the "Updated" / conflict notices when the record changes under
// an open editor, and leave guards. The data layer is mocked.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import { PersonaRepo } from '@/lib/api/persona-repo'
import { personaRepoSchema } from '@/lib/api/persona-schemas'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn() }))
const store = vi.hoisted(() => ({ repo: null as unknown, isLoading: false }))
const org = vi.hoisted(() => ({ role: 'admin' as 'admin' | 'member' }))
const api = vi.hoisted(() => ({
  updateVersion:         vi.fn(),
  publishPersonaVersion: vi.fn(),
  urlToImageFile:        vi.fn(),
  bustPersonasCache:     vi.fn(),
  copyPersonaRepoDeduped: vi.fn(),
  isPersonaOwnedByViewer: vi.fn(),
  personaStarter:        vi.fn(),
  enhancePrompt:         vi.fn(),
  testVersionStream:     vi.fn(),
  createPersonaRepo:     vi.fn(),
}))
const models = vi.hoisted(() => ({ fetchModelsWithCache: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.push }),
  useParams: () => ({ personaId: 'repo-1' }),
}))
vi.mock('@/hooks/use-persona-repos', () => ({
  usePersonaRepoById: () => ({ repo: store.repo, isLoading: store.isLoading, error: null }),
}))
vi.mock('@/context/org-context', () => ({ useOrg: () => ({ currentUserRole: org.role, members: [] }) }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { email: 'me@example.com' } }) }))
vi.mock('@/lib/api/teams', () => ({ resolveViewerUserId: () => 'user-1' }))
vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/ai-models', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ai-models')>()),
  fetchModelsWithCache: models.fetchModelsWithCache,
}))
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn(), trackFeature: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(() => 't'), dismiss: vi.fn() } }))

import EditAgentPage from './page'
import { toast } from 'sonner'

const MODELS: AIModel[] = [
  { id: 1, modelId: 'pro', companyName: 'Anthropic', modelName: 'Pro Model', modelType: 'paid', inputLimit: 0, outputLimit: 0 },
  { id: 2, modelId: 'fast', companyName: 'Anthropic', modelName: 'Fast Model', modelType: 'paid', inputLimit: 0, outputLimit: 0 },
]

interface VersionOver { name?: string; description?: string; prompt?: string; model_id?: string; temperature?: number; image_url?: string }

function version(over: VersionOver = {}) {
  return {
    id: 'ver-1', persona_repo_id: 'repo-1', name: 'Support Triage', handler: 'support-triage',
    prompt: 'You triage support emails.', description: 'Sorts support emails.', is_active: true,
    model_id: 'pro', image_url: 'https://cdn/a.jpg?sig=1', image_s3_key: null, temperature: 0.4,
    version_tags: [], persona_tags: ['support'], connectors: [], blocked_connectors: [], documents: [], links: [],
    source_share_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
  }
}

function repo(opts: { live?: boolean; visibility?: 'private' | 'shared'; version?: VersionOver; sourceShareId?: string | null } = {}) {
  const { live = true, visibility = 'private', version: v = {}, sourceShareId = null } = opts
  const ver = { ...version(v), source_share_id: sourceShareId }
  return new PersonaRepo(personaRepoSchema.parse({
    id: 'repo-1', name: 'Support Triage', is_active: true,
    active_version_id: 'ver-1', active_version: ver,
    published_version_id: live ? 'ver-1' : null, published_version: live ? ver : null,
    published_at: live ? '2026-01-01T00:00:00Z' : null, is_published: live, version_count: 1,
    visibility, organization_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }))
}

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView ??= () => {}
})

beforeEach(() => {
  vi.resetAllMocks()
  store.repo = repo()
  store.isLoading = false
  org.role = 'admin'
  models.fetchModelsWithCache.mockResolvedValue(MODELS)
  api.updateVersion.mockResolvedValue({ image_url: 'https://cdn/a.jpg?sig=2' })
  api.publishPersonaVersion.mockResolvedValue({})
  api.urlToImageFile.mockResolvedValue(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }))
  api.isPersonaOwnedByViewer.mockImplementation((persona: { visibility: string }, _map: unknown, _id: unknown, fallback: boolean) =>
    persona.visibility !== 'team' ? true : fallback)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() })
}
async function render() {
  await act(async () => root.render(<EditAgentPage />))
  await settle()
}
function byText(text: string, selector = 'button'): HTMLElement {
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(el => el.textContent?.trim() === text)
  if (!found) throw new Error(`No <${selector}> with text "${text}". Page: ${document.body.textContent?.slice(0, 500)}`)
  return found
}
async function click(el: HTMLElement) {
  await act(async () => { el.click() })
  await settle()
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const nameBox = () => document.getElementById('agent-editor-name') as HTMLInputElement
const saveButton = () => byText('Save changes') as HTMLButtonElement

describe('/agents/[personaId]/edit', () => {
  it('shows the saved agent, pre-filled, with Save disabled until something changes', async () => {
    await render()
    expect(document.body.textContent).toContain('Edit agent')
    expect(document.body.textContent).toContain('@support-triage')
    expect(nameBox().value).toBe('Support Triage')
    expect((document.getElementById('agent-editor-description') as HTMLTextAreaElement).value).toBe('Sorts support emails.')
    expect(document.body.textContent).toContain('Pro Model')
    expect(saveButton().disabled).toBe(true)

    await type(nameBox(), 'Support Triage 2')
    expect(saveButton().disabled).toBe(false)
  })

  it('shows a spinner while loading and "not found" when the agent does not exist', async () => {
    store.isLoading = true
    store.repo = null
    await render()
    expect(document.body.textContent).not.toContain('Agent not found')

    store.isLoading = false
    await render()
    expect(document.body.textContent).toContain('Agent not found')
  })

  it('saves a live agent in place: only what changed, no publish call', async () => {
    await render()
    await type(nameBox(), 'Renamed')
    await click(saveButton())

    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      repoId: 'repo-1', versionId: 'ver-1', name: 'Renamed',
      description: undefined, prompt: undefined, modelId: undefined, temperature: undefined, image: null,
    }))
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
    expect(api.urlToImageFile).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Agent saved')
    expect(saveButton().disabled).toBe(true)
  })

  it('publishes an agent that was only a draft when saving', async () => {
    store.repo = repo({ live: false })
    await render()
    expect(document.body.textContent).toContain('Not live yet')
    // A draft can be published without any edit.
    expect(saveButton().disabled).toBe(false)
    await click(saveButton())
    expect(api.updateVersion).toHaveBeenCalled()
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-1')
  })

  it('keeps the edits on screen when saving fails', async () => {
    api.updateVersion.mockRejectedValue(new Error('403 forbidden'))
    await render()
    await type(nameBox(), 'Renamed')
    await click(saveButton())
    expect(toast.error).toHaveBeenCalledWith('403 forbidden')
    expect(nameBox().value).toBe('Renamed')
    expect(saveButton().disabled).toBe(false)
  })

  it('blocks saving a blank name', async () => {
    await render()
    await type(nameBox(), '  ')
    expect(saveButton().disabled).toBe(true)
    expect(api.updateVersion).not.toHaveBeenCalled()
  })

  it('applies Advanced personalize edits to the draft, saved with the page', async () => {
    await render()
    await click(byText('Advanced personalize'))
    expect(document.body.textContent).toContain('Fine-tune how this agent behaves.')
    const modalTone = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button')).find(b => b.textContent === 'Warm & approachable')!
    await click(modalTone)
    await click(byText('Apply'))
    expect(api.updateVersion).not.toHaveBeenCalled()

    await click(saveButton())
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'You triage support emails.\n\nTone: Warm & approachable — Human first, solution second.',
    }))
  })

  describe('who may edit', () => {
    it('lets the owner of a private agent edit', async () => {
      await render()
      expect(nameBox()).toBeTruthy()
    })

    it('shows a read-only message with a copy action for an agent shared with the workspace', async () => {
      org.role = 'member'
      store.repo = repo({ visibility: 'shared' })
      api.copyPersonaRepoDeduped.mockResolvedValue({ id: 'copy-9' })
      await render()
      expect(document.getElementById('agent-editor-name')).toBeNull()
      expect(document.body.textContent).toContain('This agent is shared with your workspace')

      await click(byText('Make my own copy'))
      expect(api.copyPersonaRepoDeduped).toHaveBeenCalledWith('repo-1', 'ver-1')
      expect(nav.push).toHaveBeenCalledWith('/agents/copy-9/edit')
    })

    it('lets a workspace admin edit a shared agent', async () => {
      org.role = 'admin'
      store.repo = repo({ visibility: 'shared' })
      await render()
      expect(nameBox()).toBeTruthy()
    })

    it('does not let anyone edit an agent received through a Super Link', async () => {
      store.repo = repo({ sourceShareId: 'share-1' })
      await render()
      expect(document.getElementById('agent-editor-name')).toBeNull()
      expect(document.body.textContent).toContain('You can’t edit this agent')
    })
  })

  describe('when the saved agent changes under an open editor', () => {
    it('quietly adopts the change and says so when the editor has no unsaved edits', async () => {
      await render()
      store.repo = repo({ version: { name: 'Changed Elsewhere' } })
      await render()
      expect(nameBox().value).toBe('Changed Elsewhere')
      expect(document.body.textContent).toContain('Updated — this agent was changed elsewhere')
    })

    it('keeps unsaved edits and offers to load the latest', async () => {
      await render()
      await type((document.getElementById('agent-editor-description') as HTMLTextAreaElement), 'My unsaved description')
      store.repo = repo({ version: { name: 'Changed Elsewhere' } })
      await render()

      expect((document.getElementById('agent-editor-description') as HTMLTextAreaElement).value).toBe('My unsaved description')
      expect(nameBox().value).toBe('Support Triage')
      expect(document.body.textContent).toContain('Your unsaved edits are still here')

      await click(byText('Load latest'))
      expect(nameBox().value).toBe('Changed Elsewhere')
      expect((document.getElementById('agent-editor-description') as HTMLTextAreaElement).value).toBe('Sorts support emails.')
    })

    it('does not treat a re-signed avatar URL as a change', async () => {
      await render()
      store.repo = repo({ version: { image_url: 'https://cdn/a.jpg?sig=999' } })
      await render()
      expect(document.body.textContent).not.toContain('Updated — this agent was changed elsewhere')
    })
  })

  describe('leaving', () => {
    it('leaves straight away when nothing changed', async () => {
      await render()
      await click(byText('Back'))
      expect(nav.push).toHaveBeenCalledWith('/agents')
    })

    it('asks first when there are unsaved edits', async () => {
      await render()
      await type(nameBox(), 'Renamed')
      await click(byText('Back'))
      expect(nav.push).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('Leave without saving?')

      await click(byText('Stay'))
      expect(nav.push).not.toHaveBeenCalled()
      await click(byText('Back'))
      await click(byText('Leave'))
      expect(nav.push).toHaveBeenCalledWith('/agents')
    })

    it('opens the existing Knowledge / Connectors / Sharing pages for this agent', async () => {
      await render()
      const open = Array.from(document.querySelectorAll<HTMLElement>('button')).filter(b => b.textContent === 'Open')
      expect(open).toHaveLength(3)
      await click(open[0])
      expect(nav.push).toHaveBeenCalledWith('/agent/configure/knowledge?repoId=repo-1&versionId=ver-1')
      await click(open[1])
      expect(nav.push).toHaveBeenCalledWith('/agent/configure/connectors?repoId=repo-1&versionId=ver-1')
      await click(open[2])
      expect(nav.push).toHaveBeenCalledWith('/agent/configure/sharing?repoId=repo-1&versionId=ver-1')
    })
  })

  it('pauses Try it while there are unsaved changes', async () => {
    await render()
    expect(document.body.textContent).not.toContain('Save your changes to try the latest version.')
    await type(nameBox(), 'Renamed')
    expect(document.body.textContent).toContain('Save your changes to try the latest version.')
  })
})
