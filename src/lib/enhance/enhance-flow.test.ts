import { describe, expect, it } from 'vitest'
import type { Question } from '@/enhance'
import { INITIAL_ENHANCE_STATE, canAdvance, enhanceReducer, type EnhanceAction, type EnhanceFlowState } from './enhance-flow'

const single: Question = { id: 'q1', text: 'Audience?', options: [{ id: 'a', label: 'Lawyers' }, { id: 'b', label: 'Clients' }, { id: 'custom', label: 'Other' }] } as Question
const multi: Question = { id: 'q2', text: 'Tone?', multiSelect: true, maxSelect: 2, options: [{ id: 'a', label: 'Warm' }, { id: 'b', label: 'Formal' }, { id: 'c', label: 'Brief' }] } as Question

const run = (...actions: EnhanceAction[]): EnhanceFlowState => actions.reduce(enhanceReducer, INITIAL_ENHANCE_STATE)

describe('enhanceReducer', () => {
  it('backend with no questions goes straight to the diff with its draft', () => {
    const state = run({ type: 'startBackend' }, { type: 'backendReady', draft: 'DRAFT', questions: [] })
    expect(state).toMatchObject({ phase: 'diff', draft: 'DRAFT', backendDraft: 'DRAFT', waiting: false })
  })

  it('backend with questions opens Q&A and keeps the first draft as the fallback', () => {
    const state = run({ type: 'startBackend' }, { type: 'backendReady', draft: 'FIRST', questions: [single] })
    expect(state).toMatchObject({ phase: 'qa', backendDraft: 'FIRST', draft: '' })
  })

  it('local scan ends in Q&A, or Complete when nothing needs asking', () => {
    expect(run({ type: 'startLocal', mode: 'BUILD', questions: [single] }, { type: 'scanDone' }).phase).toBe('qa')
    expect(run({ type: 'startLocal', mode: 'AUDIT', questions: [] }, { type: 'scanDone' }).phase).toBe('complete')
  })

  it('ignores a late scan timer after the panel closed', () => {
    expect(run({ type: 'startLocal', mode: 'BUILD', questions: [single] }, { type: 'close' }, { type: 'scanDone' }).phase).toBe('idle')
  })

  it('single-select toggles one answer; multi-select respects its cap', () => {
    let state = run({ type: 'startLocal', mode: 'BUILD', questions: [single, multi] })
    state = enhanceReducer(state, { type: 'toggleOption', questionId: 'q1', label: 'Lawyers' })
    state = enhanceReducer(state, { type: 'toggleOption', questionId: 'q1', label: 'Clients' })
    expect(state.answers.q1).toEqual(['Clients'])
    for (const label of ['Warm', 'Formal', 'Brief']) state = enhanceReducer(state, { type: 'toggleOption', questionId: 'q2', label })
    expect(state.answers.q2).toEqual(['Warm', 'Formal'])
  })

  it('typed "Other" answers commit as answers and enable Continue', () => {
    let state = run({ type: 'startLocal', mode: 'BUILD', questions: [single] }, { type: 'scanDone' })
    expect(canAdvance(state)).toBe(false)
    state = enhanceReducer(state, { type: 'setCustom', questionId: 'q1', text: '  Judges  ' })
    expect(canAdvance(state)).toBe(true)
    state = enhanceReducer(state, { type: 'commitCustom', questionId: 'q1' })
    expect(state.answers.q1).toEqual(['Judges'])
    expect(state.customText.q1).toBe('')
  })

  it('moves between questions within bounds', () => {
    let state = run({ type: 'startLocal', mode: 'BUILD', questions: [single, multi] })
    state = enhanceReducer(state, { type: 'back' })
    expect(state.qIdx).toBe(0)
    state = enhanceReducer(enhanceReducer(state, { type: 'next' }), { type: 'next' })
    expect(state.qIdx).toBe(1)
  })

  it('slow only applies while waiting, and finish clears the draft', () => {
    expect(run({ type: 'slow' }).slow).toBe(false)
    expect(run({ type: 'startBackend' }, { type: 'slow' }).slow).toBe(true)
    expect(run({ type: 'showDraft', draft: 'X' }, { type: 'finish' })).toMatchObject({ phase: 'idle', draft: '' })
  })
})
