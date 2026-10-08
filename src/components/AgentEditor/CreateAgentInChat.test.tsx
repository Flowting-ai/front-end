// @vitest-environment jsdom
//
// "Create an agent that…" typed into chat: the in-chat flow end to end with the
// network mocked — questions, creation, the agent card, and every way out.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ push: vi.fn() }))
const api = vi.hoisted(() => ({
  enhancePrompt:         vi.fn(),
  personaStarter:        vi.fn(),
  createPersonaRepo:     vi.fn(),
  findAgentNameConflict: vi.fn().mockResolvedValue(null),
  publishPersonaVersion: vi.fn(),
  updateVersion:         vi.fn(),
  urlToImageFile:        vi.fn(),
  bustPersonasCache:     vi.fn(),
}))
const models = vi.hoisted(() => ({ fetchModelsWithCache: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }))
vi.mock('@/lib/api/personas', () => api)
vi.mock('@/lib/ai-models', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/ai-models')>()),
  fetchModelsWithCache: models.fetchModelsWithCache,
}))
vi.mock('@/lib/analytics/events', () => ({ trackBrowserEvent: vi.fn(), trackFeature: vi.fn() }))

import { CreateAgentInChat, toComposerAgent } from './CreateAgentInChat'

const MODELS: AIModel[] = [
  { id: 1, modelId: 'pro', companyName: 'Anthropic', modelName: 'Pro Model', modelType: 'paid', tags: ['Recommended'], inputLimit: 0, outputLimit: 0 },
]
const STARTER = { system_instruction: 'You triage support emails.', sounds: [], persona_tags: ['support'] }
const QUESTIONS = {
  enhanced_prompt: '',
  questions: [{ question: 'Which inbox?', multi_select: false, options: [{ label: 'Gmail', description: 'g' }, { label: 'Outlook', description: 'o' }] }],
}

let container: HTMLDivElement
let root: Root
const onClose = vi.fn()
const onCreated = vi.fn()
const onSendAsMessage = vi.fn()

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  vi.resetAllMocks()
  models.fetchModelsWithCache.mockResolvedValue(MODELS)
  api.enhancePrompt.mockResolvedValue({ enhanced_prompt: '', questions: [] })
  api.personaStarter.mockResolvedValue(STARTER)
  api.urlToImageFile.mockResolvedValue(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }))
  api.createPersonaRepo.mockResolvedValue({ id: 'repo-1', active_version: { id: 'ver-1', image_url: 'https://cdn/a.jpg' } })
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
  for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() })
}
async function open(props: { initialPurpose?: string; originalMessage?: string } = {}) {
  await act(async () => root.render(
    <CreateAgentInChat
      open
      initialPurpose={props.initialPurpose ?? 'Triages support emails'}
      originalMessage={props.originalMessage ?? 'Create an agent that triages support emails'}
      onClose={onClose}
      onCreated={onCreated}
      onSendAsMessage={onSendAsMessage}
    />,
  ))
  await settle()
}
function byText(text: string): HTMLElement {
  const found = Array.from(document.querySelectorAll<HTMLElement>('button')).find(el => el.textContent?.trim() === text)
  if (!found) throw new Error(`No button "${text}". Page: ${document.body.textContent?.slice(0, 400)}`)
  return found
}
async function click(el: HTMLElement) {
  await act(async () => { el.click() })
  await settle()
}

describe('CreateAgentInChat', () => {
  it('creates the agent straight away when nothing needs clarifying, then hands it to the chat and closes', async () => {
    await open()
    expect(api.enhancePrompt).toHaveBeenCalledWith('Triages support emails', [])
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({ name: 'Support Email Triage', modelId: 'pro', prompt: 'You triage support emails.' }))
    expect(api.publishPersonaVersion).toHaveBeenCalledWith('repo-1', 'ver-1')
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledWith({
      draft: expect.objectContaining({ name: 'Support Email Triage', modelId: 'pro' }),
      created: expect.objectContaining({ repoId: 'repo-1', versionId: 'ver-1', published: true }),
      message: 'Create an agent that triages support emails',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('asks the clarifying question first, then folds the answer into the agent', async () => {
    api.enhancePrompt.mockResolvedValue(QUESTIONS)
    await open()
    expect(document.body.textContent).toContain('Which inbox?')
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()

    await click(document.querySelector<HTMLElement>('button[aria-label="Send"]')!)
    expect(api.personaStarter).toHaveBeenCalledWith({
      name: 'Support Email Triage',
      description: 'Triages support emails\n\nClarifications:\n- Which inbox? → Gmail',
    })
    expect(api.createPersonaRepo).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('still hands over an agent that could not be made live, flagged as unpublished', async () => {
    api.publishPersonaVersion.mockRejectedValue(new Error('nope'))
    await open()
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ created: expect.objectContaining({ published: false }) }))
  })

  it('asks for the purpose when the message named none', async () => {
    await open({ initialPurpose: '' })
    expect(api.enhancePrompt).not.toHaveBeenCalled()
    const box = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Agent purpose"]')!
    expect((byText('Continue') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'Summarises meeting notes')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(byText('Continue'))
    expect(api.enhancePrompt).toHaveBeenCalledWith('Summarises meeting notes', [])
    expect(api.createPersonaRepo).toHaveBeenCalledWith(expect.objectContaining({ name: 'Meeting Note Summarizer' }))
  })

  it('lets the user send the message as ordinary chat instead', async () => {
    api.enhancePrompt.mockResolvedValue(QUESTIONS)
    await open({ originalMessage: 'Create an agent that triages support emails' })
    await click(byText('Not an agent? Send it as a normal message'))
    expect(onSendAsMessage).toHaveBeenCalledWith('Create an agent that triages support emails')
    expect(onClose).toHaveBeenCalled()
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
  })

  describe('when something goes wrong', () => {
    it('offers retry or manual set-up when the instructions cannot be generated, and creates nothing', async () => {
      api.personaStarter.mockRejectedValueOnce(new Error('503'))
      await open()
      expect(document.body.textContent).toContain('couldn’t set up the agent')
      expect(api.createPersonaRepo).not.toHaveBeenCalled()

      await click(byText('Try again'))
      expect(api.createPersonaRepo).toHaveBeenCalledTimes(1)
      expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('hands the purpose to the full creation page for manual set-up', async () => {
      api.personaStarter.mockRejectedValue(new Error('503'))
      await open()
      await click(byText('Set it up manually'))
      expect(nav.push).toHaveBeenCalledWith('/agents/new?purpose=Triages%20support%20emails')
      expect(onClose).toHaveBeenCalled()
    })

    it('shows the reason when the agent could not be created, and allows another try', async () => {
      api.createPersonaRepo.mockRejectedValueOnce(new Error('quota exceeded'))
      await open()
      expect(document.body.textContent).toContain('quota exceeded')
      await click(byText('Try again'))
      expect(api.createPersonaRepo).toHaveBeenCalledTimes(2)
      expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('says so when no model may run agents', async () => {
      models.fetchModelsWithCache.mockResolvedValue([{ ...MODELS[0], planType: 'free' }])
      await open()
      expect(document.body.textContent).toContain('needs a name, a model and instructions')
      expect(api.createPersonaRepo).not.toHaveBeenCalled()
    })

    it('goes straight to the agent when the questions request fails', async () => {
      api.enhancePrompt.mockRejectedValue(new Error('500'))
      await open()
      expect(api.createPersonaRepo).toHaveBeenCalledTimes(1)
    })
  })

  it('cannot be closed while the agent is being written', async () => {
    let release!: () => void
    api.personaStarter.mockReturnValue(new Promise(resolve => { release = () => resolve(STARTER) }))
    await open()
    expect(document.body.textContent).toContain('Creating your agent…')
    expect((document.querySelector('button[aria-label="Close"]') as HTMLButtonElement).disabled).toBe(true)
    expect(onCreated).not.toHaveBeenCalled()
    await act(async () => { release() })
    await settle()
    // Once the agent exists the dialog hands it over and closes itself.
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not hand over an agent after the user chose to send the message normally', async () => {
    let release!: () => void
    api.enhancePrompt.mockReturnValue(new Promise(resolve => { release = () => resolve({ enhanced_prompt: '', questions: [] }) }))
    await open()
    await click(byText('Not an agent? Send it as a normal message'))
    await act(async () => { release() })
    await settle()
    expect(onSendAsMessage).toHaveBeenCalledTimes(1)
    expect(api.createPersonaRepo).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })
})

describe('toComposerAgent', () => {
  it('builds the composer chip from the draft and the created agent', () => {
    const chip = toComposerAgent(
      { name: '  Support Triage ', description: 'd', instructions: 'i', modelId: 'pro', temperature: 0.3, avatarUrl: '/persona-avatars/a.jpg', tags: ['x'] },
      { repoId: 'r', versionId: 'v', published: true, imageUrl: null },
    )
    expect(chip).toMatchObject({ id: 'r', name: 'Support Triage', handle: '@support-triage', imageUrl: '/persona-avatars/a.jpg', activeVersionId: 'v', temperature: 0.3, tags: ['x'] })
  })
})
