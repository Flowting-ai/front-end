import { describe, expect, it } from 'vitest'

import { shouldCompleteStreamOnClose } from './phase'

describe('shouldCompleteStreamOnClose', () => {
  const base = {
    phase: 'thinking' as const,
    terminalEventReceived: true,
    streamErrored: false,
    aborted: false,
  }

  it('completes a live turn whose terminal event landed', () => {
    // Models the React race: onClose can run while phaseRef still says thinking,
    // immediately after message_saved.
    expect(shouldCompleteStreamOnClose(base)).toBe(true)
    expect(shouldCompleteStreamOnClose({ ...base, phase: 'streaming' })).toBe(true)
    expect(shouldCompleteStreamOnClose({ ...base, phase: 'executing' })).toBe(true)
  })

  it('does not complete errored, aborted, non-terminal, or settled streams', () => {
    expect(shouldCompleteStreamOnClose({ ...base, streamErrored: true })).toBe(false)
    expect(shouldCompleteStreamOnClose({ ...base, aborted: true })).toBe(false)
    expect(shouldCompleteStreamOnClose({ ...base, terminalEventReceived: false })).toBe(false)
    expect(shouldCompleteStreamOnClose({ ...base, phase: 'paused' })).toBe(false)
  })
})
