import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ enabledArg: undefined as boolean | undefined, data: undefined as { aiReferenceAllowed: boolean } | undefined, flag: true }))

vi.mock('@/lib/feature-flags', () => ({ get LIBRARY_SETTINGS_ENABLED() { return state.flag } }))
vi.mock('@/lib/library/queries', () => ({
  useLibraryPrefs: (enabled?: boolean) => {
    state.enabledArg = enabled
    return { data: state.data }
  },
}))

import { LibrarySearchOffNote } from './LibrarySearchOffNote'

beforeEach(() => {
  state.enabledArg = undefined
  state.data = undefined
  state.flag = true
})

describe('LibrarySearchOffNote', () => {
  it('says Library search is off, and that attaching still works, when an Admin turned AI reference off', () => {
    state.data = { aiReferenceAllowed: false }
    const html = renderToStaticMarkup(<LibrarySearchOffNote />)
    expect(html).toContain('Your Admin has turned off Library search. Attaching files still works.')
  })

  it('says nothing while Library search is allowed, or before the settings have loaded', () => {
    state.data = { aiReferenceAllowed: true }
    expect(renderToStaticMarkup(<LibrarySearchOffNote />)).toBe('')
    state.data = undefined
    expect(renderToStaticMarkup(<LibrarySearchOffNote />)).toBe('')
  })

  it('does not read the prefs while the settings flag is off (the backend has no /library/prefs yet)', () => {
    state.flag = false
    renderToStaticMarkup(<LibrarySearchOffNote />)
    expect(state.enabledArg).toBe(false)
  })
})
