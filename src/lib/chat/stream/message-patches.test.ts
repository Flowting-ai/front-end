import { describe, expect, it } from 'vitest'
import type { UIMessage } from '@/types/chat'
import {
  addUniqueByRequestId,
  applyUploadedAttachments,
  mergeDoneFiles,
  mergeGeneratedOutputs,
  updateMessage,
  upsertDocxProgress,
  upsertToolProgress,
} from './message-patches'

const msg = (fields: Partial<UIMessage> = {}): UIMessage =>
  ({ id: 'm', role: 'assistant', content: '', created_at: '', chat_id: 'c', ...fields }) as UIMessage

describe('message patches', () => {
  it('updates only the message with the id', () => {
    const other = msg({ id: 'o' })
    const next = updateMessage('m', (m) => ({ ...m, content: 'x' }))([other, msg()])
    expect(next[0]).toBe(other)
    expect(next[1].content).toBe('x')
  })

  it('returns the same message when generated outputs are already there', () => {
    const m = msg({ images: [{ url: 'a' }], generatedFiles: [{ url: 'f', filename: 'f' }] })
    expect(mergeGeneratedOutputs([{ url: 'f', filename: 'f' }], [{ url: 'a' }])(m)).toBe(m)
    expect(mergeDoneFiles([{ url: 'f', filename: 'f' }])(m)).toBe(m)
    expect(mergeGeneratedOutputs([], [{ url: 'b' }])(m).images).toEqual([{ url: 'a' }, { url: 'b' }])
  })

  it('links attachments by name, then by position, or creates them', () => {
    const m = msg({ attachments: [
      { id: '1', file_name: 'b.txt', file_type: 't', file_size: 1 },
      { id: '2', file_name: 'x.txt', file_type: 't', file_size: 1 },
    ] })
    const uploaded = [{ filename: 'a.txt', url: 'u-a', mimeType: 't' }, { filename: 'b.txt', url: 'u-b', mimeType: 't' }]
    expect(applyUploadedAttachments(uploaded)(m).attachments?.map((a) => a.url)).toEqual(['u-b', 'u-b'])
    const fresh = applyUploadedAttachments(uploaded)(msg()).attachments!
    expect(fresh.map((a) => [a.file_name, a.url, a.file_size])).toEqual([['a.txt', 'u-a', 0], ['b.txt', 'u-b', 0]])
  })

  it('keeps an activity detail from the tool args over a progress label', () => {
    const timeline = () => []
    const created = upsertToolProgress({ activityId: 't', type: 'tool-call', toolName: 'x', label: 'L', status: 'start' }, timeline)(msg())
    expect(created.activities?.[0]).toMatchObject({ detail: 'L', status: 'start' })
    const withDetail = msg({ activities: [{ id: 't', type: 'tool-call', detail: 'query', status: 'start' }] })
    expect(upsertToolProgress({ activityId: 't', type: 'tool-call', toolName: 'x', label: 'L', status: 'done' }, timeline)(withDetail).activities?.[0])
      .toMatchObject({ detail: 'query', label: 'L', status: 'done' })
  })

  it('names a new document row until its first message arrives', () => {
    const row = upsertDocxProgress({ activityId: 'd', status: 'executing', filename: 'r.docx', progressMessage: '' }, () => [])(msg())
    expect(row.activities?.[0]).toMatchObject({ type: 'docx-progress', detail: 'Generating r.docx' })
  })

  it('adds a prompt once per request id', () => {
    const prompt = { request_id: 'p' } as NonNullable<UIMessage['connectorPermissionPrompts']>[number]
    const once = addUniqueByRequestId('connectorPermissionPrompts', prompt)(msg())
    expect(addUniqueByRequestId('connectorPermissionPrompts', prompt)(once)).toBe(once)
  })
})
