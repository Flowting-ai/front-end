import { describe, expect, it } from 'vitest'
import type { LibraryFile } from '@/lib/library/file'
import { togglePick } from './togglePick'

const f = (id: string) => ({ id }) as LibraryFile

describe('togglePick', () => {
  it('adds once even when toggled twice from the same stale snapshot', () => {
    let state: LibraryFile[] = []
    const updates = [(c: LibraryFile[]) => togglePick(c, f('a')), (c: LibraryFile[]) => togglePick(c, f('a'))]
    for (const update of updates) state = update(state)
    expect(state).toEqual([])
    expect(togglePick(togglePick([], f('a')), f('b')).map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('single mode replaces or clears', () => {
    expect(togglePick([f('a')], f('b'), true).map((x) => x.id)).toEqual(['b'])
    expect(togglePick([f('a')], f('a'), true)).toEqual([])
  })
  it('respects max but still allows unpicking', () => {
    const two = [f('a'), f('b')]
    expect(togglePick(two, f('c'), false, 2)).toBe(two)
    expect(togglePick(two, f('a'), false, 2).map((x) => x.id)).toEqual(['b'])
    expect(togglePick([], f('a'), false, 0)).toEqual([])
  })
})
