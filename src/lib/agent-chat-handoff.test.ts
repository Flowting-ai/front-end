// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPersona, resolveSelectableChatPersonas, emitSidebarNewChat, agentChatBlocked } = vi.hoisted(() => ({
  getPersona: vi.fn(),
  resolveSelectableChatPersonas: vi.fn(),
  emitSidebarNewChat: vi.fn(),
  agentChatBlocked: vi.fn(() => false),
}))
vi.mock('@/lib/api/persona-list', () => ({ getPersona }))
vi.mock('@/lib/chat-personas', () => ({ resolveSelectableChatPersonas }))
vi.mock('@/hooks/use-sidebar-events', () => ({ emitSidebarNewChat }))
vi.mock('@/lib/agent-chat-gate', () => ({ agentChatBlocked }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { existingAgentChatHref, legacyAgentChatTarget, openAgentInChat } from './agent-chat-handoff'
import { PENDING_PERSONA_KEY } from '@/lib/storage-keys'

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  agentChatBlocked.mockReturnValue(false)
})

describe('legacy agent chat links', () => {
  it('sends ?chatId= to that chat on /chat', () => {
    expect(legacyAgentChatTarget('chat-1')).toBe('/chat?id=chat-1')
    expect(existingAgentChatHref('a b')).toBe('/chat?id=a%20b')
  })

  it('hands the agent off to a fresh chat when there is no chatId', () => {
    expect(legacyAgentChatTarget(null)).toBeNull()
    expect(legacyAgentChatTarget(undefined)).toBeNull()
    expect(legacyAgentChatTarget('  ')).toBeNull()
  })
})

describe('openAgentInChat', () => {
  it('stages the agent chip and opens /chat', async () => {
    getPersona.mockResolvedValue({ id: 'repo-1' })
    resolveSelectableChatPersonas.mockResolvedValue([{ id: 'repo-1', name: 'Agent' }])
    const navigate = vi.fn()

    await expect(openAgentInChat('repo-1', navigate)).resolves.toBe(true)

    expect(getPersona).toHaveBeenCalledWith('repo-1')
    expect(JSON.parse(sessionStorage.getItem(PENDING_PERSONA_KEY)!)).toEqual({ id: 'repo-1', name: 'Agent' })
    expect(emitSidebarNewChat).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/chat')
  })

  it('does nothing while agent chat is off', async () => {
    agentChatBlocked.mockReturnValue(true)
    const navigate = vi.fn()
    await expect(openAgentInChat('repo-1', navigate)).resolves.toBe(false)
    expect(getPersona).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('stays put when the agent cannot be used', async () => {
    getPersona.mockResolvedValue({ id: 'repo-1' })
    resolveSelectableChatPersonas.mockResolvedValue([])
    const navigate = vi.fn()
    await expect(openAgentInChat('repo-1', navigate)).resolves.toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_PERSONA_KEY)).toBeNull()
  })
})
