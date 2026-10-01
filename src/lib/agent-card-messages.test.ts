import { describe, expect, it } from 'vitest'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import type { UIMessage } from '@/types/chat'
import { buildAgentCardMessages, mergeInjectedMessages } from './agent-card-messages'

const PERSONA: SelectedPersonaInfo = {
  id: 'repo-1', name: 'Support Triage', handle: '@support-triage', imageUrl: null, modelId: 'pro', activeVersionId: 'ver-1',
  systemPrompt: null, temperature: 0.3, visibility: 'private', ownedByViewer: true, description: '', tags: [], paused: false, shared: false,
}
const existing: UIMessage = { id: 'm1', role: 'user', content: 'hi', created_at: 'x', chat_id: 'c' }

describe('buildAgentCardMessages', () => {
  it('returns the request then the card, both browser-only', () => {
    const [request, card] = buildAgentCardMessages({
      persona: PERSONA, published: true, message: 'Create an agent that triages support emails', chatId: 'chat-9', now: new Date('2026-10-02T10:00:00Z'),
    })
    expect(request).toMatchObject({ role: 'user', content: 'Create an agent that triages support emails', localOnly: true, chat_id: 'chat-9', created_at: '2026-10-02T10:00:00.000Z' })
    expect(card).toMatchObject({ role: 'assistant', content: '', localOnly: true, agentCard: { persona: PERSONA, published: true } })
    expect(request.id).not.toBe(card.id)
  })

  it('has a stable id per agent and tolerates a chat that does not exist yet', () => {
    const a = buildAgentCardMessages({ persona: PERSONA, published: false, message: 'x' })
    const b = buildAgentCardMessages({ persona: PERSONA, published: false, message: 'x' })
    expect(a.map(m => m.id)).toEqual(b.map(m => m.id))
    expect(a[0].chat_id).toBe('')
    expect(a[1].agentCard?.published).toBe(false)
  })
})

describe('mergeInjectedMessages', () => {
  const injected = buildAgentCardMessages({ persona: PERSONA, published: true, message: 'x' })

  it('appends the new rows after the existing thread', () => {
    const merged = mergeInjectedMessages([existing], injected)
    expect(merged.map(m => m.id)).toEqual(['m1', ...injected.map(m => m.id)])
  })

  it('is idempotent and returns the same array when nothing is new', () => {
    const once = mergeInjectedMessages([existing], injected)
    expect(mergeInjectedMessages(once, injected)).toBe(once)
    expect(mergeInjectedMessages([existing], [])).toEqual([existing])
  })
})
