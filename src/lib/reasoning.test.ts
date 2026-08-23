import { describe, expect, it } from 'vitest'
import {
  appendActivityTimeline,
  appendReasoningTimeline,
  cleanReasoningHeading,
  createReasoningAccumulator,
  deriveReasoningSections,
  eventRoundIndex,
  groupReasoningTimeline,
  normalizeReasoningSections,
  reasoningEventText,
  splitHeading,
  splitReasoningText,
} from '@/lib/reasoning'

describe('ordered reasoning timeline', () => {
  it('keeps reasoning on opposite sides of a tool in separate segments', () => {
    let timeline = appendReasoningTimeline([], 'Before the tool.', 'r-0', 0)
    timeline = appendActivityTimeline(timeline, 'tool-0', 'a-0', 0)
    timeline = appendReasoningTimeline(timeline, 'After the tool.', 'r-1', 1)

    expect(timeline).toEqual([
      { kind: 'reasoning', id: 'r-0', content: 'Before the tool.', roundIndex: 0 },
      { kind: 'activity', id: 'a-0', activityId: 'tool-0', roundIndex: 0 },
      { kind: 'reasoning', id: 'r-1', content: 'After the tool.', roundIndex: 1 },
    ])
  })

  it('merges snapshots only inside the same reasoning segment', () => {
    let timeline = appendReasoningTimeline([], 'Checking', 'r-0', 0)
    timeline = appendReasoningTimeline(timeline, 'Checking context', 'unused', 0)
    timeline = appendActivityTimeline(timeline, 'tool-0', 'a-0', 0)
    timeline = appendReasoningTimeline(timeline, 'Continuing', 'r-1', 1)

    expect(timeline[0]).toMatchObject({ kind: 'reasoning', content: 'Checking context' })
    expect(timeline[2]).toMatchObject({ kind: 'reasoning', content: 'Continuing' })
  })
})

describe('reasoning stream accumulation', () => {
  it('reads the CUSTOM reasoning payload content field only', () => {
    expect(reasoningEventText({ content: 'content value' })).toBe('content value')
    expect(reasoningEventText({ delta: 'delta value' })).toBe('')
  })

  it('reads the round index only from a numeric round_index', () => {
    expect(eventRoundIndex({ round_index: 2 })).toBe(2)
    expect(eventRoundIndex({ round_index: '2' })).toBeUndefined()
    expect(eventRoundIndex({})).toBeUndefined()
  })

  it('builds multiple structured sections and merges body snapshots', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_heading', '**Clarifying user intent**')
    reasoning.event('reasoning_body', 'I need')
    reasoning.event('reasoning_body', 'I need more context.')
    reasoning.event('reasoning_heading', 'Planning the response')
    reasoning.event('reasoning_body', 'I will outline')
    reasoning.event('reasoning_body', ' the next steps.')

    expect(reasoning.sections()).toEqual([
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

  it('mirrors headings into the timeline text as markdown titles', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_heading', 'Clarifying user intent')
    reasoning.event('reasoning_body', 'I need more context.')

    // The timeline segment is re-split by TimelineReasoningStep, so a heading
    // that arrives bare must still read as a title there.
    expect(splitReasoningText(reasoning.text())).toEqual([
      { heading: 'Clarifying user intent', body: 'I need more context.' },
    ])
  })

  it('ignores a repeated heading event', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_heading', 'Checking context')
    reasoning.event('reasoning_heading', 'Checking context')

    expect(reasoning.sections()).toHaveLength(1)
  })

  it('falls back to raw text when a body arrives without a heading', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_body', 'Unstructured reasoning')

    expect(reasoning.text()).toBe('Unstructured reasoning')
    expect(reasoning.sections()).toEqual([])
  })

  it('interleaves tool activities with reasoning segments', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_body', 'Before the tool.', 0)
    reasoning.activity('tool-0', 0)
    reasoning.event('reasoning_body', 'After the tool.', 1)

    expect(reasoning.timeline()).toEqual([
      { kind: 'reasoning', id: 'reasoning-0', content: 'Before the tool.', roundIndex: 0 },
      { kind: 'activity', id: 'activity-1', activityId: 'tool-0', roundIndex: 0 },
      { kind: 'reasoning', id: 'reasoning-2', content: 'After the tool.', roundIndex: 1 },
    ])
  })

  it('renames an activity in place when the real tool_call_id arrives', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.activity('pending-0')
    reasoning.renameActivity('pending-0', 'call_abc')

    expect(reasoning.timeline()).toMatchObject([{ kind: 'activity', activityId: 'call_abc' }])
  })

  it('prefers preview steps over accumulated heading/body sections', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.event('reasoning_heading', 'Superseded')
    reasoning.step({ heading: 'Second', body: '' }, 1)
    reasoning.step({ heading: 'First', body: '' }, 0)

    expect(reasoning.sections()).toEqual([
      { heading: 'First', body: '' },
      { heading: 'Second', body: '' },
    ])
  })

  it('appends preview steps in arrival order when no index is given', () => {
    const reasoning = createReasoningAccumulator()
    reasoning.step({ heading: 'First', body: '' })
    reasoning.step({ heading: 'Second', body: '' })

    expect(reasoning.sections().map((s) => s.heading)).toEqual(['First', 'Second'])
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

describe('reasoning markdown-title rendering', () => {
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

describe('splitHeading', () => {
  it('splits a heading phrase into a leading verb and the remainder', () => {
    expect(splitHeading('Clarifying user intent')).toEqual({ verb: 'Clarifying', rest: 'user intent' })
  })

  it('leaves a single-word heading with an empty remainder', () => {
    expect(splitHeading('Summarizing')).toEqual({ verb: 'Summarizing', rest: '' })
  })

  it('strips markdown markers before splitting', () => {
    expect(splitHeading('**Analyzing Shopify data**')).toEqual({ verb: 'Analyzing', rest: 'Shopify data' })
  })
})

describe('groupReasoningTimeline', () => {
  it('merges consecutive activities into one group', () => {
    expect(groupReasoningTimeline([
      { kind: 'reasoning', id: 'r-1', content: 'A' },
      { kind: 'activity', id: 't-1', activityId: 'a-1' },
      { kind: 'activity', id: 't-2', activityId: 'a-2' },
      { kind: 'reasoning', id: 'r-2', content: 'B' },
      { kind: 'activity', id: 't-3', activityId: 'a-3' },
    ])).toEqual([
      { kind: 'reasoning', id: 'r-1', contents: ['A'] },
      { kind: 'activities', id: 't-1', activityIds: ['a-1', 'a-2'] },
      { kind: 'reasoning', id: 'r-2', contents: ['B'] },
      { kind: 'activities', id: 't-3', activityIds: ['a-3'] },
    ])
  })

  it('merges adjacent reasoning segments so the connector runs unbroken', () => {
    expect(groupReasoningTimeline([
      { kind: 'reasoning', id: 'r-1', content: 'A' },
      { kind: 'reasoning', id: 'r-2', content: 'B' },
      { kind: 'activity', id: 't-1', activityId: 'a-1' },
    ])).toEqual([
      { kind: 'reasoning', id: 'r-1', contents: ['A', 'B'] },
      { kind: 'activities', id: 't-1', activityIds: ['a-1'] },
    ])
  })

  it('returns an empty list for an empty timeline', () => {
    expect(groupReasoningTimeline([])).toEqual([])
  })
})
