import { describe, expect, it } from 'vitest'
import { msUntilNextPhase, sessionDeadline, sessionLimitsFromEnv, sessionPhase } from './session-policy'

const MIN = 60_000

describe('sessionLimitsFromEnv', () => {
  it('is off unless a limit is configured', () => {
    expect(sessionLimitsFromEnv({})).toBeNull()
    expect(sessionLimitsFromEnv({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: 'abc' })).toBeNull()
  })
  it('reads minutes and hours, warning defaults to 2 minutes', () => {
    expect(sessionLimitsFromEnv({ NEXT_PUBLIC_SESSION_IDLE_MINUTES: '30', NEXT_PUBLIC_SESSION_MAX_HOURS: '12' }))
      .toEqual({ idleMs: 30 * MIN, maxMs: 12 * 60 * MIN, warnMs: 2 * MIN })
  })
})

describe('sessionDeadline', () => {
  const limits = { idleMs: 30 * MIN, maxMs: 120 * MIN, warnMs: 2 * MIN }
  it('takes whichever limit comes first', () => {
    expect(sessionDeadline(limits, 0, 0)).toEqual({ at: 30 * MIN, reason: 'idle' })
    expect(sessionDeadline(limits, 100 * MIN, 0)).toEqual({ at: 120 * MIN, reason: 'max' })
  })
  it('handles a single limit and none', () => {
    expect(sessionDeadline({ ...limits, maxMs: null }, 5, 0)?.reason).toBe('idle')
    expect(sessionDeadline({ idleMs: null, maxMs: null, warnMs: 0 }, 0, 0)).toBeNull()
  })
})

describe('phases', () => {
  it('goes active → warning → expired and schedules the next change', () => {
    expect(sessionPhase(0, 10 * MIN, 2 * MIN)).toBe('active')
    expect(sessionPhase(9 * MIN, 10 * MIN, 2 * MIN)).toBe('warning')
    expect(sessionPhase(10 * MIN, 10 * MIN, 2 * MIN)).toBe('expired')
    expect(msUntilNextPhase(0, 10 * MIN, 2 * MIN)).toBe(8 * MIN)
    expect(msUntilNextPhase(9 * MIN, 10 * MIN, 2 * MIN)).toBe(MIN)
  })
})
