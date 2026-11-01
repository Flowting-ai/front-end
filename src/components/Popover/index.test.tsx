// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PopoverRoot, PopoverTrigger, PopoverContent } from './index'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Popover (Radix)', () => {
  it('opens from the trigger and closes on Escape', () => {
    act(() => root.render(
      <PopoverRoot>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent variant="dropdown" size="md"><p>Body</p></PopoverContent>
      </PopoverRoot>,
    ))
    const trigger = host.querySelector('button')!
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    act(() => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain('Body')
    act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
