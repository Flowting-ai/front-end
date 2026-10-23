import { describe, expect, it } from 'vitest'
import { createRunGuard } from './run-guard'

describe('createRunGuard', () => {
  it('lets only the first of two quick presses through', () => {
    const guard = createRunGuard()
    expect(guard.tryStart()).toBe(true)
    expect(guard.tryStart()).toBe(false)
  })

  it('lets the next press through once the run request has settled', () => {
    const guard = createRunGuard()
    guard.tryStart()
    guard.done()
    expect(guard.tryStart()).toBe(true)
  })

  it('keeps separate screens independent', () => {
    const a = createRunGuard()
    const b = createRunGuard()
    a.tryStart()
    expect(b.tryStart()).toBe(true)
  })
})
