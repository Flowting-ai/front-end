import { describe, expect, it } from 'vitest'
import {
  enqueuePrompt,
  executionPhaseTitle,
  planTimelineItems,
  retirePrompt,
} from '@/lib/brain-presentation'
import type { PlanStep } from '@/templates/Brain/lib/phase'

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
  it('maps canonical plan state into a result timeline', () => {
    const steps: PlanStep[] = [
      { id: 'one', label: 'Read tasks', isCritical: true, status: 'complete' },
      { id: 'two', label: 'Read docs', isCritical: false, status: 'skipped' },
      { id: 'three', label: 'Draft report', isCritical: true, status: 'failed' },
    ]

    expect(planTimelineItems(steps, { one: 'Found 12 tasks.' })).toEqual([
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
        result: { label: 'Failed', details: undefined, variant: 'error' },
      },
    ])
    expect(executionPhaseTitle(steps)).toBe('Execution — 1 completed · 1 skipped · 1 failed')
  })
})
