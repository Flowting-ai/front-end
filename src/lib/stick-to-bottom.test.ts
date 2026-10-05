import { describe, expect, it } from 'vitest'
import {
  createStickToBottom,
  scrollIntentForKey,
  shouldAdjustScrollOnItemResize,
  STICK_THRESHOLD_PX,
  USER_SCROLL_WINDOW_MS,
} from './stick-to-bottom'

const VIEWPORT = 600

/** Scroll metrics for a view `dist` px above the bottom of `height` px of content. */
function at(height: number, dist: number) {
  return { scrollHeight: height, clientHeight: VIEWPORT, scrollTop: height - VIEWPORT - dist }
}

describe('createStickToBottom', () => {
  it('starts stuck and can follow', () => {
    const s = createStickToBottom()
    expect(s.stuck).toBe(true)
    expect(s.canFollow(0)).toBe(true)
  })

  it('keeps following when content grows far past the threshold without a user gesture', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    // A 1000px table lands: a scroll event (e.g. a virtualizer correction) fires
    // while the view is suddenly far from the bottom.
    expect(s.onScroll(at(3000, 1000), 10)).toBe(true)
    expect(s.canFollow(10)).toBe(true)
  })

  it('keeps following when content shrinks', () => {
    const s = createStickToBottom()
    s.onScroll(at(3000, 0), 0)
    expect(s.onScroll(at(2400, 0), 10)).toBe(true)
  })

  it('unsticks on a wheel up that scrolls the view, even by a few px', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.userIntent('up', 100)
    expect(s.canFollow(100)).toBe(false)
    expect(s.onScroll(at(2000, 4), 110)).toBe(false)
    expect(s.canFollow(500)).toBe(false)
  })

  it('stays stuck when a wheel up is swallowed by an inner scroller', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.userIntent('up', 100)
    // No scroll event on the chat scroller; once the window passes, follow resumes.
    expect(s.stuck).toBe(true)
    expect(s.canFollow(100 + USER_SCROLL_WINDOW_MS)).toBe(true)
  })

  it('unsticks on an upward scroll with no gesture it could see (keys with focus on the page, find-in-page)', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    expect(s.onScroll(at(2000, 500), 100 + USER_SCROLL_WINDOW_MS + 1)).toBe(false)
  })

  it('keeps following when the scroll range shrinks under it (composer grows, content shrinks)', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    // The viewport loses 120px: the browser clamps scrollTop down by as much.
    expect(s.onScroll({ scrollHeight: 2000, clientHeight: VIEWPORT + 120, scrollTop: 2000 - VIEWPORT - 120 }, 10)).toBe(true)
  })

  it('does not let an app jump re-stick on its own first frame near the bottom', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.unstick()
    expect(s.onScroll(at(2000, 20), 10)).toBe(false)
    expect(s.onScroll(at(2000, 600), 30)).toBe(false)
  })

  it('a send clears a scrollbar press the browser never released', () => {
    const s = createStickToBottom()
    s.pointerDown()
    expect(s.canFollow(0)).toBe(false)
    s.stick()
    expect(s.canFollow(0)).toBe(true)
  })

  it('sticks again when the user comes back within the threshold of the bottom', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.userIntent('up', 100)
    s.onScroll(at(2000, 400), 110)
    expect(s.stuck).toBe(false)

    s.userIntent('down', 1000)
    expect(s.onScroll(at(2000, 200), 1010)).toBe(false)
    expect(s.onScroll(at(2000, STICK_THRESHOLD_PX), 1020)).toBe(true)
    expect(s.canFollow(1020)).toBe(true)
  })

  it('sticks again when the view lands near the bottom without a gesture (e.g. content shrank)', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.userIntent('up', 100)
    s.onScroll(at(2000, 400), 110)
    expect(s.onScroll(at(1600, 0), 5000)).toBe(true)
  })

  it('a scrollbar drag toward history unsticks and holds follow off while pressed', () => {
    const s = createStickToBottom()
    s.onScroll(at(2000, 0), 0)
    s.pointerDown()
    expect(s.canFollow(10)).toBe(false)
    expect(s.onScroll(at(2000, 40), 10)).toBe(false)
    expect(s.onScroll(at(2000, 300), 5000)).toBe(false)

    s.pointerDown()
    s.onScroll(at(2000, 0), 6000)
    expect(s.pointerUp(6000)).toBe(true)
    expect(s.stuck).toBe(true)
    expect(s.canFollow(6000)).toBe(true)
  })

  it('ignores a pointer release that did not start on the scroller', () => {
    const s = createStickToBottom()
    expect(s.pointerUp(0)).toBe(false)
    expect(s.onScroll(at(2000, 500), 10)).toBe(true)
  })

  it('stick() and unstick() override the current state', () => {
    const s = createStickToBottom()
    s.unstick()
    expect(s.stuck).toBe(false)
    expect(s.canFollow(0)).toBe(false)

    s.userIntent('up', 100)
    s.stick()
    expect(s.stuck).toBe(true)
    expect(s.canFollow(100)).toBe(true)
  })
})

describe('scrollIntentForKey', () => {
  it('maps navigation keys to a direction', () => {
    expect(['ArrowUp', 'PageUp', 'Home'].map(k => scrollIntentForKey(k, false))).toEqual(['up', 'up', 'up'])
    expect(['ArrowDown', 'PageDown', 'End'].map(k => scrollIntentForKey(k, false))).toEqual(['down', 'down', 'down'])
    expect(scrollIntentForKey(' ', true)).toBe('up')
    expect(scrollIntentForKey(' ', false)).toBe('down')
  })

  it('ignores other keys', () => {
    expect(scrollIntentForKey('a', false)).toBeNull()
    expect(scrollIntentForKey('Enter', false)).toBeNull()
  })
})

describe('shouldAdjustScrollOnItemResize', () => {
  it('compensates for rows above the viewport', () => {
    expect(shouldAdjustScrollOnItemResize({ index: 2, start: 100 }, 10, 500)).toBe(true)
  })

  it('leaves rows at or below the viewport top alone', () => {
    expect(shouldAdjustScrollOnItemResize({ index: 2, start: 500 }, 10, 500)).toBe(false)
  })

  it('never compensates for the last (streaming) row, even when its top is above the viewport', () => {
    expect(shouldAdjustScrollOnItemResize({ index: 9, start: 100 }, 10, 5000)).toBe(false)
  })
})
