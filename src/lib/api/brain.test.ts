import { describe, expect, it, vi } from 'vitest'
import {
  consumeBrainStream,
  parseBrainContextEvent,
  parseBrainToolActivity,
  parseModelSelectedEvent,
  parsePlanNodes,
} from '@/lib/api/brain'

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

describe('Brain activity event parsing', () => {
  it('validates and normalizes the selected model event', () => {
    expect(parseModelSelectedEvent({
      model_id: 'model-1',
      model_name: 'Claude Sonnet 4.5',
      company: 'Anthropic',
      thinking_enabled: true,
      ignored_private_field: 'not forwarded',
    })).toEqual({
      modelId: 'model-1',
      modelName: 'Claude Sonnet 4.5',
      deploymentName: undefined,
      company: 'Anthropic',
      complexity: undefined,
      thinkingEnabled: true,
      effort: undefined,
    })

    expect(parseModelSelectedEvent({ model_id: 'missing-name' })).toBeNull()
  })

  it('normalizes connector tool arguments and lifecycle metadata', () => {
    expect(parseBrainToolActivity({
      type: 'tool_complete',
      label: 'Reading Gmail',
      tool_call: {
        tool_call_id: 'call-1',
        name: 'run_connector_tool',
        arguments: '{"tool_slug":"GMAIL_FETCH_EMAILS","arguments":{"query":"private"}}',
        result: '{"messages":["private body"]}',
        duration_s: 1.25,
      },
    })).toEqual({
      key: 'call-1',
      status: 'complete',
      label: 'Reading Gmail',
      tool_call: {
        tool_call_id: 'call-1',
        name: 'run_connector_tool',
        arguments: {
          tool_slug: 'GMAIL_FETCH_EMAILS',
          arguments: { query: 'private' },
        },
        result: '{"messages":["private body"]}',
        duration_s: 1.25,
      },
    })
  })

  it('rejects malformed tool lifecycle events', () => {
    expect(parseBrainToolActivity({ type: 'tool_complete', tool_call: null })).toBeNull()
    expect(parseBrainToolActivity({ type: 'content', content: 'hello' })).toBeNull()
  })
})

describe('parsePlanNodes', () => {
  it('parses the unified node shape and defaults context', () => {
    const [node] = parsePlanNodes([{
      id: 's1',
      task: 'Pull last 90 days of orders\nfull line items',
      model_id: '55555555-5555-5555-5555-555555555555',
      context: { connectors: ['shopify'] },
      is_critical: true,
      status: 'running',
    }])
    expect(node.id).toBe('s1')
    expect(node.model_id).toBe('55555555-5555-5555-5555-555555555555')
    expect(node.context?.connectors).toEqual(['shopify'])
    expect(node.is_critical).toBe(true)
  })

  it('drops rows missing the load-bearing id, keeps valid ones', () => {
    const nodes = parsePlanNodes([
      { task: 'no id' },
      { id: 's2', task: 'ok' },
    ])
    expect(nodes.map((n) => n.id)).toEqual(['s2'])
  })

  it('returns [] for non-array input', () => {
    expect(parsePlanNodes(undefined)).toEqual([])
    expect(parsePlanNodes(null)).toEqual([])
  })
})

describe('consumeBrainStream AG-UI (real dev stream)', () => {
  it('routes RUN_STARTED, CUSTOM(plan_proposed), and RUN_FINISHED', async () => {
    const onNamed = vi.fn()
    const onInline = vi.fn()
    const onRunStarted = vi.fn()

    const planValue = {
      plan_id: 'e7dfd883-03c2-4fe7-91f0-0205fc19a769',
      summary: 'Stress-test plan',
      steps: [
        { id: 'shopify_read', task: 'READ-ONLY: pull Shopify data',
          persona_id: null, model_id: '0a5df8ae-71f9-47e5-927e-f841d29e1e84',
          context: { connectors: [], pins: [], files: [] },
          is_critical: false, status: 'pending' },
        { id: 'synthesis', task: 'Synthesize the 8 sources',
          persona_id: null, model_id: '0a5df8ae-71f9-47e5-927e-f841d29e1e84',
          context: { connectors: [], pins: [], files: [] },
          is_critical: false, status: 'pending' },
      ],
      edges: [{ from: 'shopify_read', to: 'synthesis' }],
      required_connectors: [],
    }

    await consumeBrainStream(
      streamResponse(
        'data: {"type":"RUN_STARTED","threadId":"c939312b-fe05-42ae-90ee-c36dbf8b1cfc","runId":"da6644c7"}\n\n',
        'data: {"type":"CUSTOM","name":"title","value":{"title":"Complex Read-Only Integration Plan"}}\n\n',
        'data: {"type":"CUSTOM","name":"stream_heartbeat","value":{"elapsed_seconds":5.0}}\n\n',
        `data: ${JSON.stringify({ type: 'CUSTOM', name: 'plan_proposed', value: planValue })}\n\n`,
        'data: {"type":"RUN_FINISHED","threadId":"c939312b","runId":"da6644c7","result":{"usage":{"total_tokens":118954}}}\n\n',
      ),
      { onNamed, onInline, onRunStarted },
    )

    expect(onRunStarted).toHaveBeenCalledWith('c939312b-fe05-42ae-90ee-c36dbf8b1cfc', 'da6644c7')
    expect(onNamed).toHaveBeenCalledWith('title', { title: 'Complex Read-Only Integration Plan' })
    expect(onNamed).toHaveBeenCalledWith('plan_proposed', planValue)
    expect(onInline).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', finish_reason: 'stop' }),
    )

    // The plan_proposed value parses into two well-formed nodes.
    const emitted = onNamed.mock.calls.find(([name]) => name === 'plan_proposed')![1]
    const nodes = parsePlanNodes((emitted as { steps: unknown }).steps)
    expect(nodes.map((n) => n.id)).toEqual(['shopify_read', 'synthesis'])
    expect(nodes[0].model_id).toBe('0a5df8ae-71f9-47e5-927e-f841d29e1e84')
  })
})
