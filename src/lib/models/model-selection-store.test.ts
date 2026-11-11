import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIModel } from '@/types/ai-model'
import { MODEL_SELECTION_KEY } from '@/lib/storage-keys'
import {
  clearSelection,
  getSelectionSnapshot,
  resolveSelection,
  stableKey,
  subscribeSelection,
  writeSelection,
} from './model-selection-store'

const model = (modelId: string, extra: Partial<AIModel> = {}) =>
  ({ id: modelId.length, modelId, modelName: modelId.toUpperCase(), companyName: 'Acme', tags: [], ...extra }) as unknown as AIModel

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
})

describe('selection store', () => {
  it('writes the stable id, notifies, and keeps a stable snapshot', () => {
    const seen = vi.fn()
    const stop = subscribeSelection(seen)
    writeSelection(model('gpt'))
    expect(localStorage.getItem(MODEL_SELECTION_KEY)).toBe('gpt')
    const a = getSelectionSnapshot()
    expect(a).toBe(getSelectionSnapshot())
    expect(a.cached?.modelName).toBe('GPT')
    writeSelection(model('gpt'))
    expect(seen).toHaveBeenCalledTimes(1)
    clearSelection()
    expect(getSelectionSnapshot().key).toBeNull()
    stop()
  })

  it('prefers modelId over the numeric id', () => {
    expect(stableKey({ modelId: 'x', id: 9 } as AIModel)).toBe('x')
    expect(stableKey({ modelId: undefined, id: 9 } as unknown as AIModel)).toBe('9')
  })
})

describe('resolveSelection', () => {
  const catalog = [model('std', { tags: ['Recommended'] } as Partial<AIModel>), model('pro')]

  it('shows the cached copy until the catalogue loads', () => {
    const r = resolveSelection([], { key: 'pro', cached: { modelName: 'PRO' } })
    expect(r.model?.modelName).toBe('PRO')
    expect(r.persist).toBeNull()
  })

  it('keeps a saved model that still exists', () => {
    const r = resolveSelection(catalog, { key: 'pro', cached: null })
    expect(r.model?.modelId).toBe('pro')
    expect(r.replacedName).toBeNull()
  })

  it('defaults to the recommended model when nothing is saved', () => {
    const r = resolveSelection(catalog, { key: null, cached: null })
    expect(r.model?.modelId).toBe('std')
    expect(r.persist?.modelId).toBe('std')
  })
})
