import { describe, expect, it } from 'vitest'

import { shouldCompletePlannerStreamOnClose } from './phase'

describe('shouldCompletePlannerStreamOnClose', () => {
  const base = {
    phase: 'thinking' as const,
    terminalEventReceived: true,
    streamErrored: false,
    aborted: false,
    planProposed: false,
    waitingForApproval: false,
  }

  it('does not complete a planner turn whose plan proposal is waiting for approval', () => {
    expect(shouldCompletePlannerStreamOnClose({
      ...base,
      // This deliberately models the React race: RUN_FINISHED/onClose can run
      // while phaseRef still says thinking, immediately after plan_proposed.
      planProposed: true,
      waitingForApproval: true,
    })).toBe(false)
  })

  it('uses either synchronous plan flag to protect the plan card', () => {
    expect(shouldCompletePlannerStreamOnClose({ ...base, planProposed: true })).toBe(false)
    expect(shouldCompletePlannerStreamOnClose({ ...base, waitingForApproval: true })).toBe(false)
  })

  it('keeps the terminal safety net for ordinary direct-answer streams', () => {
    expect(shouldCompletePlannerStreamOnClose(base)).toBe(true)
    expect(shouldCompletePlannerStreamOnClose({ ...base, phase: 'streaming' })).toBe(true)
  })

  it('does not complete errored, aborted, non-terminal, or non-live streams', () => {
    expect(shouldCompletePlannerStreamOnClose({ ...base, streamErrored: true })).toBe(false)
    expect(shouldCompletePlannerStreamOnClose({ ...base, aborted: true })).toBe(false)
    expect(shouldCompletePlannerStreamOnClose({ ...base, terminalEventReceived: false })).toBe(false)
    expect(shouldCompletePlannerStreamOnClose({ ...base, phase: 'planning' })).toBe(false)
  })
})
