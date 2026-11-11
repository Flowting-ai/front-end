import type { UIMessage } from "@/types/chat"

/**
 * In-flight stream content, kept outside React state.
 *
 * While a reply streams, use-streaming-chat publishes the not-yet-committed
 * fields of the streaming message (content, thinking, reasoning sections…)
 * here instead of calling setMessages per token. Only the row rendering that
 * message subscribes (useLiveMessage), so the composer, chips, virtualizer and
 * every other message stay still. The hook commits the fields into `messages`
 * once at the turn's milestones (tool events, end, stop, error) and clears the
 * entry.
 *
 * Writes are coalesced to one notification per animation frame per key.
 * Entries are keyed by message id, which is unique per stream, so several
 * chats streaming at once never see each other's content.
 */

export type StreamFields = Partial<UIMessage>
type Listener = () => void

const visible = new Map<string, StreamFields>()
const pending = new Map<string, StreamFields>()
const listeners = new Map<string, Set<Listener>>()
let frameHandle: number | ReturnType<typeof setTimeout> | null = null
let frameIsRaf = false

function notify(key: string) {
  const set = listeners.get(key)
  if (!set) return
  for (const listener of [...set]) listener()
}

function flushFrame() {
  frameHandle = null
  const keys = [...pending.keys()]
  for (const key of keys) {
    visible.set(key, pending.get(key)!)
    pending.delete(key)
  }
  for (const key of keys) notify(key)
}

function scheduleFrame() {
  if (frameHandle !== null) return
  if (typeof requestAnimationFrame === "function") {
    frameIsRaf = true
    frameHandle = requestAnimationFrame(flushFrame)
  } else {
    frameIsRaf = false
    frameHandle = setTimeout(flushFrame, 16)
  }
}

function cancelFrame() {
  if (frameHandle === null) return
  if (frameIsRaf) cancelAnimationFrame(frameHandle as number)
  else clearTimeout(frameHandle as ReturnType<typeof setTimeout>)
  frameHandle = null
}

/** Replace the uncommitted fields for `key`; subscribers hear about it on the next frame. */
export function publishStreamFields(key: string, fields: StreamFields): void {
  pending.set(key, fields)
  scheduleFrame()
}

/** Drop `key`'s entry (after its fields were committed into messages). Notifies synchronously. */
export function clearStreamFields(key: string): void {
  const hadVisible = visible.delete(key)
  const hadPending = pending.delete(key)
  const had = hadVisible || hadPending
  if (pending.size === 0) cancelFrame()
  if (had) notify(key)
}

/** The fields subscribers should render for `key` (stable reference between frames). */
export function getStreamFields(key: string): StreamFields | undefined {
  return visible.get(key)
}

export function subscribeStreamFields(key: string, listener: Listener): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    const current = listeners.get(key)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) listeners.delete(key)
  }
}

/** Publish pending writes now instead of waiting for the frame (tests, teardown). */
export function flushStreamStore(): void {
  cancelFrame()
  flushFrame()
}

/** Test helper: forget everything. */
export function resetStreamStore(): void {
  cancelFrame()
  visible.clear()
  pending.clear()
  listeners.clear()
}
