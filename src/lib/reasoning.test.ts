import { describe, expect, it } from 'vitest'
import {
  appendReasoningEvent,
  cleanReasoningHeading,
  createReasoningState,
  deriveReasoningSections,
  normalizeReasoningSections,
  reasoningEventText,
  splitReasoningText,
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

describe('reasoning inline-title splitting (stale prod backend)', () => {
  it('splits bold-only title lines into sections, mirroring the backend', () => {
    const text = [
      '**Creating a CSV file**',
      "I'm thinking about the need to create a CSV file.",
      '**Producing CSV data**',
      'I should use the xlsx_build function.',
    ].join('\n')

    expect(splitReasoningText(text)).toEqual([
      { heading: 'Creating a CSV file', body: "I'm thinking about the need to create a CSV file." },
      { heading: 'Producing CSV data', body: 'I should use the xlsx_build function.' },
    ])
  })

  it('treats ATX headings as titles and keeps preamble bodies', () => {
    const text = 'Some preamble.\n## Planning\nOutline the steps.'
    expect(splitReasoningText(text)).toEqual([
      { heading: '', body: 'Some preamble.' },
      { heading: 'Planning', body: 'Outline the steps.' },
    ])
  })

  it('does not treat inline bold or unbalanced markers as titles', () => {
    expect(splitReasoningText('I need **one** thing here.')).toEqual([
      { heading: '', body: 'I need **one** thing here.' },
    ])
  })

  it('splits titles glued to the end of the previous paragraph (gpt-5.5 style)', () => {
    const text = [
      '**Analyzing Shopify data**',
      '',
      "I need the last 30 days. I'll load the cache from there.**Creating a CSV file**",
      '',
      'I need to inspect the schema first.**Producing CSV file**',
      '',
      'I should use xlsx_build.',
    ].join('\n')

    expect(splitReasoningText(text)).toEqual([
      { heading: 'Analyzing Shopify data', body: "I need the last 30 days. I'll load the cache from there." },
      { heading: 'Creating a CSV file', body: 'I need to inspect the schema first.' },
      { heading: 'Producing CSV file', body: 'I should use xlsx_build.' },
    ])
  })

  it('re-splits an under-split backend section (single section, glued titles in body)', () => {
    const backendSections = [
      {
        heading: 'Analyzing Shopify data',
        body: "I'll load the cache from there.**Creating a CSV file**\n\nI need to inspect the schema.",
      },
    ]
    // Persisted path passes the raw reasoning text alongside the sections.
    const rawText = '**Analyzing Shopify data**\n\n' + backendSections[0].body

    expect(deriveReasoningSections(backendSections, rawText)).toEqual([
      { heading: 'Analyzing Shopify data', body: "I'll load the cache from there." },
      { heading: 'Creating a CSV file', body: 'I need to inspect the schema.' },
    ])
  })

  it('re-splits under-split sections even without raw text (streaming path)', () => {
    const streamed = [
      {
        heading: 'Analyzing Shopify data',
        body: 'Load the cache.**Creating a CSV file**\n\nInspect the schema.',
      },
    ]
    expect(deriveReasoningSections(streamed, '')).toEqual([
      { heading: 'Analyzing Shopify data', body: 'Load the cache.' },
      { heading: 'Creating a CSV file', body: 'Inspect the schema.' },
    ])
  })

  it('leaves inline emphasis (not followed by a newline) untouched', () => {
    expect(splitReasoningText('I need **one** thing and **two** more.')).toEqual([
      { heading: '', body: 'I need **one** thing and **two** more.' },
    ])
  })

  it('derives sections only when a real heading exists, else defers to raw text', () => {
    const structured = deriveReasoningSections([], '**Analyzing data**\nLooking at revenue.')
    expect(structured).toEqual([
      { heading: 'Analyzing data', body: 'Looking at revenue.' },
    ])

    expect(deriveReasoningSections([], 'Just plain reasoning with no titles.')).toEqual([])

    // Raw text is the most complete source, so it is always re-split — a heading
    // in the text wins even when sections were also passed.
    expect(deriveReasoningSections([{ heading: 'Stale', body: 'x' }], '**Fresh**\nbody')).toEqual([
      { heading: 'Fresh', body: 'body' },
    ])

    // No derivable heading anywhere → fall back to the passed sections as-is.
    const plain = [{ heading: '', body: 'plain' }]
    expect(deriveReasoningSections(plain, '')).toBe(plain)
  })
})
