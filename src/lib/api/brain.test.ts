import { describe, expect, it, vi } from 'vitest'
import { consumeBrainStream, parseBrainContextEvent } from '@/lib/api/brain'
import { validateCustomEvent } from '@/lib/api/sse-schemas'

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
  it('dispatches a CUSTOM rally event when the stream closes without a trailing blank line', async () => {
    const onEvent = vi.fn()
    const onClose = vi.fn()

    await consumeBrainStream(
      streamResponse(
        'data: {"type":"CUSTOM","name":"agent_started","value":',
        '{"agent":"Researcher","handle":"researcher","task":"Find sources"}}',
      ),
      { onEvent, onClose },
    )

    expect(onEvent).toHaveBeenCalledWith('agent_started', {
      agent: 'Researcher',
      handle: 'researcher',
      task: 'Find sources',
    }, true)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('accepts CR-only SSE delimiters and dispatches AG-UI lifecycle', async () => {
    const onEvent = vi.fn()

    await consumeBrainStream(
      streamResponse('data: {"type":"RUN_FINISHED","threadId":"t","runId":"r"}\r\r'),
      { onEvent },
    )

    expect(onEvent).toHaveBeenCalledWith('done', {
      finish_reason: 'stop',
      usage: undefined,
    }, false)
  })

  it('normalizes native AG-UI content and completion events for the Brain reducer', async () => {
    const onEvent = vi.fn()

    await consumeBrainStream(
      streamResponse(
        'data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m1","delta":"Hello"}\n\n',
        'data: {"type":"RUN_FINISHED","threadId":"t1","runId":"r1","result":{"usage":{"total_tokens":3}}}\n\n',
      ),
      { onEvent },
    )

    expect(onEvent).toHaveBeenNthCalledWith(1, 'content', { content: 'Hello' }, false)
    expect(onEvent).toHaveBeenNthCalledWith(2, 'done', {
      finish_reason: 'stop',
      usage: { total_tokens: 3 },
    }, false)
  })

  it('validates the backend question_prompt event without dropping its questions', () => {
    expect(validateCustomEvent('question_prompt', {
      prompt_id: 'prompt-1',
      respond_url: '/chats/prompts/prompt-1',
      questions: [{ id: 'q1', question: 'Which source?', type: 'text' }],
    })).toEqual({
      prompt_id: 'prompt-1',
      respond_url: '/chats/prompts/prompt-1',
      expires_at: '',
      title: '',
      description: '',
      questions: [{ id: 'q1', question: 'Which source?', type: 'text' }],
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
