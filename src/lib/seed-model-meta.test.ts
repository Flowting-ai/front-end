import { describe, expect, it } from 'vitest'
import { seedModelMeta } from './seed-model-meta'
import type { UIMessage } from '@/types/chat'

const msg = (over: Partial<UIMessage>): UIMessage => ({ id: 'a', role: 'assistant', content: '', created_at: '', ...over } as UIMessage)
const model = { modelName: 'GPT', companyName: 'OpenAI', modelId: 'm1' }

describe('seedModelMeta', () => {
  it('fills model identity on thinking assistant messages without one', () => {
    const [out] = seedModelMeta([msg({ thinking: 't' })], model)
    expect(out.modelName).toBe('GPT')
    expect(out.modelMeta).toEqual({ modelId: 'm1', modelName: 'GPT', company: 'OpenAI' })
  })
  it('returns the same array when nothing needs seeding', () => {
    const list = [msg({ thinking: 't', modelName: 'X' }), msg({ id: 'b' }), msg({ id: 'u', role: 'user', thinking: 't' })]
    expect(seedModelMeta(list, model)).toBe(list)
    expect(seedModelMeta([msg({ thinking: 't' })].slice(), null)).toHaveLength(1)
  })
})
