import { describe, expect, it } from 'vitest'
import {
  asString,
  citationsFromSources,
  doneGeneratedFiles,
  eventAttachments,
  extractChatId,
  generatedOutputs,
  parseConnectPrompt,
  uploadedAttachments,
} from './stream-payload'

describe('stream payload readers', () => {
  it('reads trimmed non-empty strings only', () => {
    expect(asString('  a ')).toBe('a')
    expect(asString('   ')).toBeUndefined()
    expect(asString(3)).toBeUndefined()
  })

  it('reads the chat id from either spelling', () => {
    expect(extractChatId({ chat_id: ' c1 ' })).toBe('c1')
    expect(extractChatId({ chatId: 42 })).toBe('42')
    expect(extractChatId({ chat_id: '' })).toBeNull()
    expect(extractChatId({})).toBeNull()
  })

  it('finds file_attachments on the payload or its message', () => {
    expect(eventAttachments({ file_attachments: [{ a: 1 }] })).toEqual([{ a: 1 }])
    expect(eventAttachments({ message: { file_attachments: [] } })).toEqual([])
    expect(eventAttachments({ message: {} })).toBeNull()
  })

  it('splits generated attachments into inline images and file cards', () => {
    const out = generatedOutputs([
      { origin: 'generated', file_link: 'https://x/a.png', mime_type: 'image/png' },
      { origin: 'generated', link: ' https://x/r.pdf ', name: ' Report.pdf ' },
      { origin: 'generated', url: 'https://x/dir/data.csv' },
      { origin: 'uploaded', file_link: 'https://x/u.txt' },
      { origin: 'generated' },
    ])
    expect(out.images).toEqual([{ url: 'https://x/a.png' }])
    expect(out.files).toEqual([
      { url: 'https://x/r.pdf', filename: 'Report.pdf', mimeType: undefined },
      { url: 'https://x/dir/data.csv', filename: 'data.csv', mimeType: undefined },
    ])
  })

  it('treats every generated attachment on done as a file and ignores a bare link', () => {
    expect(doneGeneratedFiles([
      { origin: 'generated', file_link: 'https://x/a.png', mime_type: 'image/png' },
      { origin: 'generated', link: 'https://x/ignored.pdf' },
    ])).toEqual([{ url: 'https://x/a.png', filename: 'a.png', mimeType: 'image/png' }])
  })

  it('reads uploaded and user attachments with a default mime type', () => {
    expect(uploadedAttachments([
      { origin: 'uploaded', file_link: 'https://x/n.txt', file_name: 'n.txt', mime_type: 'text/plain' },
      { origin: 'user', url: 'https://x/b.bin' },
      { origin: 'generated', url: 'https://x/g.png' },
    ])).toEqual([
      { filename: 'n.txt', url: 'https://x/n.txt', mimeType: 'text/plain' },
      { filename: 'b.bin', url: 'https://x/b.bin', mimeType: 'application/octet-stream' },
    ])
  })

  it('hydrates citations from message_saved sources', () => {
    expect(citationsFromSources([
      { title: 'A', url: 'https://www.a.test/x' },
      { url: 'https://b.test' , domain: 'given.test' },
      { url: 'not a url' },
      { snippet: 'dropped' },
    ])).toEqual([
      { title: 'A', url: 'https://www.a.test/x', domain: 'a.test' },
      { title: 'https://b.test', url: 'https://b.test', domain: 'given.test' },
      { title: 'not a url', url: 'not a url', domain: undefined },
    ])
  })

  it('parses a connector connect prompt', () => {
    const prompt = parseConnectPrompt({
      connector_slug: 'gmail', display_name: 'Gmail', auth_mode: 'api_key', tool_slug: 'gmail_send', prompt_id: 'cp-1',
      provider: 'mcp', api_key_fields: [{ name: 'key', label: 'Key' }, { label: 'no name' }],
    })
    expect(prompt).toMatchObject({ request_id: 'cp-1', auth_mode: 'api_key', provider: 'mcp', tool_name: 'gmail_send' })
    expect(prompt.api_key_fields).toEqual([{ name: 'key', label: 'Key' }])
    expect(parseConnectPrompt({ provider: 'other' })).toMatchObject({ auth_mode: 'oauth2', provider: undefined, tool_name: '', api_key_fields: undefined })
  })
})
