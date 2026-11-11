import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_CHAT_CONTEXT, useChatUiStore } from './chat-ui-store'
import { clearChatContext, publishChatContext } from '@/lib/chat-context-store'
import { publishActiveChatAgent } from '@/lib/active-chat-agent-store'

beforeEach(() => {
  useChatUiStore.setState({ context: EMPTY_CHAT_CONTEXT, activeAgentId: null })
})

describe('chat UI store', () => {
  it('publishes the open chat and clears it only for the chat that owns it', () => {
    publishChatContext({ chatId: 'b', messages: [] })
    clearChatContext('a')
    expect(useChatUiStore.getState().context.chatId).toBe('b')
    clearChatContext('b')
    expect(useChatUiStore.getState().context).toBe(EMPTY_CHAT_CONTEXT)
  })

  it('tracks the attached agent and does not notify when it is unchanged', () => {
    let calls = 0
    const stop = useChatUiStore.subscribe(() => { calls += 1 })
    publishActiveChatAgent('agent-1')
    publishActiveChatAgent('agent-1')
    publishActiveChatAgent(null)
    stop()
    expect(calls).toBe(2)
    expect(useChatUiStore.getState().activeAgentId).toBeNull()
  })
})
