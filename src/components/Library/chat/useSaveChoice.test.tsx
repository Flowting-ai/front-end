// @vitest-environment jsdom
//
// useSaveChoice with "Ask each time" (CH-9): a second message asked about while the dialog is open
// waits its turn instead of replacing the first, and each answer goes to its own files.

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('sonner', () => ({ toast: vi.fn() }))
vi.mock('@/lib/library/queries', () => ({
  useLibraryPrefs: () => ({ data: { effectiveAutoSave: 'ask', forcedOff: false } }),
}))
vi.mock('@/lib/library/library-dont-save', () => ({ useDontSaveChat: () => false }))
vi.mock('./AskSaveDialog', () => ({
  AskSaveDialog: ({ files, onChoose }: { files: Array<{ name: string }>; onChoose: (save: boolean) => void }) => (
    <div role="dialog">
      <span>{files.map((f) => f.name).join(',')}</span>
      <button onClick={() => onChoose(true)}>Save</button>
      <button onClick={() => onChoose(false)}>Don&apos;t save</button>
    </div>
  ),
}))

import { useSaveChoice } from './useSaveChoice'
import { libraryRefsFor } from '@/lib/library/upload/composer-uploads'

let container: HTMLDivElement
let root: Root
const hook: { decide: (files: File[]) => Promise<void> } = { decide: () => Promise.resolve() }

function Host({ expose }: { expose: (decide: (files: File[]) => Promise<void>) => void }) {
  const { decideSave, saveDialog } = useSaveChoice()
  useEffect(() => expose(decideSave))
  return <>{saveDialog}</>
}

const dialogFiles = () => container.querySelector('[role="dialog"] span')?.textContent ?? null
const click = async (name: string) => {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === name)!
  await act(async () => button.click())
}

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<Host expose={(decide) => { hook.decide = decide }} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('useSaveChoice, Ask each time', () => {
  it('asks about a second message after the first, not instead of it', async () => {
    const a = new File(['a'], 'a.txt')
    const b = new File(['b'], 'b.txt')
    const done: string[] = []
    await act(async () => {
      void hook.decide([a]).then(() => done.push('a'))
      void hook.decide([b]).then(() => done.push('b'))
    })
    expect(dialogFiles()).toBe('a.txt')

    await click('Save')
    expect(done).toEqual(['a'])
    expect(dialogFiles()).toBe('b.txt')

    await click("Don't save")
    expect(done).toEqual(['a', 'b'])
    expect(dialogFiles()).toBeNull()

    expect(libraryRefsFor([a]).saveToLibrary).toBe(true)
    expect(libraryRefsFor([b]).saveToLibrary).toBe(false)
  })

  it('asks nothing for a message without files', async () => {
    await act(async () => hook.decide([]))
    expect(dialogFiles()).toBeNull()
  })
})
