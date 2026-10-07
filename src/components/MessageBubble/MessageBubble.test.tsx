// @vitest-environment jsdom
//
// User-bubble action bar: revealed by hovering the whole row or by focusing one
// of its buttons; the edit shortcut hint shows the platform's modifier key; and
// leaving the editor hands focus back to the Edit button.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/content-renderer', () => ({ ContentRenderer: ({ content }: { content: string }) => <div>{content}</div> }))

import { MessageBubble } from './index'

let container: HTMLDivElement
let root: Root
const onEditSave = vi.fn()

beforeAll(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub, IntersectionObserver: Stub })
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => {
  onEditSave.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

async function mount() {
  await act(async () => root.render(
    <MessageBubble role="user" content="hello there" timestamp="Today" onEditSave={onEditSave} />,
  ))
}

const editButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Edit message"]')!
const copyButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Copy message"]')!
// IconButton wraps its <button> in a <span>; the bar is the nearest <div>.
const actionBar = () => editButton().closest('div')!
const textarea = () => document.querySelector('textarea')
const button = (label: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent === label)!

describe('MessageBubble action bar', () => {
  it('is hidden until the row is hovered', async () => {
    await mount()
    expect(actionBar().style.pointerEvents).toBe('none')

    // The root spans the full row width, not just the fit-content bubble.
    const row = container.firstElementChild as HTMLElement
    expect(row.style.width).toBe('100%')
    await act(async () => { row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })) })
    expect(actionBar().style.pointerEvents).toBe('auto')
  })

  it('is revealed while one of its buttons has focus', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    await mount()

    await act(async () => { copyButton().focus() })
    expect(actionBar().style.pointerEvents).toBe('auto')

    // Moving focus between buttons inside the bar keeps it revealed.
    await act(async () => { editButton().focus() })
    expect(actionBar().style.pointerEvents).toBe('auto')

    await act(async () => { outside.focus() })
    expect(actionBar().style.pointerEvents).toBe('none')
  })

  it('shows Ctrl in the save shortcut on Windows', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    await mount()
    await act(async () => { editButton().click() })
    expect(document.querySelector('kbd')?.textContent).toBe('Ctrl↵')
  })

  it('shows ⌘ in the save shortcut on macOS', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    await mount()
    await act(async () => { editButton().click() })
    expect(document.querySelector('kbd')?.textContent).toBe('⌘↵')
  })

  it('returns focus to the Edit button after cancelling', async () => {
    await mount()
    await act(async () => { editButton().click() })
    expect(document.activeElement).toBe(textarea())

    await act(async () => { button('Cancel').click() })
    expect(textarea()).toBeNull()
    expect(document.activeElement).toBe(editButton())
    expect(actionBar().style.pointerEvents).toBe('auto')
    expect(onEditSave).not.toHaveBeenCalled()
  })

  it('returns focus to the Edit button after Escape and after saving', async () => {
    await mount()
    await act(async () => { editButton().click() })
    await act(async () => { textarea()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(editButton())

    await act(async () => { editButton().click() })
    await act(async () => {
      const el = textarea()!
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, 'hello again')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { button('Save').click() })
    expect(onEditSave).toHaveBeenCalledWith('hello again')
    expect(document.activeElement).toBe(editButton())
  })
})
