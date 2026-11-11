// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FloatingMenu } from './index'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const press = (key: string) => act(() => {
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
})

describe('FloatingMenu roving focus', () => {
  it('keeps one tab stop and moves focus with arrows/Home/End', () => {
    act(() => root.render(
      <FloatingMenu aria-label="Tools">
        <button>A</button><button disabled>X</button><button>B</button><button>C</button>
      </FloatingMenu>,
    ))
    const [a, , b, c] = Array.from(host.querySelectorAll('button'))
    expect(host.querySelector('[role="toolbar"]')!.getAttribute('aria-orientation')).toBe('vertical')
    expect([a.tabIndex, b.tabIndex, c.tabIndex]).toEqual([0, -1, -1])
    act(() => a.focus())
    press('ArrowDown'); expect(document.activeElement).toBe(b)
    expect([a.tabIndex, b.tabIndex]).toEqual([-1, 0])
    press('ArrowDown'); expect(document.activeElement).toBe(c)
    press('ArrowDown'); expect(document.activeElement).toBe(a)
    press('ArrowUp');   expect(document.activeElement).toBe(c)
    press('Home');      expect(document.activeElement).toBe(a)
    press('End');       expect(document.activeElement).toBe(c)
  })
})
