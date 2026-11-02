// @vitest-environment jsdom
//
// The stream's event handlers, driven with real AG-UI frames (stream-fixtures)
// through the SSE decoder and a fake hook context that applies every update
// to a plain messages array.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AguiSSEDecoder } from '@/lib/sse-decoder'
import type { UIMessage } from '@/types/chat'
import { STREAM_FIXTURES } from './stream-fixtures'
import { processStreamEvents } from './stream-events'
import { createStreamTurn, finishTurn, type StreamEventContext, type StreamTurn } from './stream-turn'
import { SESSION_EXPIRED_MESSAGE } from './stream-errors'

const toast = vi.hoisted(() => vi.fn())
const shareToast = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast }))
vi.mock('@/components/Library/chat/library-share-toast', () => ({ showLibraryShareToast: shareToast }))

let messages: UIMessage[]
let calls: string[]
let ctx: StreamEventContext
let turn: StreamTurn
let msgId: string | null
let chatId: string | null

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  toast.mockClear()
  shareToast.mockClear()
  messages = [
    { id: 'user-1', role: 'user', content: 'q', created_at: '', chat_id: 'chat-1', attachments: [{ id: 'a1', file_name: 'notes.txt', file_type: 'text/plain', file_size: 1 }] } as UIMessage,
    { id: 'loading-1', role: 'assistant', content: '', created_at: '', chat_id: 'chat-1', isLoading: true },
  ]
  calls = []
  msgId = 'loading-1'
  chatId = 'chat-1'
  turn = createStreamTurn()
  ctx = {
    setMessages: (u) => { calls.push('set'); messages = typeof u === 'function' ? u(messages) : u },
    queueUpdate: (fields, immediate) => {
      calls.push(immediate ? 'queue!' : 'queue')
      messages = messages.map((m) => (m.id === msgId ? { ...m, ...fields } : m))
    },
    flushPending: () => calls.push('flush'),
    messageId: () => msgId,
    setMessageId: (id) => { msgId = id },
    userMessageId: () => 'user-1',
    chatId: () => chatId,
    adoptChatId: vi.fn((id: string) => { if (!chatId || chatId.startsWith('temp-')) chatId = id }),
    onRunStarted: vi.fn(),
    onTitleUpdate: vi.fn(),
    onChatMoveToTop: vi.fn(),
    saveToLibrary: undefined,
  }
})

function play(events: object[]) {
  const decoder = new AguiSSEDecoder()
  processStreamEvents(ctx, turn, decoder.push(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')))
  return messages.find((m) => m.role === 'assistant')!
}

describe('stream events', () => {
  it('streams text, picks the model and swaps in the saved id', () => {
    const reply = play(STREAM_FIXTURES.longText)
    expect(ctx.onRunStarted).toHaveBeenCalledOnce()
    expect(reply).toMatchObject({
      id: 'real-msg-1',
      content: 'Hello there, this is a long answer. More after save.',
      modelName: 'GPT-4o',
      modelMeta: { modelId: 'gpt-4o', modelName: 'GPT-4o', deploymentName: 'gpt-4o-dep', company: 'openai' },
      isLoading: false,
      isError: false,
    })
    // The batched text is committed under the temp id before the id changes.
    const swap = calls.indexOf('set', calls.indexOf('flush'))
    expect(calls.slice(0, swap + 1)).toContain('flush')
    expect(ctx.onChatMoveToTop).toHaveBeenCalledWith('chat-1')
  })

  it('keeps reasoning sections and ends the thinking span', () => {
    const reply = play(STREAM_FIXTURES.reasoning)
    expect(reply.thinking).toContain('First I consider the question.')
    expect(reply.reasoning_sections?.length).toBeGreaterThan(0)
    expect(reply.isThinkingInProgress).toBe(false)
    expect(reply.content).toBe('The answer is 42.')
    expect(typeof reply.reasoningDurationMs).toBe('number')
    expect(ctx.onTitleUpdate).toHaveBeenCalledWith('chat-1', 'Meaning of life')
    // The first reasoning chunk and the first answer token flush right away.
    expect(calls.filter((c) => c === 'queue!').length).toBeGreaterThanOrEqual(3)
  })

  it('reads a leading <think> block as reasoning', () => {
    const reply = play(STREAM_FIXTURES.thinkTag)
    expect(reply.content).toBe('Visible answer.')
    expect(reply.thinking).toBe('Hidden reasoning')
  })

  it('adds a web search row, its citations, and the saved sources', () => {
    const reply = play(STREAM_FIXTURES.webSearch)
    expect(reply.activities?.[0]).toMatchObject({ type: 'web-search', detail: 'weather in Ames', status: 'done' })
    expect(reply.webCitations).toEqual([
      { title: 'Ames forecast', url: 'https://www.weather.example.com/ames', domain: 'weather.example.com' },
      { title: 'https://news.example.org/a', url: 'https://news.example.org/a', domain: 'news.example.org' },
    ])
    expect(reply.reasoningTimeline?.length).toBe(1)
  })

  it('follows a tool call from streamed arguments to done', () => {
    const reply = play(STREAM_FIXTURES.toolCall)
    expect(reply.activities).toHaveLength(1)
    expect(reply.activities?.[0]).toMatchObject({ id: 'call-1', toolName: 'web_search', status: 'done', label: 'Searching', progressMessage: 'Fetching' })
    expect(reply.content).toBe('Found it.')
  })

  it('creates a row from tool_progress alone and keeps an error status through tool_complete', () => {
    const reply = play(STREAM_FIXTURES.toolProgressOnly)
    expect(reply.activities).toEqual([expect.objectContaining({ id: 'tp-code_interpreter-a.py', status: 'error', label: 'Run', codePreview: undefined })])
  })

  it('marks a failed tool as error and a finished one as done', () => {
    const reply = play(STREAM_FIXTURES.toolError)
    const [email, lookup] = reply.activities!
    expect(email).toMatchObject({ toolName: 'send_email', status: 'error', detail: 'SMTP down' })
    expect(lookup).toMatchObject({ id: 'lk-1', status: 'done', durationS: 0.2, label: 'Looked up' })
  })

  it('previews an image call while it streams, then shows the image once', () => {
    const reply = play(STREAM_FIXTURES.image)
    expect(reply.activities?.[0]).toMatchObject({ id: 'call-img', toolName: 'execute', status: 'done', generatesImage: true, imageHints: { prompt: 'a red apple', aspect: 1 } })
    expect(reply.images).toEqual([
      { url: 'https://cdn.test/apple.png', s3Key: 'img/apple.png' },
      { url: 'https://cdn.test/a2.png' },
      { url: 'https://cdn.test/new.png' },
    ])
    expect(reply).toMatchObject({ id: 'real-msg-3', isError: false })
  })

  it('collects generated files and gives the user message its stored links', () => {
    const reply = play(STREAM_FIXTURES.files)
    expect(reply.activities?.[0]).toMatchObject({ id: 'docx-report.docx', type: 'docx-progress', status: 'done', detail: 'Writing', codePreview: 'doc()' })
    expect(reply.generatedFiles?.map((f) => f.url)).toEqual(['https://cdn.test/report.docx', 'https://cdn.test/sheet.csv', 'https://cdn.test/extra.pdf'])
    expect(messages[0].attachments?.[0]).toMatchObject({ id: 'a1', url: 'https://cdn.test/up/notes2.txt', uploading: false })
    expect(ctx.onTitleUpdate).toHaveBeenCalledWith('chat-1', 'Report chat')
  })

  it('handles agents, plans, prompts, blocks and Library events', () => {
    const memory = vi.fn()
    window.addEventListener('souvenir:memory-updated', memory)
    const reply = play(STREAM_FIXTURES.extras)
    window.removeEventListener('souvenir:memory-updated', memory)
    const agents = reply.activities!.filter((a) => a.type === 'agent')
    expect(agents.map((a) => [a.label, a.status, a.output])).toEqual([['Researcher', 'done', 'Looking more'], ['Writer', 'error', undefined]])
    expect(reply.plan).toHaveLength(2)
    expect(reply.browserView).toEqual({ url: 'https://live.test/v', pageUrl: 'https://site.test', control: true })
    expect(reply.responseBlocks).toHaveLength(1)
    expect(reply.libraryCitations).toEqual([{ id: 'L1', fileId: 'f1', state: 'locked' }])
    expect(reply.connectorConnectPrompts).toHaveLength(1)
    expect(reply.connectorPermissionPrompts).toHaveLength(1)
    expect(reply.chatPrompts?.map((p) => p.request_id)).toEqual(['qp-1', 'ap-1', 'up-1'])
    expect(toast).toHaveBeenCalledOnce()
    expect(shareToast).toHaveBeenCalledWith({ fileId: 'f1', grantId: 'g1', label: 'Weekly', personName: 'Maya' })
    expect(memory).toHaveBeenCalledOnce()
  })

  it('does not warn about chat-only files when the send asked not to save', () => {
    ctx.saveToLibrary = false
    play([{ type: 'CUSTOM', name: 'library_files', value: { chatOnlyFileIds: ['f'] } }])
    expect(toast).not.toHaveBeenCalled()
  })

  it('keeps streamed text when the run errors, and ignores the done that follows', () => {
    const reply = play(STREAM_FIXTURES.runError)
    expect(reply).toMatchObject({ content: 'Half an answer', isError: false, isLoading: false })
    expect(reply.errorNotice).toBeTruthy()
    expect(turn).toMatchObject({ terminalErrorSeen: true, streamFinished: true, turnFailed: true })
    expect(ctx.onChatMoveToTop).not.toHaveBeenCalled()
  })

  it('shows an error as the reply when nothing streamed', () => {
    const reply = play(STREAM_FIXTURES.errorOnly)
    expect(reply).toMatchObject({ isError: true, isLoading: false })
  })

  it('signs out on an auth error event', () => {
    const expired = vi.fn()
    window.addEventListener('auth:session-expired', expired)
    const reply = play(STREAM_FIXTURES.authError)
    window.removeEventListener('auth:session-expired', expired)
    expect(expired).toHaveBeenCalledOnce()
    expect(reply).toMatchObject({ content: SESSION_EXPIRED_MESSAGE, isError: true, isLoading: false })
  })

  it('leaves a turn without done open, for the hook to finish as ended', () => {
    const reply = play(STREAM_FIXTURES.endedWithoutDone)
    expect(reply).toMatchObject({ content: 'Cut off mid', isLoading: true })
    expect(turn.streamFinished).toBe(false)
    finishTurn(ctx, turn, 'ended')
    expect(messages[1]).toMatchObject({ content: 'Cut off mid', isLoading: false })
  })

  it('adopts a new chat id and keeps the first title', () => {
    chatId = 'temp-abc'
    play(STREAM_FIXTURES.metadataNewChat)
    expect(chatId).toBe('new-chat-9')
    expect(ctx.onTitleUpdate).toHaveBeenCalledTimes(1)
    expect(ctx.onTitleUpdate).toHaveBeenCalledWith('new-chat-9', 'Fresh chat')
  })
})
