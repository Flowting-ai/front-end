import { describe, expect, it } from 'vitest'
import {
  appendReasoningEvent,
  cleanReasoningHeading,
  createReasoningState,
  normalizeReasoningSections,
  reasoningEventText,
} from '@/lib/reasoning'

describe('reasoning stream accumulation', () => {
  it('reads both current content payloads and legacy delta payloads', () => {
    expect(reasoningEventText({ content: 'content value' })).toBe('content value')
    expect(reasoningEventText({ delta: 'delta value' })).toBe('delta value')
  })

  it('merges legacy delta and snapshot events without duplication', () => {
    let state = createReasoningState()
    state = appendReasoningEvent(state, 'reasoning', 'Clarifying')
    state = appendReasoningEvent(state, 'reasoning', ' user intent')
    state = appendReasoningEvent(state, 'reasoning', 'Clarifying user intent')
    state = appendReasoningEvent(state, 'reasoning', 'Clarifying user intent')

    expect(state.text).toBe('Clarifying user intent')
  })

  it('builds multiple structured sections and merges body snapshots', () => {
    let state = createReasoningState()
    state = appendReasoningEvent(state, 'reasoning_heading', '**Clarifying user intent**')
    state = appendReasoningEvent(state, 'reasoning_body', 'I need')
    state = appendReasoningEvent(state, 'reasoning_body', 'I need more context.')
    state = appendReasoningEvent(state, 'reasoning_heading', 'Planning the response')
    state = appendReasoningEvent(state, 'reasoning_body', 'I will outline')
    state = appendReasoningEvent(state, 'reasoning_body', ' the next steps.')

    expect(state.sections).toEqual([
      {
        heading: '**Clarifying user intent**',
        body: 'I need more context.',
      },
      {
        heading: 'Planning the response',
        body: 'I will outline the next steps.',
      },
    ])
  })

  it('ignores a repeated empty heading event', () => {
    let state = createReasoningState()
    state = appendReasoningEvent(state, 'reasoning_heading', 'Checking context')
    const repeated = appendReasoningEvent(state, 'reasoning_heading', 'Checking context')

    expect(repeated.sections).toHaveLength(1)
  })

  it('falls back to raw text when a body arrives without a heading', () => {
    const state = appendReasoningEvent(
      createReasoningState(),
      'reasoning_body',
      'Unstructured reasoning',
    )

    expect(state.text).toBe('Unstructured reasoning')
    expect(state.sections).toEqual([])
  })
})

describe('reasoning normalization', () => {
  it('unwraps markdown headings instead of removing their text', () => {
    expect(cleanReasoningHeading('  **Clarifying user intent**  ')).toBe('Clarifying user intent')
    expect(cleanReasoningHeading('## Planning the story…')).toBe('Planning the story')
  })

  it('keeps only valid persisted reasoning sections', () => {
    expect(normalizeReasoningSections([
      { heading: '**Step one**', body: 'Details' },
      { heading: '', body: 'Missing heading' },
      null,
    ])).toEqual([
      { heading: '**Step one**', body: 'Details' },
    ])
  })
})
