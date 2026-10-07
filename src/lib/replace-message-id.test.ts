import { describe, expect, it } from 'vitest'
import type { UIMessage } from '@/types/chat'
import { getRegenerateTarget, hasUploadedFiles, resolveEditReplaceId, resolveReplaceMessageId } from './replace-message-id'

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'
const OTHER_UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

function msg(id: string, role: UIMessage['role'], extra: Partial<UIMessage> = {}): UIMessage {
  return { id, role, content: `${role} ${id}`, created_at: 'x', chat_id: 'c', ...extra }
}

describe('resolveReplaceMessageId', () => {
  it('passes a bare backend UUID through', () => {
    expect(resolveReplaceMessageId(UUID)).toBe(UUID)
  })

  it('strips the "-prompt" suffix history user messages carry', () => {
    expect(resolveReplaceMessageId(`${UUID}-prompt`)).toBe(UUID)
  })

  it('gives undefined for ids the backend never issued', () => {
    expect(resolveReplaceMessageId('optimistic-user-1700000000000')).toBeUndefined()
    expect(resolveReplaceMessageId('loading-assistant-1700000000000')).toBeUndefined()
    expect(resolveReplaceMessageId('temp-1700000000000')).toBeUndefined()
    expect(resolveReplaceMessageId('local-request-repo-1')).toBeUndefined()
    expect(resolveReplaceMessageId('msg-1700000000000-ab12')).toBeUndefined()
    expect(resolveReplaceMessageId('')).toBeUndefined()
    expect(resolveReplaceMessageId(undefined)).toBeUndefined()
  })
})

describe('hasUploadedFiles', () => {
  it('sees optimistic attachments and uploaded backend files, not generated ones', () => {
    expect(hasUploadedFiles(msg('u', 'user'))).toBe(false)
    expect(hasUploadedFiles(msg('u', 'user', {
      attachments: [{ id: 'a', file_name: 'a.pdf', file_type: 'application/pdf', file_size: 1 }],
    }))).toBe(true)
    expect(hasUploadedFiles(msg('u', 'user', { file_attachments: [{ origin: 'uploaded', file_name: 'a.pdf' }] }))).toBe(true)
    expect(hasUploadedFiles(msg('u', 'user', { file_attachments: [{ origin: 'generated', file_name: 'a.png' }] }))).toBe(false)
  })
})

describe('resolveEditReplaceId', () => {
  it('uses the id of the reply after the edited message, not the message\'s own stale id', () => {
    // First edit replaced OTHER_UUID; the user message still carries it, the reply was swapped to UUID.
    const messages = [msg(`${OTHER_UUID}-prompt`, 'user'), msg(UUID, 'assistant')]
    expect(resolveEditReplaceId(messages, `${OTHER_UUID}-prompt`)).toBe(UUID)
  })

  it('falls back to the message id when there is no reply yet', () => {
    expect(resolveEditReplaceId([msg(`${UUID}-prompt`, 'user')], `${UUID}-prompt`)).toBe(UUID)
  })

  it('falls back to the message id when the reply has no backend id', () => {
    const messages = [msg(`${UUID}-prompt`, 'user'), msg('loading-assistant-1', 'assistant')]
    expect(resolveEditReplaceId(messages, `${UUID}-prompt`)).toBe(UUID)
  })

  it('gives undefined for an unsaved message with an unsaved reply', () => {
    expect(resolveEditReplaceId([msg('optimistic-user-1', 'user'), msg('loading-assistant-1', 'assistant')], 'optimistic-user-1')).toBeUndefined()
  })

  it('never takes the reply of a later turn', () => {
    const messages = [msg('optimistic-user-1', 'user'), msg('optimistic-user-2', 'user'), msg(UUID, 'assistant')]
    expect(resolveEditReplaceId(messages, 'optimistic-user-1')).toBeUndefined()
  })
})

describe('getRegenerateTarget', () => {
  it('replaces the turn of the trailing reply', () => {
    const target = getRegenerateTarget([msg(`${OTHER_UUID}-prompt`, 'user'), msg(OTHER_UUID, 'assistant'), msg(`${UUID}-prompt`, 'user'), msg(UUID, 'assistant')])
    expect(target?.userMessage.id).toBe(`${UUID}-prompt`)
    expect(target?.replaceMessageId).toBe(UUID)
  })

  it('uses the reply id swapped in by message_saved for a turn sent this session', () => {
    const target = getRegenerateTarget([msg('optimistic-user-1', 'user'), msg(UUID, 'assistant')])
    expect(target?.replaceMessageId).toBe(UUID)
  })

  it('falls back to the user message id when the reply has no backend id', () => {
    const target = getRegenerateTarget([msg(`${UUID}-prompt`, 'user'), msg('loading-assistant-1', 'assistant', { isError: true })])
    expect(target?.replaceMessageId).toBe(UUID)
  })

  it('appends (no replace) when neither has a backend id, e.g. a failed first send', () => {
    const target = getRegenerateTarget([msg('optimistic-user-1', 'user'), msg('loading-assistant-1', 'assistant', { isError: true })])
    expect(target?.userMessage.id).toBe('optimistic-user-1')
    expect(target?.replaceMessageId).toBeUndefined()
  })

  it('never takes a reply from an earlier turn', () => {
    const target = getRegenerateTarget([msg(`${OTHER_UUID}-prompt`, 'user'), msg(OTHER_UUID, 'assistant'), msg('optimistic-user-2', 'user')])
    expect(target?.replaceMessageId).toBeUndefined()
  })

  it('appends for a turn whose message had uploaded files', () => {
    const target = getRegenerateTarget([
      msg(`${UUID}-prompt`, 'user', { attachments: [{ id: 'a', file_name: 'a.pdf', file_type: 'application/pdf', file_size: 1 }] }),
      msg(UUID, 'assistant'),
    ])
    expect(target?.userMessage.id).toBe(`${UUID}-prompt`)
    expect(target?.replaceMessageId).toBeUndefined()
  })

  it('gives null without a user message to re-send', () => {
    expect(getRegenerateTarget([])).toBeNull()
    expect(getRegenerateTarget([msg(UUID, 'assistant')])).toBeNull()
    expect(getRegenerateTarget([msg('local-request-1', 'user', { localOnly: true })])).toBeNull()
  })
})
