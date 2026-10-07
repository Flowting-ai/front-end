import { describe, expect, it } from 'vitest'
import { toPlan } from '@/lib/plan'

describe('toPlan', () => {
  it('reads the plan_updated items', () => {
    expect(toPlan([
      { id: 'a', title: 'Research', status: 'completed' },
      { id: 'b', title: 'Draft', status: 'in_progress', detail: 'Writing section 2' },
      { id: 'c', title: 'Send', status: 'pending', detail: '  ' },
    ])).toEqual([
      { id: 'a', title: 'Research', status: 'completed', detail: undefined },
      { id: 'b', title: 'Draft', status: 'in_progress', detail: 'Writing section 2' },
      { id: 'c', title: 'Send', status: 'pending', detail: undefined },
    ])
  })

  it('drops malformed rows rather than the whole plan', () => {
    expect(toPlan([{ id: 'a', title: 'Ok', status: 'failed' }, { id: 'b', title: 'Bad', status: 'done' }, { title: 'No id', status: 'pending' }, null]))
      .toEqual([{ id: 'a', title: 'Ok', status: 'failed', detail: undefined }])
  })

  it('is null when there is no usable plan', () => {
    expect(toPlan(undefined)).toBeNull()
    expect(toPlan({})).toBeNull()
    expect(toPlan([])).toBeNull()
    expect(toPlan([{ id: 'x' }])).toBeNull()
  })
})
