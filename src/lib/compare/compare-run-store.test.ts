import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_RUN, useCompareRunStore } from './compare-run-store'

const store = () => useCompareRunStore.getState()

beforeEach(() => store().resetAll())

describe('compare run store', () => {
  it('changes one model and leaves the other entries as they were', () => {
    store().update('a', { response: 'hi', streaming: true })
    store().update('b', { response: 'yo' })
    const before = store().runs.b
    store().update('a', (run) => ({ response: `${run.response} there` }))
    expect(store().runs.a).toMatchObject({ response: 'hi there', streaming: true, connectPrompts: [] })
    expect(store().runs.b).toBe(before)
  })

  it('reset forgets one model (retry) and resetAll forgets every run', () => {
    store().update('a', { error: 'x' })
    store().update('b', { error: 'y' })
    store().reset('a')
    expect(store().runs.a).toBeUndefined()
    expect(store().runs.b?.error).toBe('y')
    store().resetAll()
    expect(store().runs).toEqual({})
  })

  it('starts a run from the empty shape', () => {
    store().update('a', (run) => ({ connectPrompts: [...run.connectPrompts] }))
    expect(store().runs.a).toEqual(EMPTY_RUN)
  })
})
