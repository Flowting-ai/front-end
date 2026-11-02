import { describe, expect, it } from 'vitest'
import { CHAT_CREATE_FIELDS, CHAT_STREAM_FIELDS, keepAcceptedFields } from '@/lib/chat-form-fields'
import { buildStreamFormData } from './stream-request'

// An agent chat is a regular chat send carrying the agent's version id.
describe('buildStreamFormData with an agent', () => {
  it('sends persona_id straight to /chats/create and keeps it through the field filter', () => {
    const { fd } = buildStreamFormData('hi', null, null, { personaId: 'version-1' }, { useDirectBackend: true, isExistingChat: false })
    expect(fd.get('persona_id')).toBe('version-1')
    expect(keepAcceptedFields(fd, CHAT_CREATE_FIELDS).get('persona_id')).toBe('version-1')
  })

  it('sends persona_id on a follow-up /chats/{id}/stream too', () => {
    const { fd } = buildStreamFormData('again', 'chat-1', null, { personaId: 'version-1' }, { useDirectBackend: true, isExistingChat: true })
    expect(keepAcceptedFields(fd, CHAT_STREAM_FIELDS).get('persona_id')).toBe('version-1')
  })

  it('hands the proxy personaId and chatId, which /api/chat maps to persona_id', () => {
    const { fd } = buildStreamFormData('hi', 'chat-1', null, { personaId: 'version-1' }, { useDirectBackend: false, isExistingChat: true })
    expect(fd.get('personaId')).toBe('version-1')
    expect(fd.get('chatId')).toBe('chat-1')
    expect(fd.has('persona_id')).toBe(false)
  })
})
