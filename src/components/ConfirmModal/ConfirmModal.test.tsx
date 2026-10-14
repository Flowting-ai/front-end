// @vitest-environment jsdom
//
// The shared confirm dialog is announced as a modal alert dialog, named by its
// title and described by its body, and takes focus while open.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { ConfirmModal } from './index'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  class Stub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: Stub })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ConfirmModal', () => {
  it('is a labelled modal alertdialog that holds focus and closes on Escape', () => {
    const onClose = vi.fn()
    act(() => root.render(
      <ConfirmModal title="Delete report.pdf forever?" description="This can't be undone." confirmLabel="Delete forever" onConfirm={async () => {}} onClose={onClose} />,
    ))
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete report.pdf forever?')
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe("This can't be undone.")
    expect(dialog.contains(document.activeElement)).toBe(true)

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(onClose).toHaveBeenCalled()
  })
})
