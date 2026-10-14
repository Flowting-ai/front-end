import { describe, expect, it } from 'vitest'
import { modelWireSchema, modelWithStatusSchema, parseModelList } from '@/lib/api/model-schemas'
import { filterModels, formatContextWindow, providersInOrder, withBlocked } from './catalog'

const m = (model_id: string, model_provider: string, blocked: boolean, model_name = model_id) =>
  ({ model_id, model_name, model_provider, blocked })

const MODELS = [m('gpt-5', 'OpenAI', false), m('claude', 'Anthropic', true), m('o4', 'OpenAI', true)]

describe('catalog helpers', () => {
  it('keeps provider order from the API', () => {
    expect(providersInOrder(MODELS)).toEqual(['OpenAI', 'Anthropic'])
  })

  it('filters by tab and search', () => {
    expect(filterModels(MODELS, 'enabled', '').map(x => x.model_id)).toEqual(['gpt-5'])
    expect(filterModels(MODELS, 'disabled', '').map(x => x.model_id)).toEqual(['claude', 'o4'])
    expect(filterModels(MODELS, 'all', ' openai ').map(x => x.model_id)).toEqual(['gpt-5', 'o4'])
    expect(filterModels(MODELS, 'all', 'CLAU').map(x => x.model_id)).toEqual(['claude'])
  })

  it('applies and rolls back a toggle without touching other rows', () => {
    const optimistic = withBlocked(MODELS, 'gpt-5', true)
    expect(optimistic[0].blocked).toBe(true)
    expect(optimistic[1]).toBe(MODELS[1])
    expect(withBlocked(optimistic, 'gpt-5', false)).toEqual(MODELS)
  })
})

describe('model schemas', () => {
  const valid = { model_id: 'a', model_name: 'A', model_provider: 'P', model_plan_type: 'pro', model_description: 'd' }

  it('fills defaults', () => {
    const parsed = modelWithStatusSchema.parse({ ...valid, model_inputs: null })
    expect(parsed).toMatchObject({ model_inputs: [], model_outputs: [], blocked: false })
    expect(parsed.model_tags).toBeUndefined()
  })

  it('drops only the malformed rows', () => {
    const { models, dropped } = parseModelList(modelWireSchema, [valid, { model_id: 'b' }, { ...valid, model_id: 'c' }])
    expect(models.map(x => x.model_id)).toEqual(['a', 'c'])
    expect(dropped).toBe(1)
  })

  it('rejects a non-list payload', () => {
    expect(() => parseModelList(modelWireSchema, { detail: 'x' })).toThrow()
  })
})

describe('formatContextWindow', () => {
  it('formats millions to one decimal, thousands rounded, unknown as null', () => {
    expect(formatContextWindow(1_500_000)).toBe('1.5M ctx')
    expect(formatContextWindow(2_000_000)).toBe('2M ctx')
    expect(formatContextWindow(200_000)).toBe('200k ctx')
    expect(formatContextWindow(512)).toBe('512 ctx')
    expect(formatContextWindow(0)).toBeNull()
    expect(formatContextWindow(null)).toBeNull()
  })
})
