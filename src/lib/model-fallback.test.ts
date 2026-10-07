import { describe, expect, it } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import { modelKey, pickFallbackModel, resolveStoredSelection } from './model-fallback'

function model(id: string, company: string, name: string, type: AIModel['modelType'] = 'paid'): AIModel {
  return { id: 0, modelId: id, companyName: company, modelName: name, modelType: type, tags: [], inputLimit: 0, outputLimit: 0 }
}

const SONNET = model('anthropic-sonnet', 'Anthropic', 'Claude Sonnet')
const OPUS   = model('anthropic-opus', 'Anthropic', 'Claude Opus')
const GPT    = model('openai-mini', 'OpenAI', 'GPT Mini')
const FREE   = model('free-flash', 'Google', 'Gemini Flash', 'free')

describe('modelKey', () => {
  it('prefers modelId and falls back to id', () => {
    expect(modelKey({ modelId: 'abc', id: 7 })).toBe('abc')
    expect(modelKey({ modelId: undefined as unknown as string, id: 7 })).toBe('7')
    expect(modelKey({ modelId: 'undefined', id: 'x' as unknown as number })).toBe('x')
  })
})

describe('pickFallbackModel', () => {
  it('never returns the failed model', () => {
    const picked = pickFallbackModel([SONNET, OPUS, GPT], 'anthropic-sonnet')
    expect(picked?.modelId).not.toBe('anthropic-sonnet')
  })

  it('prefers the same provider and the same size class as the failed model', () => {
    expect(pickFallbackModel([GPT, OPUS, SONNET, FREE], 'anthropic-opus')?.modelId).toBe('anthropic-sonnet')
    const sameClass = pickFallbackModel([GPT, model('anthropic-opus-2', 'Anthropic', 'Claude Opus 2'), SONNET, OPUS], 'anthropic-opus')
    expect(sameClass?.modelId).toBe('anthropic-opus-2')
  })

  it('uses what is known about a failed model that is gone from the list', () => {
    const picked = pickFallbackModel([GPT, OPUS, SONNET], 'retired-id', { companyName: 'OpenAI', modelType: 'paid' })
    expect(picked?.modelId).toBe('openai-mini')
  })

  it('falls back to the first usable model when nothing is known about the failed one', () => {
    expect(pickFallbackModel([GPT, OPUS], 'retired-id')?.modelId).toBe('openai-mini')
  })

  it('gives null when the failed model is the only one', () => {
    expect(pickFallbackModel([SONNET], 'anthropic-sonnet')).toBeNull()
    expect(pickFallbackModel([], 'anything')).toBeNull()
  })

  it('treats a missing failed id as "nothing excluded"', () => {
    expect(pickFallbackModel([SONNET, GPT], null)?.modelId).toBe('anthropic-sonnet')
  })
})


describe('resolveStoredSelection', () => {
  const blocked = { ...GPT, blocked: true }

  it('keeps the saved model when it is still in the catalog and usable', () => {
    expect(resolveStoredSelection([SONNET, GPT], 'openai-mini', null)).toEqual({ model: GPT, replaced: false })
  })

  it('finds it by name and company when its id has changed', () => {
    const renamed = { ...GPT, modelId: 'new-id' }
    const r = resolveStoredSelection([SONNET, renamed], 'old-id', { modelName: 'GPT Mini', companyName: 'OpenAI' })
    expect(r.model?.modelId).toBe('new-id')
    expect(r.replaced).toBe(false)
  })

  it('switches to the closest usable model when the saved one was retired from the catalog', () => {
    const r = resolveStoredSelection([GPT, OPUS, SONNET], 'retired-sonnet', { modelName: 'Claude Sonnet 3', companyName: 'Anthropic', modelType: 'paid' })
    expect(r.replaced).toBe(true)
    expect(r.model?.modelId).toBe('anthropic-sonnet')
    expect(r.previousName).toBe('Claude Sonnet 3')
  })

  it('switches away from a blocked model, to a usable one of the same provider when there is one', () => {
    const r = resolveStoredSelection([blocked, model('openai-big', 'OpenAI', 'GPT Pro'), SONNET], 'openai-mini', null)
    expect(r.replaced).toBe(true)
    expect(r.model?.modelId).toBe('openai-big')
    expect(r.previousName).toBe('GPT Mini')
  })

  it('keeps a blocked model rather than selecting nothing when no other model is usable', () => {
    expect(resolveStoredSelection([blocked], 'openai-mini', null)).toEqual({ model: blocked, replaced: false })
  })

  it('does nothing with no saved selection or an empty catalog', () => {
    expect(resolveStoredSelection([GPT], null, null)).toEqual({ model: null, replaced: false })
    expect(resolveStoredSelection([], 'x', null)).toEqual({ model: null, replaced: false })
  })
})
