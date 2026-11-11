// @vitest-environment jsdom
//
// CH-14: the old chat's cleanup runs after the new chat registered its scroller, and must not clear it.

import { describe, expect, it, vi } from 'vitest'
import { registerChatScroller, scrollChatToMessage } from './chat-scroller'

describe('chat scroller', () => {
  it("keeps the new chat's scroller when the old chat unregisters late", () => {
    const oldScroller = vi.fn()
    const newScroller = vi.fn()
    const unregisterOld = registerChatScroller(oldScroller)
    const unregisterNew = registerChatScroller(newScroller)
    unregisterOld()

    scrollChatToMessage('m1', vi.fn())
    expect(newScroller).toHaveBeenCalledWith('m1', expect.any(Function))
    expect(oldScroller).not.toHaveBeenCalled()

    unregisterNew()
    newScroller.mockClear()
    scrollChatToMessage('m1', vi.fn())
    expect(newScroller).not.toHaveBeenCalled()
  })
})
