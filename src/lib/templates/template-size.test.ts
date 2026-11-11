import { describe, expect, it, vi } from 'vitest'
import { capStream, declaredTooLarge } from './template-view'

const streamOf = (...chunks: number[]) => new ReadableStream<Uint8Array>({
  start(c) { for (const n of chunks) c.enqueue(new Uint8Array(n)); c.close() },
})

describe('template size cap', () => {
  it('rejects a declared oversize body, passes a missing or valid header', () => {
    expect(declaredTooLarge('11', 10)).toBe(true)
    expect(declaredTooLarge('10', 10)).toBe(false)
    expect(declaredTooLarge(null, 10)).toBe(false)
    expect(declaredTooLarge('abc', 10)).toBe(false)
  })

  it('streams bodies under the cap unchanged', async () => {
    const text = await new Response(capStream(streamOf(4, 4), 10)).arrayBuffer()
    expect(text.byteLength).toBe(8)
  })

  it('fails the stream once the cap is passed and reports it', async () => {
    const onExceeded = vi.fn()
    await expect(new Response(capStream(streamOf(6, 6), 10, onExceeded)).arrayBuffer()).rejects.toThrow()
    expect(onExceeded).toHaveBeenCalledTimes(1)
  })
})
