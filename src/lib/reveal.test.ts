import { describe, expect, it } from 'vitest'

import { parseContentSegments } from '@/lib/content-parser'
import { nextReveal, REVEAL_DRAIN_MS, REVEAL_STEP_MS } from '@/lib/reveal'

// The component steps the reveal at most every REVEAL_STEP_MS.
const FRAME_MS = REVEAL_STEP_MS
const STEPS_PER_SECOND = Math.floor(1000 / FRAME_MS)
const PROSE = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ') // ~2,700 chars

/** Step the reveal step by step; returns every step's text. */
function run(target: string, frames: number, start = '', drainFrom?: number): string[] {
  const shown: string[] = []
  let displayed = start
  for (let i = 0; i < frames; i += 1) {
    const drainMsLeft = drainFrom === undefined || i < drainFrom
      ? undefined
      : Math.max(0, REVEAL_DRAIN_MS - (i - drainFrom) * FRAME_MS)
    displayed = nextReveal({ displayed, target, elapsedMs: FRAME_MS, drainMsLeft })
    shown.push(displayed)
  }
  return shown
}

describe('nextReveal', () => {
  it('reveals whole words', () => {
    const next = nextReveal({ displayed: '', target: 'Hello there, world', elapsedMs: 4 })
    expect(next).toBe('Hello ')
  })

  it('jumps straight to a target that no longer extends what is shown', () => {
    expect(nextReveal({ displayed: 'Hello wor', target: 'Goodbye', elapsedMs: FRAME_MS })).toBe('Goodbye')
  })

  it('catches up on a large backlog within a second while streaming', () => {
    const frames = run(PROSE, STEPS_PER_SECOND)
    expect(PROSE.length).toBeGreaterThan(2000)
    expect(frames[STEPS_PER_SECOND - 1]).toBe(PROSE)
    // …and does it progressively, not in one jump.
    expect(frames[0].length).toBeLessThan(PROSE.length / 4)
  })

  it('keeps pace with steady output instead of falling behind', () => {
    // ~120 chars arriving per 100ms, well above reading speed.
    let target = ''
    let displayed = ''
    let maxLag = 0
    for (let step = 0; step < 300; step += 1) {
      if (step % 3 === 0) target = PROSE.slice(0, Math.min(PROSE.length, (step / 3 + 1) * 120))
      displayed = nextReveal({ displayed, target, elapsedMs: FRAME_MS })
      maxLag = Math.max(maxLag, target.length - displayed.length)
    }
    expect(displayed).toBe(PROSE)
    // Never more than about a second of output behind (1,200 chars at this rate).
    expect(maxLag).toBeLessThan(400)
  })

  it('shows everything within the drain window once the stream is done', () => {
    const frames = run(PROSE, 40, '', 0)
    const lastFrame = Math.ceil(REVEAL_DRAIN_MS / FRAME_MS)
    expect(frames[lastFrame - 1]).toBe(PROSE)
    expect(frames[0]).not.toBe(PROSE)
  })

  it('shows the rest at once when the drain deadline has passed', () => {
    expect(nextReveal({ displayed: 'a', target: PROSE, elapsedMs: FRAME_MS, drainMsLeft: 0 })).toBe(PROSE)
  })

  describe('structured widgets', () => {
    const table = '<table>\n<thead><tr><th>Name</th><th>Role</th></tr></thead>\n<tbody>\n<tr><td>Alice</td><td>Engineer</td></tr>\n</tbody>\n</table>'

    it('reveals a complete widget in one step', () => {
      const target = `Here it is:\n\n${table}\n\nDone.`
      const before = 'Here it is:\n\n'
      expect(nextReveal({ displayed: before, target, elapsedMs: FRAME_MS })).toBe(`${before}${table}`)
    })

    it('stops after the opening tag while the closing tag has not arrived', () => {
      const target = 'Here it is:\n\n<table>\n<thead><tr><th>Name</th>'
      const step = nextReveal({ displayed: 'Here it is:\n\n', target, elapsedMs: 1000 })
      expect(step).toBe('Here it is:\n\n<table>')
      // …and waits there.
      expect(nextReveal({ displayed: step, target, elapsedMs: 1000 })).toBe(step)
    })

    it('includes opening-tag attributes before waiting', () => {
      const target = 'Look:\n<chart type="bar" title="Sales">\n<bar label="Q1"'
      expect(nextReveal({ displayed: 'Look:\n', target, elapsedMs: 1000 })).toBe('Look:\n<chart type="bar" title="Sales">')
    })

    it('finishes a widget it was waiting on as soon as it closes', () => {
      const target = `Intro\n${table}\nAfter`
      expect(nextReveal({ displayed: 'Intro\n<table>', target, elapsedMs: FRAME_MS })).toBe(`Intro\n${table}`)
    })

    it('never ends a step inside a widget', () => {
      const target = `${PROSE.slice(0, 600)}\n\n${table}\n\n${PROSE.slice(0, 600)}\n\n<metrics>\n<metric label="A" value="1"/>\n</metrics>\nEnd`
      const widgets = parseContentSegments(target, { streaming: true }).filter((s) => s.type !== 'markdown')
      expect(widgets).toHaveLength(2)
      for (const frame of run(target, 120)) {
        for (const widget of widgets) {
          const cutInside = frame.length > widget.start && frame.length < widget.end
          const cutAtOpenTag = frame.length === target.indexOf('>', widget.start) + 1
          expect(cutInside && !cutAtOpenTag).toBe(false)
        }
      }
    })

    it('holds back a partial tag at the end of the stream so it never shows as text', () => {
      const target = 'Some intro text <tab'
      expect(nextReveal({ displayed: '', target, elapsedMs: 1000 })).toBe('Some intro text ')
    })

    it('reveals widget-like XML inside a code fence word by word', () => {
      const rows = Array.from({ length: 8 }, (_, i) => `<tr><td>row ${i}</td></tr>`).join('\n')
      const target = `Example:\n\`\`\`xml\n<table>\n${rows}\n</table>\n\`\`\`\nDone`
      const frames = run(target, 200)
      expect(frames[frames.length - 1]).toBe(target)
      expect(frames.some((f) => f.length > 'Example:\n```xml\n<table>'.length && f.length < target.indexOf('</table>'))).toBe(true)
    })
  })
})
