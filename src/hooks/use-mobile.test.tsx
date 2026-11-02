// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMobile } from './use-mobile'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mockMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn(() => ({
    get matches() { return matches },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia
  return { set(next: boolean) { matches = next; listeners.forEach((l) => l()) }, listeners }
}

const renders: boolean[] = []
function Probe() {
  const mobile = useMobile()
  renders.push(mobile)
  return <span>{mobile ? 'mobile' : 'desktop'}</span>
}

afterEach(() => { renders.length = 0 })

describe('useMobile', () => {
  it('is false on the server', () => {
    expect(renderToString(<Probe />)).toContain('desktop')
  })

  it('is true on the very first client render on a narrow screen (no desktop flash)', () => {
    mockMatchMedia(true)
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Probe />))
    expect(renders[0]).toBe(true)
    expect(renders).not.toContain(false)
    act(() => root.unmount())
  })

  it('follows viewport changes and unsubscribes on unmount', () => {
    const mq = mockMatchMedia(false)
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(<Probe />))
    expect(container.textContent).toBe('desktop')
    act(() => mq.set(true))
    expect(container.textContent).toBe('mobile')
    act(() => root.unmount())
    expect(mq.listeners.size).toBe(0)
  })
})
