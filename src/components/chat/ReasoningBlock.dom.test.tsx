// @vitest-environment jsdom
//
// The Thinking panel in a live DOM: it only opens when the user opens it, step
// rows survive streaming deltas without remounting, and no two rows share a key.

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReasoningBlock, type ReasoningBlockProps } from '@/components/chat/ReasoningBlock'
import type { ReasoningTimelineItem } from '@/lib/reasoning'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function render(props: Omit<ReasoningBlockProps, 'isNewMessage'>) {
  act(() => root.render(<ReasoningBlock isNewMessage {...props} />))
}

function trigger() {
  return container.querySelector<HTMLButtonElement>('button.kaya-thinking-trigger')!
}

function reasoning(content: string): ReasoningTimelineItem[] {
  return [{ kind: 'reasoning', id: 'r-1', content }]
}

describe('ReasoningBlock in the DOM', () => {
  it('never opens itself while streaming and keeps the user\'s choice after', () => {
    render({ thinkingContent: '', reasoningTimeline: reasoning('**Clarifying the topic**\n'), isThinkingInProgress: true })
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().textContent).toContain('Clarifying the topic')

    render({
      thinkingContent: '',
      reasoningTimeline: reasoning('**Clarifying the topic**\nSome thought.'),
      activities: [{ id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'executing' }],
      isThinkingInProgress: true,
    })
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().textContent).toContain('Searching the web')

    act(() => trigger().click())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')

    render({
      thinkingContent: '',
      reasoningTimeline: reasoning('**Clarifying the topic**\nSome thought.'),
      activities: [{ id: 'a-1', type: 'web-search', label: 'Searching the web', status: 'done' }],
      isThinkingInProgress: false,
      durationMs: 3_200,
    })
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().textContent).toBe('Thought for 3s')
  })

  it('drops the borrowed step heading from the trigger once the user opens the panel', () => {
    render({ thinkingContent: '', reasoningTimeline: reasoning('**Identifying execution issues**\nBody.'), isThinkingInProgress: true })
    expect(trigger().textContent).toContain('execution issues')

    act(() => trigger().click())
    // The heading is the step row's; copying it up would put identical text on
    // two nested disclosures.
    expect(trigger().textContent).toBe('Thinking')
    expect(container.textContent!.match(/execution issues/g)).toHaveLength(1)
  })

  it('keeps the active step row mounted as its body streams in', () => {
    render({ thinkingContent: '', reasoningTimeline: reasoning('**First step**\nDone.\n**Second step**\nPart'), isThinkingInProgress: true })
    const row = [...container.querySelectorAll('strong')].find((el) => el.textContent === 'Second')!
    expect(row).toBeTruthy()

    render({ thinkingContent: '', reasoningTimeline: reasoning('**First step**\nDone.\n**Second step**\nPart and more'), isThinkingInProgress: true })
    expect(row.isConnected).toBe(true)
  })

  it('keeps a step the user expanded open as the reasoning grows', () => {
    render({ thinkingContent: '', reasoningTimeline: reasoning('**First step**\nFirst body.\n**Second step**\n'), isThinkingInProgress: true })
    act(() => trigger().click())
    const first = [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')]
      .find((el) => el.textContent === 'First step')!
    act(() => first.click())
    expect(container.textContent).toContain('First body.')

    render({ thinkingContent: '', reasoningTimeline: reasoning('**First step**\nFirst body.\n**Second step**\nMore.\n**Third step**\n'), isThinkingInProgress: true })
    expect(first.isConnected).toBe(true)
    expect(first.getAttribute('aria-expanded')).toBe('true')
  })

  it('renders identical steps without duplicate React keys', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Timeline path, then the persisted-sections path.
    render({
      thinkingContent: '',
      reasoningTimeline: reasoning('**Checking context**\nSame.\n**Checking context**\nSame.'),
      isThinkingInProgress: false,
    })
    render({
      thinkingContent: '',
      reasoningSections: [
        { heading: 'Checking context', body: 'Same.' },
        { heading: 'Checking context', body: 'Same.' },
      ],
      isThinkingInProgress: false,
    })

    expect(container.textContent!.match(/Checking/g)).toHaveLength(2)

    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/i)
  })
})
