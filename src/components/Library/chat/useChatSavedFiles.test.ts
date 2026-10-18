import { beforeEach, describe, expect, it, vi } from 'vitest'

const chat = vi.hoisted(() => ({ getChatMessages: vi.fn() }))
const library = vi.hoisted(() => ({ getFile: vi.fn() }))

vi.mock('@/lib/api/chat', () => chat)
vi.mock('@/lib/library/api', () => ({ libraryApi: library }))
vi.mock('@/lib/library/viewer', () => ({ useLibraryViewer: () => ({ orgKey: 'org1', ready: true }) }))

import { savedFilesOf } from './useChatSavedFiles'

const CHAT = 'chat-1'

function message(attachments: Array<{ file_name: string; origin?: string; document_id?: string }>, role = 'user') {
  return { id: 'm', role, file_attachments: attachments }
}

function detail(id: string, over: { life?: string; canDelete?: boolean; provenance?: Record<string, unknown> } = {}) {
  return {
    id,
    title: `File ${id}`,
    format: 'text',
    extension: 'txt',
    phase: 'ready',
    createdAt: '2026-10-01T00:00:00.000Z',
    source: 'uploaded',
    life: over.life ?? 'active',
    caps: { delete: over.canDelete ?? true },
    provenance: over.provenance ?? { kind: 'chat', chatId: CHAT },
  }
}

const pages = (...messages: unknown[]) => chat.getChatMessages.mockResolvedValue({ messages, has_more: false, next_cursor: null })

describe('savedFilesOf', () => {
  beforeEach(() => {
    chat.getChatMessages.mockReset()
    library.getFile.mockReset()
  })

  it('lists the files this chat created that the viewer may delete', async () => {
    pages(message([{ file_name: 'a.txt', document_id: 'a' }, { file_name: 'b.txt', document_id: 'b' }]))
    library.getFile.mockImplementation(async (id: string) => detail(id))
    const result = await savedFilesOf(CHAT)
    expect(result.status).toBe('ready')
    expect(result.status === 'ready' && result.files.map((file) => file.id)).toEqual(['a', 'b'])
  })

  it('leaves out a file only picked from Library, one already in Trash, and one the viewer cannot delete', async () => {
    pages(message([
      { file_name: 'picked.txt', document_id: 'picked' },
      { file_name: 'trashed.txt', document_id: 'trashed' },
      { file_name: 'viewer.txt', document_id: 'viewer' },
      { file_name: 'mine.txt', document_id: 'mine' },
    ]))
    library.getFile.mockImplementation(async (id: string) => {
      if (id === 'picked') return detail(id, { provenance: { kind: 'chat', chatId: 'another-chat' } })
      if (id === 'trashed') return detail(id, { life: 'trashed' })
      if (id === 'viewer') return detail(id, { canDelete: false })
      return detail(id)
    })
    const result = await savedFilesOf(CHAT)
    expect(result.status === 'ready' && result.files.map((file) => file.id)).toEqual(['mine'])
  })

  it('counts a file sent twice once, and ignores generated files and assistant messages', async () => {
    pages(
      message([{ file_name: 'a.txt', document_id: 'a' }]),
      message([{ file_name: 'a.txt', document_id: 'a' }, { file_name: 'out.docx', origin: 'generated' }]),
      message([{ file_name: 'x.txt', document_id: 'x' }], 'assistant'),
    )
    library.getFile.mockImplementation(async (id: string) => detail(id))
    await savedFilesOf(CHAT)
    expect(library.getFile).toHaveBeenCalledTimes(1)
    expect(library.getFile).toHaveBeenCalledWith('a')
  })

  it('is unknown while the history does not name the Library file behind an attachment', async () => {
    pages(message([{ file_name: 'a.txt' }]))
    expect(await savedFilesOf(CHAT)).toEqual({ status: 'unknown' })
    expect(library.getFile).not.toHaveBeenCalled()
  })

  it('is unknown while an upload does not say which chat it came from', async () => {
    pages(message([{ file_name: 'a.txt', document_id: 'a' }]))
    library.getFile.mockResolvedValue(detail('a', { provenance: { kind: 'upload' } }))
    expect(await savedFilesOf(CHAT)).toEqual({ status: 'unknown' })
  })

  it('has no saved files when the chat carried none', async () => {
    pages(message([]))
    expect(await savedFilesOf(CHAT)).toEqual({ status: 'ready', files: [] })
  })
})
