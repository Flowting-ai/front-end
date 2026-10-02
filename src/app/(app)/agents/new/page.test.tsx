// @vitest-environment jsdom
//
// Drives the real /agents/new page in jsdom with the network mocked: purpose →
// clarifying questions → generation → editor → Finish. Guards the state machine
// (stale runs, retry / manual fallback, cancel, double-submit) that the pure unit
// tests can't see.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }))
const api = vi.hoisted(() => ({
  fetchPersonas:         vi.fn(),
  enhancePrompt:         vi.fn(),
  personaStarter:        vi.fn(),
  createPersonaRepo:     vi.fn(),
  publishPersonaVersion: vi.fn(),
  updateVersion:         vi.fn(),
  urlToImageFile:        vi.fn(),
  bustPersonasCache:     vi.fn(),
  testVersionStream:     vi.fn(),
}))
const models = vi.hoisted(() => ({ fetchModelsWithCache: vi.fn() }))
const track = vi.hoisted(() => ({ trackBrowserEvent: vi.fn(), trackFeature: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.push }),
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/ai-models', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ai-models')>()),
  fetchModelsWithCache: models.fetchModelsWithCache,
}))
vi.mock('@/lib/analytics/events', () => track)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import NewAgentPage from './page'
import { toast } from 'sonner'

const MODELS: AIModel[] = [
  { id: 1, modelId: 'pro', companyName: 'Anthropic', modelName: 'Pro Model', modelType: 'paid', tags: ['Recommended'], inputLimit: 0, outputLimit: 0 },
]
const STARTER = {
  system_instruction: 'You review contracts.',
  sounds: [{ name: 'calm', description: 'Measured and clear.' }],
  persona_tags: ['legal'],
}
const QUESTIONS = {
  enhanced_prompt: 'x',
  questions: [
    { question: 'Which region?', multi_select: false, options: [{ label: 'EU', description: 'eu' }, { label: 'US', description: 'us' }] },
  ],
}

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  // Not implemented by jsdom; the design-system components feature-detect poorly.
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
  nav.params = new URLSearchParams()
  models.fetchModelsWithCache.mockResolvedValue(MODELS)
  api.fetchPersonas.mockResolvedValue([])
  api.enhancePrompt.mockResolvedValue({ enhanced_prompt: '', questions: [] })
  api.personaStarter.mockResolvedValue(STARTER)
  api.urlToImageFile.mockResolvedValue(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }))
  api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: { id: 'ver-1', image_url: null } })
  api.updateVersion.mockResolvedValue({ image_url: null })
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

async function mount() {
  await act(async () => root.render(<NewAgentPage />))
  await settle()
}

function byText(text: string, selector = 'button'): HTMLElement {
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(el => el.textContent?.trim() === text)
  if (!found) throw new Error(`No <${selector}> with text "${text}". Page: ${document.body.textContent?.slice(0, 400)}`)
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

const purposeBox = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Agent purpose"]')!

async function toEditor(purpose = 'Reviews contracts and flags risks') {
  await mount()
  await type(purposeBox(), purpose)
  await click(byText('Continue'))
}

describe('/agents/new', () => {
  it('starts on the purpose screen with Continue disabled until there is a purpose', async () => {
    await mount()
    expect(document.body.textContent).toContain('What should this agent do?')
    expect((byText('Continue') as HTMLButtonElement).disabled).toBe(true)
    await type(purposeBox(), 'Reviews contracts')
    expect((byText('Continue') as HTMLButtonElement).disabled).toBe(false)
  })

  it('fills the purpose from a starter chip', async () => {
    await mount()
    await click(byText('Drafts weekly reports'))
    expect(purposeBox().value).toBe('Drafts weekly reports')
  })

  it('goes straight to a pre-filled editor when nothing needs clarifying', async () => {
    await toEditor()
    expect(api.enhancePrompt).toHaveBeenCalledWith('Reviews contracts and flags risks', [])
    expect(api.personaStarter).toHaveBeenCalledWith({ name: 'Contract Reviewer', description: 'Reviews contracts and flags risks' })

    expect(document.body.textContent).toContain('New agent — review & edit')
    expect((document.getElementById('agent-editor-name') as HTMLInputElement).value).toBe('Contract Reviewer')
    expect((document.getElementById('agent-editor-description') as HTMLTextAreaElement).value).toBe('Reviews contracts and flags risks')
    expect(document.body.textContent).toContain('Pro Model')
    // Nothing is saved until Finish.
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  it('shows clarifying questions, defaults the first answer, and folds the answers into generation', async () => {
    api.enhancePrompt.mockResolvedValue(QUESTIONS)
    await toEditor()
    expect(document.body.textContent).toContain('Which region?')
    expect(api.personaStarter).not.toHaveBeenCalled()

    await click(document.querySelector<HTMLElement>('button[aria-label="Send"]')!)
    expect(api.personaStarter).toHaveBeenCalledWith({
      name: 'Contract Reviewer',
      description: 'Reviews contracts and flags risks\n\nClarifications:\n- Which region? → EU',
    })
    expect(document.body.textContent).toContain('New agent — review & edit')
  })

  it('skips the questions and still generates', async () => {
    api.enhancePrompt.mockResolvedValue(QUESTIONS)
    await toEditor()
    await click(byText('Skip'))
    expect(api.personaStarter).toHaveBeenCalledWith({ name: 'Contract Reviewer', description: 'Reviews contracts and flags risks' })
    expect(document.body.textContent).toContain('New agent — review & edit')
  })

  it('offers retry and manual fill when generation fails, keeping the purpose', async () => {
    api.personaStarter.mockRejectedValueOnce(new Error('503'))
    await toEditor()
    expect(document.body.textContent).toContain('We couldn’t set up your agent')

    await click(byText('Try again'))
    expect(api.personaStarter).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('New agent — review & edit')
  })

  it('fills in manually with empty instructions after a failure', async () => {
    api.personaStarter.mockRejectedValue(new Error('503'))
    await toEditor()
    await click(byText('Fill in manually'))
    expect(document.body.textContent).toContain('New agent — review & edit')
    expect(document.body.textContent).toContain('Add instructions')
    expect((document.getElementById('agent-editor-name') as HTMLInputElement).value).toBe('Contract Reviewer')
  })

  it('returns to the purpose screen from a failure with the purpose intact', async () => {
    api.personaStarter.mockRejectedValue(new Error('503'))
    await toEditor()
    await click(byText('Edit purpose'))
    expect(purposeBox().value).toBe('Reviews contracts and flags risks')
  })

  it('creates and publishes the agent on Finish, then opens its details', async () => {
    await toEditor()
    await click(byText('Finish Agent Creation'))

    expect(api.createPersonaRepo).toHaveBeenCalledTimes(1)
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Contract Reviewer',
      modelId: 'pro',
      prompt: 'You review contracts.',
      description: 'Reviews contracts and flags risks',
      temperature: 0.3,
    }))
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-1')
    expect(track.trackBrowserEvent).toHaveBeenCalledWith('agent_created', { from_template: false, template_slug: undefined })
    expect(nav.push).toHaveBeenCalledWith('/agents?agent=repo-1')
  })

  it('creates the agent once even if Finish is clicked repeatedly', async () => {
    let release!: () => void
    api.createPersonaRepo.mockReturnValue(new Promise(resolve => { release = () => resolve({ id: 'repo-1', active_version: { id: 'ver-1', image_url: null } }) }))
    await toEditor()
    const finish = byText('Finish Agent Creation')
    await click(finish)
    await click(finish)
    await click(finish)
    expect(api.createPersonaRepo).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
    await settle()
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it('re-enables Finish and reports the error when creation fails', async () => {
    api.createPersonaRepo.mockRejectedValue(new Error('boom'))
    await toEditor()
    await click(byText('Finish Agent Creation'))
    expect(toast.error).toHaveBeenCalledWith('boom')
    expect(nav.push).not.toHaveBeenCalled()
    expect((byText('Finish Agent Creation') as HTMLButtonElement).disabled).toBe(false)
  })

  it('sends the user to the editor when the agent was created but could not be published', async () => {
    api.publishPersonaVersion.mockRejectedValue(new Error('nope'))
    await toEditor()
    await click(byText('Finish Agent Creation'))
    expect(nav.push).toHaveBeenCalledWith('/agents/repo-1/edit')
    expect(toast.warning).toHaveBeenCalled()
  })

  it('blocks Finish with a message when a required field is missing', async () => {
    await toEditor()
    await type(document.getElementById('agent-editor-name') as HTMLInputElement, '   ')
    await click(byText('Finish Agent Creation'))
    expect(toast.error).toHaveBeenCalledWith('Give the agent a name.')
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  it('cancels without confirmation when nothing was changed, and without saving', async () => {
    await toEditor()
    await click(byText('Cancel'))
    expect(nav.push).toHaveBeenCalledWith('/agents')
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
    expect(track.trackBrowserEvent).toHaveBeenCalledWith('agent_wizard_abandoned', { last_step: 'editor' })
  })

  it('asks before discarding edits on Cancel', async () => {
    await toEditor()
    await type(document.getElementById('agent-editor-name') as HTMLInputElement, 'Renamed')
    await click(byText('Cancel'))
    expect(nav.push).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Discard this agent?')

    await click(byText('Keep editing'))
    expect(document.body.textContent).not.toContain('Discard this agent?')
    await click(byText('Cancel'))
    await click(byText('Discard'))
    expect(nav.push).toHaveBeenCalledWith('/agents')
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  it('uses a template as is: no questions, its name and instructions', async () => {
    nav.params = new URLSearchParams('template=Legal')
    await mount()
    expect(purposeBox().value).toContain('Reviews contracts')
    await click(byText('Continue'))
    expect(api.enhancePrompt).not.toHaveBeenCalled()
    expect((document.getElementById('agent-editor-name') as HTMLInputElement).value).toBe('Legal Advisor')
    await click(byText('Finish Agent Creation'))
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Legal Advisor',
      prompt: expect.stringContaining('Tone: Precise & professional'),
    }))
    expect(track.trackBrowserEvent).toHaveBeenCalledWith('agent_created', { from_template: true, template_slug: 'Legal' })
  })

  it('starts from a purpose handed over in the URL', async () => {
    nav.params = new URLSearchParams({ purpose: 'Triages support emails' })
    await mount()
    expect(purposeBox().value).toBe('Triages support emails')
  })

  it('ignores an unknown template slug', async () => {
    nav.params = new URLSearchParams('template=Nope')
    await mount()
    expect(purposeBox().value).toBe('')
  })

  it('keeps the questions optional: a failing questions request still generates', async () => {
    api.enhancePrompt.mockRejectedValue(new Error('500'))
    await toEditor()
    expect(document.body.textContent).toContain('New agent — review & edit')
  })
})
