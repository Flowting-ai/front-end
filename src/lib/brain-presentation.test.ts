import { describe, expect, it } from 'vitest'
import {
  brainActivityItem,
  enqueuePrompt,
  executionPhaseTitle,
  agentTimelineItems,
  formatToolSlug,
  retirePrompt,
} from '@/lib/brain-presentation'
import type { AgentStep } from '@/templates/Brain/lib/phase'

describe('Brain prompt queue', () => {
  it('keeps arrival order, dedupes replay, and promotes by exact id', () => {
    const first = { request_id: 'p1', tool_name: 'clickup_list_tasks' }
    const second = { request_id: 'p2', tool_name: 'gmail_send_email' }
    let queue = enqueuePrompt([], first)
    queue = enqueuePrompt(queue, second)
    queue = enqueuePrompt(queue, first)

    expect(queue.map((prompt) => prompt.request_id)).toEqual(['p1', 'p2'])
    expect(retirePrompt(queue, 'p1')).toEqual([second])
  })
})

describe('Mayday Brain presentation adapters', () => {
  it("maps the turn's rallied agents into a result timeline", () => {
    const steps: AgentStep[] = [
      { id: 'one', label: 'Read tasks', isCritical: true, status: 'complete' },
      { id: 'two', label: 'Read docs', isCritical: false, status: 'skipped' },
      { id: 'three', label: 'Draft report', isCritical: true, status: 'failed', error: 'Agent timed out.' },
    ]

    expect(agentTimelineItems(steps, { one: 'Found 12 tasks.' })).toEqual([
      {
        id: 'one',
        label: 'Read tasks',
        result: { label: 'Completed', details: 'Found 12 tasks.', variant: 'success' },
      },
      {
        id: 'two',
        label: 'Read docs',
        result: { label: 'Skipped', details: undefined, variant: 'default' },
      },
      {
        id: 'three',
        label: 'Draft report',
        variant: 'error',
        result: { label: 'Failed', details: 'Agent timed out.', variant: 'error' },
      },
    ])
    expect(executionPhaseTitle(steps)).toBe('Agents — 1 completed · 1 skipped · 1 failed')
  })
})

describe('Brain activity rows', () => {
  it('renders a web search as a resolved search with favicon results', () => {
    expect(brainActivityItem({
      kind: 'web_search',
      id:   'ws-1',
      data: {
        query: 'multi-model execution',
        links: [
          { url: 'https://example.com/a', title: 'Model routing' },
          'https://news.ycombinator.com/item?id=1',
        ],
      },
    })).toEqual({
      id:      'ws-1',
      type:    'web-search',
      detail:  'multi-model execution',
      status:  'done',
      results: [
        { title: 'Model routing', url: 'https://example.com/a', domain: 'example.com' },
        { title: 'news.ycombinator.com/item', url: 'https://news.ycombinator.com/item?id=1', domain: 'news.ycombinator.com' },
      ],
    })
  })

  it('keeps a streaming tool call in-flight and reads the connector slug', () => {
    const streaming = brainActivityItem({
      kind: 'tool', id: 'tc-1', status: 'streaming', data: { name: 'GMAIL_SEND_EMAIL' },
    })
    expect(streaming.status).toBe('start')
    expect(streaming.detail).toBe('Gmail: Send Email')
    expect(streaming.type).toBe('tool-call')

    expect(brainActivityItem({ kind: 'tool', id: 'tc-2', status: 'complete', data: { name: 'memory' } }).status).toBe('done')
    expect(brainActivityItem({ kind: 'tool', id: 'tc-3', status: 'failed', data: { name: 'memory' } }).status).toBe('error')
  })

  it('prefers the caller label over the raw slug for rebuilt history rows', () => {
    expect(brainActivityItem({
      kind: 'tool', id: 'tc-4', status: 'complete', data: { name: 'web_read' }, label: 'example.com',
    }).detail).toBe('example.com')
  })

  it('carries progress message, code preview and elapsed time onto the row', () => {
    expect(brainActivityItem({
      kind: 'progress',
      id:   'tp-1',
      data: {
        tool: 'csv_execute', status: 'executing', filename: 'sales.csv',
        label: 'Analysing sales.csv', message: 'Reading 12k rows',
        code_preview: 'df.head()', elapsed_seconds: 2.5, percent: 40,
      },
    })).toEqual({
      id:              'tp-1',
      type:            'csv-execute',
      toolName:        'csv_execute',
      label:           'Analysing sales.csv',
      detail:          'Analysing sales.csv',
      status:          'executing',
      progressMessage: 'Reading 12k rows',
      codePreview:     'df.head()',
      filename:        'sales.csv',
      durationS:       2.5,
      percent:         40,
    })
  })

  it('formats connector slugs and leaves snake_case tool names readable', () => {
    expect(formatToolSlug('GMAIL_SEND_EMAIL')).toBe('Gmail: Send Email')
    expect(formatToolSlug('run_connector_tool')).toBe('run connector tool')
    expect(formatToolSlug('')).toBe('Tool')
  })
})
