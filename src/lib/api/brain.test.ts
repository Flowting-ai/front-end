import { describe, expect, it, vi } from 'vitest'
import { consumeBrainStream } from '@/lib/api/brain'

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
