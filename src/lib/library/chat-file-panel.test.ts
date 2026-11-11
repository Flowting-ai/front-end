import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeChatFilePanel, getChatFilePanel, openChatFilePanel, subscribeChatFilePanel } from './chat-file-panel'

afterEach(() => closeChatFilePanel())

describe('chat file panel store', () => {
  it('opens a file and closes it', () => {
    expect(getChatFilePanel()).toBeNull()
    openChatFilePanel('f-1')
    expect(getChatFilePanel()).toBe('f-1')
    closeChatFilePanel()
    expect(getChatFilePanel()).toBeNull()
  })

  it('tells subscribers once per real change', () => {
    const listener = vi.fn()
    const stop = subscribeChatFilePanel(listener)
    openChatFilePanel('f-1')
    openChatFilePanel('f-1')
    openChatFilePanel('f-2')
    closeChatFilePanel()
    closeChatFilePanel()
    expect(listener).toHaveBeenCalledTimes(3)
    stop()
    openChatFilePanel('f-3')
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
