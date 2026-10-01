// @vitest-environment jsdom
//
// The right-sidebar details: quick edits that save as you leave a field, the
// read-only view for agents the viewer doesn't own, and staying in step with the
// record when it changes elsewhere. The data layer is mocked.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import { PersonaRepo } from '@/lib/api/persona-repo'
import { personaRepoSchema } from '@/lib/api/persona-schemas'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn() }))
const store = vi.hoisted(() => ({ repo: null as unknown, isLoading: false }))
const api = vi.hoisted(() => ({
  updateVersion:         vi.fn(),
  publishPersonaVersion: vi.fn(),
  urlToImageFile:        vi.fn(),
  bustPersonasCache:     vi.fn(),
  createPersonaRepo:     vi.fn(),
}))
const models = vi.hoisted(() => ({ fetchModelsWithCache: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push, replace: nav.push }) }))
vi.mock('@/hooks/use-persona-repos', () => ({
  usePersonaRepoById: () => ({ repo: store.repo, isLoading: store.isLoading, error: null }),
}))
vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/ai-models', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ai-models')>()),
  fetchModelsWithCache: models.fetchModelsWithCache,
}))
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn(), trackFeature: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { AgentDetailsSidebar } from './AgentDetailsSidebar'
import { toast } from 'sonner'

const MODELS: AIModel[] = [
  { id: 1, modelId: 'pro', companyName: 'Anthropic', modelName: 'Pro Model', modelType: 'paid', inputLimit: 0, outputLimit: 0 },
  { id: 2, modelId: 'fast', companyName: 'Anthropic', modelName: 'Fast Model', modelType: 'paid', inputLimit: 0, outputLimit: 0 },
]

function repo(over: { name?: string; description?: string; model_id?: string } = {}) {
  const version = {
    id: 'ver-1', persona_repo_id: 'repo-1', name: 'Support Triage', handler: 'support-triage',
    prompt: 'You triage support emails.', description: 'Sorts support emails.', is_active: true,
    model_id: 'pro', image_url: 'https://cdn/a.jpg?sig=1', image_s3_key: null, temperature: 0.4,
    version_tags: [], persona_tags: [], connectors: [], blocked_connectors: [], documents: [], links: [],
    source_share_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
  }
  return new PersonaRepo(personaRepoSchema.parse({
    id: 'repo-1', name: version.name, is_active: true,
    active_version_id: 'ver-1', active_version: version, published_version_id: 'ver-1', published_version: version,
    published_at: '2026-01-01T00:00:00Z', is_published: true, version_count: 1,
    visibility: 'private', organization_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }))
}

let container: HTMLDivElement
let root: Root
const onClose = vi.fn()

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
  models.fetchModelsWithCache.mockResolvedValue(MODELS)
  api.updateVersion.mockResolvedValue({ image_url: 'https://cdn/a.jpg?sig=2' })
  api.publishPersonaVersion.mockResolvedValue({})
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
async function render(props: Partial<React.ComponentProps<typeof AgentDetailsSidebar>> = {}) {
  await act(async () => root.render(<AgentDetailsSidebar repoId="repo-1" canEdit onClose={onClose} {...props} />))
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
/** Leaves a field the way a user does: focus out. */
async function blur(el: HTMLElement) {
  await act(async () => {
    el.focus()
    el.blur()
  })
  await settle()
}
const nameBox = () => document.getElementById('agent-details-name') as HTMLInputElement
const descriptionBox = () => document.getElementById('agent-details-description') as HTMLTextAreaElement

describe('AgentDetailsSidebar', () => {
  it('renders nothing when no agent is selected', async () => {
    await render({ repoId: null })
    expect(document.querySelector('[aria-label="Agent details"]')).toBeNull()
  })

  it('shows the agent for its owner with editable basics', async () => {
    await render()
    expect(document.querySelector('[aria-label="Agent details"]')).not.toBeNull()
    expect(nameBox().value).toBe('Support Triage')
    expect(descriptionBox().value).toBe('Sorts support emails.')
    expect(document.body.textContent).toContain('@support-triage')
    expect(document.body.textContent).toContain('Pro Model')
  })

  it('saves the name when the field is left, and only the name', async () => {
    await render()
    await type(nameBox(), 'Triage Pro')
    expect(api.updateVersion).not.toHaveBeenCalled()
    await blur(nameBox())

    expect(api.updateVersion).toHaveBeenCalledTimes(1)
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      repoId: 'repo-1', versionId: 'ver-1', name: 'Triage Pro',
      description: undefined, prompt: undefined, modelId: undefined, temperature: undefined, image: null,
    }))
    expect(api.publishPersonaVersion).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Saved')
    // A quiet save: no toast on success.
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('does not save when a field is left unchanged', async () => {
    await render()
    await blur(nameBox())
    await blur(descriptionBox())
    expect(api.updateVersion).not.toHaveBeenCalled()
  })

  it('saves the description when the field is left', async () => {
    await render()
    await type(descriptionBox(), 'Routes tickets to the right team.')
    await blur(descriptionBox())
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({ description: 'Routes tickets to the right team.' }))
  })

  it('refuses to save a blank name and says why', async () => {
    await render()
    await type(nameBox(), '   ')
    await blur(nameBox())
    expect(api.updateVersion).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Give the agent a name.')
  })

  it('reports a failed save and keeps the typed value', async () => {
    api.updateVersion.mockRejectedValue(new Error('network down'))
    await render()
    await type(nameBox(), 'Triage Pro')
    await blur(nameBox())
    expect(toast.error).toHaveBeenCalledWith('network down')
    expect(nameBox().value).toBe('Triage Pro')
  })

  it('saves a model change straight away', async () => {
    await render()
    await click(byText('Pro Model'))
    const fast = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] [role="button"]')).find(el => el.textContent?.includes('Fast Model'))!
    await click(fast)
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'fast', name: 'Support Triage' }))
  })

  it('persists Advanced personalize edits directly', async () => {
    await render()
    await click(byText('Advanced personalize'))
    const warm = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button')).find(b => b.textContent === 'Direct & confident')!
    await click(warm)
    await click(byText('Save'))
    expect(api.updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'You triage support emails.\n\nTone: Direct & confident — Gets to the point. No filler.',
    }))
    // The modal closes after a successful save.
    expect(document.querySelector('[aria-label="Advanced personalize"]')).toBeNull()
  })

  it('keeps Advanced personalize open when the save fails', async () => {
    api.updateVersion.mockRejectedValue(new Error('nope'))
    await render()
    await click(byText('Advanced personalize'))
    const direct = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button')).find(b => b.textContent === 'Direct & confident')!
    await click(direct)
    await click(byText('Save'))
    expect(document.querySelector('[aria-label="Advanced personalize"]')).not.toBeNull()
  })

  it('opens the full editor page', async () => {
    await render()
    await click(byText('Edit page'))
    expect(nav.push).toHaveBeenCalledWith('/agents/repo-1/edit')
  })

  it('closes from the close button and from Escape, but not from Escape inside a field', async () => {
    await render()
    await click(document.querySelector<HTMLElement>('[aria-label="Close details"]')!)
    expect(onClose).toHaveBeenCalledTimes(1)

    await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(onClose).toHaveBeenCalledTimes(2)

    await act(async () => { nameBox().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  describe('read-only', () => {
    it('shows the details without any editable field for an agent the viewer does not own', async () => {
      await render({ canEdit: false })
      expect(document.getElementById('agent-details-name')).toBeNull()
      expect(document.body.textContent).toContain('Support Triage')
      expect(document.body.textContent).toContain('Pro Model')
      expect(document.body.textContent).toContain('Sorts support emails.')
      expect(document.body.textContent).toContain('Only the owner can edit this agent.')
      expect(document.body.textContent).not.toContain('Advanced personalize')
    })
  })

  describe('states', () => {
    it('shows a spinner while loading', async () => {
      store.isLoading = true
      store.repo = null
      await render()
      expect(document.querySelector('[role="status"]')).not.toBeNull()
    })

    it('says so when the agent cannot be found', async () => {
      store.repo = null
      await render()
      expect(document.body.textContent).toContain('couldn’t be found')
    })
  })

  describe('staying in step with the editor page', () => {
    it('adopts a change made elsewhere and says so', async () => {
      await render()
      store.repo = repo({ name: 'Renamed In Editor' })
      await render()
      expect(nameBox().value).toBe('Renamed In Editor')
      expect(document.body.textContent).toContain('Updated — this agent was changed elsewhere')
    })

    it('keeps what is being typed and offers the latest instead of overwriting it', async () => {
      await render()
      await type(descriptionBox(), 'Typing right now')
      store.repo = repo({ name: 'Renamed In Editor' })
      await render()
      expect(descriptionBox().value).toBe('Typing right now')
      expect(document.body.textContent).toContain('Your unsaved edits are still here')
    })
  })
})
