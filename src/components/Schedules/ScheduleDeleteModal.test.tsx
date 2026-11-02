// @vitest-environment jsdom
//
// The delete prompt is a labelled alertdialog on the Radix shell; Escape closes
// it, except while the delete is in flight.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { ScheduleDeleteModal } from './ScheduleDeleteModal'

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

const pressEscape = () => act(() => {
  (document.activeElement ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})

describe('ScheduleDeleteModal', () => {
  it('is a labelled alertdialog that closes on Escape', () => {
    const onClose = vi.fn()
    act(() => root.render(<ScheduleDeleteModal isOpen scheduleName="Morning" onConfirm={() => {}} onClose={onClose} />))
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete "Morning"?')
    expect(dialog.contains(document.activeElement)).toBe(true)
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape while deleting', () => {
    const onClose = vi.fn()
    act(() => root.render(<ScheduleDeleteModal isOpen deleting scheduleName="Morning" onConfirm={() => {}} onClose={onClose} />))
    pressEscape()
    expect(onClose).not.toHaveBeenCalled()
  })
})
