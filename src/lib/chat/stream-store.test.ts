import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearStreamFields,
  flushStreamStore,
  getStreamFields,
  publishStreamFields,
  resetStreamStore,
  subscribeStreamFields,
} from "./stream-store"

beforeEach(() => {
  vi.useFakeTimers()
  resetStreamStore()
})

afterEach(() => {
  resetStreamStore()
  vi.useRealTimers()
})

describe("stream-store", () => {
  it("coalesces writes to one notification per frame", () => {
    const listener = vi.fn()
    subscribeStreamFields("m1", listener)
    for (let i = 0; i < 20; i++) publishStreamFields("m1", { content: `t${i}` })
    expect(listener).not.toHaveBeenCalled()
    expect(getStreamFields("m1")).toBeUndefined()
    vi.advanceTimersByTime(20)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getStreamFields("m1")).toEqual({ content: "t19" })
  })

  it("keeps a stable snapshot between frames", () => {
    publishStreamFields("m1", { content: "a" })
    flushStreamStore()
    const first = getStreamFields("m1")
    expect(getStreamFields("m1")).toBe(first)
  })

  it("isolates keys", () => {
    const a = vi.fn()
    const b = vi.fn()
    subscribeStreamFields("chat-a-msg", a)
    subscribeStreamFields("chat-b-msg", b)
    publishStreamFields("chat-a-msg", { content: "A" })
    flushStreamStore()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    expect(getStreamFields("chat-b-msg")).toBeUndefined()
    clearStreamFields("chat-b-msg")
    expect(getStreamFields("chat-a-msg")).toEqual({ content: "A" })
  })

  it("clears committed entries synchronously, including unflushed writes", () => {
    const listener = vi.fn()
    subscribeStreamFields("m1", listener)
    publishStreamFields("m1", { content: "a" })
    flushStreamStore()
    publishStreamFields("m1", { content: "ab" })
    clearStreamFields("m1")
    expect(listener).toHaveBeenCalledTimes(2)
    expect(getStreamFields("m1")).toBeUndefined()
    vi.advanceTimersByTime(20)
    expect(getStreamFields("m1")).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn()
    const off = subscribeStreamFields("m1", listener)
    off()
    publishStreamFields("m1", { content: "a" })
    flushStreamStore()
    expect(listener).not.toHaveBeenCalled()
  })
})
