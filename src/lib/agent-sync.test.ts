import { describe, expect, it } from 'vitest'
import { INITIAL_SYNC_STATE, syncReducer, type SyncAction, type SyncState } from './agent-sync'
import type { AgentDraft } from './agent-draft'
import type { AgentRecord } from './agent-record'

const SAVED: AgentDraft = {
  name: 'Support Triage',
  description: 'Sorts support emails.',
  instructions: 'You triage support emails.',
  modelId: 'claude',
  temperature: 0.5,
  avatarUrl: 'https://cdn/a.jpg?sig=1',
  tags: [],
}

const record = (over: Partial<AgentDraft> = {}, versionId = 'v1'): AgentRecord => ({
  repoId: 'r1', versionId, isLive: true, handle: '@support-triage', isPaused: false, saved: { ...SAVED, ...over },
})

const run = (state: SyncState, ...actions: SyncAction[]) => actions.reduce(syncReducer, state)
const loaded = () => run(INITIAL_SYNC_STATE, { type: 'record', record: record() })

describe('syncReducer', () => {
  it('adopts the first record as both baseline and draft', () => {
    const state = loaded()
    expect(state.baseline).toEqual(SAVED)
    expect(state.draft).toEqual(SAVED)
    expect(state.versionId).toBe('v1')
    expect(state.notice).toBeNull()
  })

  it('applies edits to the draft only', () => {
    const state = run(loaded(), { type: 'edit', patch: { name: 'Renamed' } })
    expect(state.draft?.name).toBe('Renamed')
    expect(state.baseline?.name).toBe('Support Triage')
  })

  it('ignores edits before anything is loaded', () => {
    expect(syncReducer(INITIAL_SYNC_STATE, { type: 'edit', patch: { name: 'x' } })).toBe(INITIAL_SYNC_STATE)
  })

  it('ignores an identical record, including a re-signed avatar URL', () => {
    const before = loaded()
    const after = syncReducer(before, { type: 'record', record: record({ avatarUrl: 'https://cdn/a.jpg?sig=2' }) })
    expect(after).toBe(before)
  })

  it('adopts an external change when the view is clean, with an "updated" note', () => {
    const state = run(loaded(), { type: 'record', record: record({ name: 'Changed elsewhere' }) })
    expect(state.draft?.name).toBe('Changed elsewhere')
    expect(state.baseline?.name).toBe('Changed elsewhere')
    expect(state.notice).toBe('updated')
  })

  it('keeps unsaved edits and flags a conflict when the record changes underneath', () => {
    const state = run(
      loaded(),
      { type: 'edit', patch: { description: 'My unsaved text' } },
      { type: 'record', record: record({ name: 'Changed elsewhere' }) },
    )
    expect(state.draft?.description).toBe('My unsaved text')
    expect(state.draft?.name).toBe('Support Triage')
    expect(state.notice).toBe('conflict')
    expect(state.incoming?.saved.name).toBe('Changed elsewhere')
  })

  it('reloads the held-back copy on accept, discarding local edits', () => {
    const state = run(
      loaded(),
      { type: 'edit', patch: { description: 'My unsaved text' } },
      { type: 'record', record: record({ name: 'Changed elsewhere' }) },
      { type: 'accept' },
    )
    expect(state.draft?.name).toBe('Changed elsewhere')
    expect(state.draft?.description).toBe('Sorts support emails.')
    expect(state.notice).toBe('updated')
    expect(state.incoming).toBeNull()
  })

  it('accept with nothing held back just discards local edits', () => {
    const state = run(loaded(), { type: 'edit', patch: { name: 'x' } }, { type: 'accept' })
    expect(state.draft).toEqual(SAVED)
    expect(state.notice).toBeNull()
  })

  it('treats a version change as an external change', () => {
    const state = run(loaded(), { type: 'record', record: record({}, 'v2') })
    expect(state.versionId).toBe('v2')
    expect(state.notice).toBe('updated')
  })

  describe('own saves', () => {
    const SAVED_DRAFT: AgentDraft = { ...SAVED, name: 'Renamed', avatarUrl: 'https://cdn/b.jpg?sig=9' }
    const afterSave = () => run(loaded(), { type: 'edit', patch: { name: 'Renamed' } }, { type: 'saved', draft: SAVED_DRAFT })

    it('makes the saved draft the new baseline with no note', () => {
      const state = afterSave()
      expect(state.baseline).toEqual(SAVED_DRAFT)
      expect(state.draft).toEqual(SAVED_DRAFT)
      expect(state.notice).toBeNull()
    })

    it('does not flag the server catching up with the save', () => {
      const state = run(afterSave(), { type: 'record', record: record({ name: 'Renamed', avatarUrl: 'https://cdn/b.jpg?sig=10' }) })
      expect(state.notice).toBeNull()
      expect(state.staleBaseline).toBeNull()
      expect(state.draft?.name).toBe('Renamed')
    })

    it('ignores a refetch that was already in flight and returns the pre-save copy', () => {
      const before = afterSave()
      const after = syncReducer(before, { type: 'record', record: record() })
      expect(after).toBe(before)
      expect(after.draft?.name).toBe('Renamed')
      expect(after.notice).toBeNull()
    })

    it('still treats a genuinely different copy after a save as external', () => {
      const state = run(afterSave(), { type: 'record', record: record({ name: 'Third party' }) })
      expect(state.draft?.name).toBe('Third party')
      expect(state.notice).toBe('updated')
    })
  })

  it('dismisses a note', () => {
    const state = run(loaded(), { type: 'record', record: record({ name: 'x' }) }, { type: 'dismiss' })
    expect(state.notice).toBeNull()
    expect(syncReducer(state, { type: 'dismiss' })).toBe(state)
  })
})
