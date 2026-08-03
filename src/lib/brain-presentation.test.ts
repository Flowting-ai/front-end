import { describe, expect, it } from 'vitest'
import {
  enqueuePrompt,
  executionPhaseTitle,
  agentTimelineItems,
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
