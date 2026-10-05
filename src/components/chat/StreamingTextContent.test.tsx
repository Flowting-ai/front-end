// @vitest-environment jsdom
//
// The answer's text reveal in a live DOM, on a hand-driven animation clock:
// a fresh reply reveals from the start, a remounted one doesn't replay, steps
// land at most ~30 times a second, the loop idles while held at an unfinished
// widget, and the rest drains within the deadline once the stream ends.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REVEAL_DRAIN_MS, REVEAL_STEP_MS } from '@/lib/reveal'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const rendered = vi.hoisted(() => ({ contents: [] as string[] }))
vi.mock('@/lib/content-renderer', () => ({
  ContentRenderer: ({ content }: { content: string }) => {
    rendered.contents.push(content)
    return <div data-testid="text">{content}</div>
  },
}))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn(), trackBrowserEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { StreamingTextContent } from './ChatMessage'

const PROSE = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ')

let container: HTMLDivElement
let root: Root
let frames = new Map<number, FrameRequestCallback>()
let nextFrameId = 1
let now = 0

/** Advance the clock by `ms` in 16ms animation frames. */
function advance(ms: number) {
  const end = now + ms
  while (now < end) {
    now += 16
    const due = [...frames.values()]
    frames = new Map()
    act(() => due.forEach((callback) => callback(now)))
  }
}

const shown = () => container.querySelector('[data-testid="text"]')?.textContent ?? ''

type Props = React.ComponentProps<typeof StreamingTextContent>
function render(props: Partial<Props> & { content: string }) {
  act(() => root.render(<StreamingTextContent animate isLoading stopped={false} {...props} />))
}

beforeEach(() => {
  frames = new Map()
  now = 0
  rendered.contents = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrameId++
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('StreamingTextContent', () => {
  it('reveals a fresh reply from the start', () => {
    render({ content: PROSE })
    expect(shown()).toBe('')
    advance(100)
    expect(shown().length).toBeGreaterThan(0)
    expect(shown().length).toBeLessThan(PROSE.length)
  })

  it('does not replay text a remounted row already showed', () => {
    const before = PROSE.slice(0, 300)
    render({ content: PROSE, revealFrom: before })
    expect(shown()).toBe(before)
    advance(100)
    expect(shown().startsWith(before)).toBe(true)
    expect(shown().length).toBeGreaterThan(before.length)
  })

  it('steps at most about 30 times a second', () => {
    render({ content: PROSE })
    advance(500)
    const steps = new Set(rendered.contents).size - 1
    expect(steps).toBeGreaterThan(0)
    expect(steps).toBeLessThanOrEqual(Math.ceil(500 / REVEAL_STEP_MS))
  })

  it('stops stepping while held at a widget that is still being written', () => {
    render({ content: 'Intro text\n\n<table>\n<tr><td>a</td>' })
    advance(200)
    expect(shown()).toBe('Intro text\n\n<table>')
    expect(frames.size).toBe(0)
    // New text restarts it; the closed widget appears whole.
    render({ content: 'Intro text\n\n<table>\n<tr><td>a</td></tr>\n</table>\nAfter' })
    advance(100)
    expect(shown()).toContain('</table>')
  })

  it('shows everything within the drain deadline and reports it once caught up', () => {
    const onCaughtUp = vi.fn()
    render({ content: PROSE, onCaughtUp })
    advance(50)
    render({ content: PROSE, isLoading: false, onCaughtUp })
    advance(REVEAL_DRAIN_MS + 32)
    expect(shown()).toBe(PROSE)
    expect(onCaughtUp).toHaveBeenCalledWith(PROSE)
    expect(frames.size).toBe(0)
  })

  it('shows the full text at once without animation', () => {
    render({ content: PROSE, animate: false, isLoading: false })
    expect(shown()).toBe(PROSE)
  })
})
