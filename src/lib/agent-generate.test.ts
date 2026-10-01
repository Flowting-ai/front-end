import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'

const api = vi.hoisted(() => ({ enhancePrompt: vi.fn(), personaStarter: vi.fn() }))
vi.mock('@/lib/api/personas', () => api)

import { FALLBACK_TONES, toneLine } from './agent-draft'
import {
  QUESTIONS_TIMEOUT_MS,
  generateAgentDraft,
  manualAgentDraft,
  regenerateInstructions,
  requestClarifyingQuestions,
  seedFromPreset,
} from './agent-generate'

const MODELS: AIModel[] = [
  { id: 1, modelId: 'basic', companyName: 'A', modelName: 'Basic', modelType: 'free', planType: 'free', inputLimit: 0, outputLimit: 0 },
  { id: 2, modelId: 'pro', companyName: 'A', modelName: 'Pro', modelType: 'paid', tags: ['Recommended'], inputLimit: 0, outputLimit: 0 },
]

const STARTER = {
  system_instruction: 'You review contracts.',
  sounds: [{ name: 'calm', description: 'Measured and clear.' }],
  persona_tags: ['legal'],
}

beforeEach(() => {
  vi.resetAllMocks()
  api.personaStarter.mockResolvedValue(STARTER)
})
afterEach(() => vi.useRealTimers())

describe('requestClarifyingQuestions', () => {
  it('returns the usable questions, capped', async () => {
    const opts = [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }]
    api.enhancePrompt.mockResolvedValue({
      enhanced_prompt: 'x',
      questions: [1, 2, 3, 4].map(n => ({ question: `Q${n}?`, multi_select: false, options: opts })),
    })
    const questions = await requestClarifyingQuestions('Review contracts')
    expect(questions.map(q => q.question)).toEqual(['Q1?', 'Q2?', 'Q3?'])
    expect(api.enhancePrompt).toHaveBeenCalledWith('Review contracts', [])
  })

  it('resolves to no questions when the request fails', async () => {
    api.enhancePrompt.mockRejectedValue(new Error('500'))
    expect(await requestClarifyingQuestions('x')).toEqual([])
  })

  it('stops waiting after the timeout', async () => {
    vi.useFakeTimers()
    api.enhancePrompt.mockReturnValue(new Promise(() => {}))
    const pending = requestClarifyingQuestions('x')
    await vi.advanceTimersByTimeAsync(QUESTIONS_TIMEOUT_MS)
    expect(await pending).toEqual([])
  })
})

describe('generateAgentDraft', () => {
  it('fills every field from the purpose and the generator', async () => {
    const { draft, tones } = await generateAgentDraft({
      purpose: 'Reviews contracts and flags risks',
      answers: [{ question: 'Where?', answer: 'Slack' }],
      models: MODELS,
    })

    expect(draft).toMatchObject({
      name: 'Contract Reviewer',
      description: 'Reviews contracts and flags risks',
      instructions: 'You review contracts.',
      modelId: 'pro',
      temperature: 0.3,
      tags: ['legal'],
    })
    expect(draft.avatarUrl).toMatch(/^\/persona-avatars\//)
    expect(tones).toEqual(STARTER.sounds)
    expect(api.personaStarter).toHaveBeenCalledWith({
      name: 'Contract Reviewer',
      description: 'Reviews contracts and flags risks\n\nClarifications:\n- Where? → Slack',
    })
  })

  it('falls back to the built-in tones when the generator returns none', async () => {
    api.personaStarter.mockResolvedValue({ ...STARTER, sounds: [] })
    const { tones } = await generateAgentDraft({ purpose: 'Reviews contracts', answers: [], models: MODELS })
    expect(tones).toBe(FALLBACK_TONES)
  })

  it('uses a template seed: its name and instructions, with its tone applied', async () => {
    const { draft, tones } = await generateAgentDraft({
      purpose: 'Handles customer inquiries',
      answers: [],
      models: MODELS,
      seed: { name: 'Support Agent', systemInstruction: 'You are support.', toneIndex: 1 },
    })
    expect(draft.name).toBe('Support Agent')
    expect(draft.instructions).toBe(`You are support.\n\n${toneLine(FALLBACK_TONES[1])}`)
    expect(tones).toContain(FALLBACK_TONES[1])
    expect(api.personaStarter).toHaveBeenCalledWith(expect.objectContaining({ name: 'Support Agent' }))
  })

  it('leaves the model empty when no model may be used by agents', async () => {
    const { draft } = await generateAgentDraft({ purpose: 'Reviews contracts', answers: [], models: [MODELS[0]] })
    expect(draft.modelId).toBeNull()
  })

  it('propagates a generator failure so the page can offer retry / manual', async () => {
    api.personaStarter.mockRejectedValue(new Error('503'))
    await expect(generateAgentDraft({ purpose: 'x', answers: [], models: MODELS })).rejects.toThrow('503')
  })
})

describe('regenerateInstructions', () => {
  it('asks the generator again for the current name and purpose', async () => {
    const out = await regenerateInstructions({ name: 'My Name', purpose: 'Reviews contracts', answers: [] })
    expect(api.personaStarter).toHaveBeenCalledWith({ name: 'My Name', description: 'Reviews contracts' })
    expect(out).toEqual({ instructions: 'You review contracts.', tones: STARTER.sounds, tags: ['legal'] })
  })
})

describe('seedFromPreset', () => {
  it('maps the template tone id to the matching built-in tone', () => {
    const base = { name: 'Legal Advisor', systemInstruction: 'You advise.' }
    expect(seedFromPreset({ ...base, tone: 'direct' }).toneIndex).toBe(0)
    expect(seedFromPreset({ ...base, tone: 'warm' }).toneIndex).toBe(1)
    expect(seedFromPreset({ ...base, tone: 'precise' }).toneIndex).toBe(2)
    expect(seedFromPreset({ ...base, tone: 'evidence' }).toneIndex).toBe(3)
    expect(FALLBACK_TONES).toHaveLength(4)
  })

  it('leaves the tone unset for an unknown id', () => {
    expect(seedFromPreset({ name: 'x', systemInstruction: 'y', tone: 'sarcastic' }).toneIndex).toBeNull()
  })
})

describe('manualAgentDraft', () => {
  it('is the same pre-filled draft with empty instructions and no network call', () => {
    const { draft, tones } = manualAgentDraft('Reviews contracts and flags risks', MODELS)
    expect(draft).toMatchObject({ name: 'Contract Reviewer', instructions: '', modelId: 'pro', tags: [] })
    expect(tones).toBe(FALLBACK_TONES)
    expect(api.personaStarter).not.toHaveBeenCalled()
  })
})
