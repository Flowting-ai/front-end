import { describe, expect, it, vi } from 'vitest'
import { consumeBrainStream, parseBrainContextEvent } from '@/lib/api/brain'

function streamResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }))
}

describe('consumeBrainStream', () => {
  it('dispatches a terminal named event when the stream closes without a trailing blank line', async () => {
    const onNamed = vi.fn()
    const onInline = vi.fn()
    const onClose = vi.fn()

    await consumeBrainStream(
      streamResponse(
        'event: run_completed\n',
        'data: {"plan_id":"plan-1","seq":4}',
      ),
      { onNamed, onInline, onClose },
    )

    expect(onNamed).toHaveBeenCalledWith('run_completed', { plan_id: 'plan-1', seq: 4 })
    expect(onInline).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('accepts CR-only SSE delimiters and dispatches inline events', async () => {
    const onNamed = vi.fn()
    const onInline = vi.fn()

    await consumeBrainStream(
      streamResponse('data: {"type":"done","finish_reason":"stop"}\r\r'),
      { onNamed, onInline },
    )

    expect(onNamed).not.toHaveBeenCalled()
    expect(onInline).toHaveBeenCalledWith({ type: 'done', finish_reason: 'stop' })
  })

  it('normalizes native AG-UI content and completion events for the Brain reducer', async () => {
    const onNamed = vi.fn()
    const onInline = vi.fn()

    await consumeBrainStream(
      streamResponse(
        'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"Hello"}\n\n',
        'data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":{"usage":{"total_tokens":3}}}\n\n',
      ),
      { onNamed, onInline },
    )

    expect(onNamed).not.toHaveBeenCalled()
    expect(onInline).toHaveBeenNthCalledWith(1, { type: 'content', content: 'Hello' })
    expect(onInline).toHaveBeenNthCalledWith(2, {
      type: 'done',
      finish_reason: 'stop',
      usage: { total_tokens: 3 },
    })
  })
})

describe('parseBrainContextEvent', () => {
  it('keeps only the four user-facing context kinds', () => {
    const parsed = parseBrainContextEvent({
      persona: { persona_id: 'persona-1', name: 'Researcher', image_url: '/persona.png' },
      pins: [{ pin_id: 'pin-1', title: 'Launch brief', tags: ['work'] }],
      files: [{ name: 'summary.pdf', mime_type: 'application/pdf', size: 128 }],
      connectors: [{
        slug: 'gmail',
        display_name: 'Gmail',
        status: 'connected',
        auth_mode: 'oauth2',
        tool_count: 12,
        logo_url: '/gmail.svg',
      }],
      user_context: { email: 'private@example.com' },
      available_models: [{ id: 'model-1' }],
    })

    expect(parsed).toEqual({
      persona: {
        persona_id: 'persona-1',
        name: 'Researcher',
        image_url: '/persona.png',
        avatar_url: '/persona.png',
      },
      pins: [{ pin_id: 'pin-1', title: 'Launch brief', tags: ['work'] }],
      files: [{ name: 'summary.pdf', mime_type: 'application/pdf', size: 128 }],
      connectors: [{
        slug: 'gmail',
        display_name: 'Gmail',
        status: 'connected',
        logo_url: '/gmail.svg',
      }],
    })
  })

  it('drops connector tool rows while preserving valid context rows', () => {
    const parsed = parseBrainContextEvent({
      pins: [{ pin_id: 'pin-1', title: 'Keep me' }],
      connectors: [
        { slug: 'get', display_name: 'Get', status: 'connected' },
        { slug: 'list', display_name: 'List', status: 'connected' },
        { slug: 'search', display_name: 'Search', status: 'connected' },
        {
          slug: 'notion',
          display_name: 'Notion',
          status: 'connected',
          auth_mode: 'oauth2',
          tool_count: 8,
        },
      ],
    })

    expect(parsed.pins).toEqual([{ pin_id: 'pin-1', title: 'Keep me' }])
    expect(parsed.connectors).toEqual([{
      slug: 'notion',
      display_name: 'Notion',
      status: 'connected',
    }])
  })

  it('isolates malformed rows instead of discarding the whole event', () => {
    const parsed = parseBrainContextEvent({
      persona: 'not-an-object',
      pins: [null, { pin_id: '', title: 'Invalid' }],
      files: [{ name: 'valid.txt' }, { name: '' }],
      connectors: 'not-an-array',
    })

    expect(parsed).toEqual({
      persona: null,
      pins: [],
      files: [{ name: 'valid.txt' }],
      connectors: [],
    })
  })
})
