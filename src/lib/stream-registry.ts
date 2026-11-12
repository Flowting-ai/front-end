"use client"

/**
 * Module-level stream registry.
 *
 * Tracks active SSE streams keyed by chatId. This module lives at the browser
 * tab level (not tied to any React component), so it survives component
 * remounts when the user navigates between chats.
 *
 * Use-cases:
 *  1. useChatState can await a pending stream before reloading from the API
 *     when the user switches back to a chat that is still streaming in the
 *     background — ensuring the complete response is always shown.
 *  2. useStreamingChat can skip setStreamState calls for streams that no
 *     longer match the currently displayed chat.
 *  3. The message queue learns when (and how) a chat's reply ended, so a
 *     queued message goes out after it even while the user is elsewhere —
 *     see message-queue.ts.
 */

/** How a chat's stream ended: the reply finished, failed, or was stopped. */
export type StreamOutcome = "done" | "error" | "aborted"

export type StreamEvent =
  | { type: "start"; chatId: string }
  | { type: "end"; chatId: string; outcome: StreamOutcome }

interface StreamEntry {
  promise: Promise<void>
  resolve: () => void
  /** Stops this stream from anywhere — e.g. a chat the user came back to
   *  while its reply was still running in the background. */
  stop?: () => void
  /** Drops this view's connection and leaves the turn running on the backend,
   *  so it can be read again from the turn's stream. Set once the run has started. */
  detach?: () => void
}

// Singleton — one entry per chatId that is currently streaming.
const registry = new Map<string, StreamEntry>()

const listeners = new Set<(event: StreamEvent) => void>()

function emit(event: StreamEvent): void {
  // Copied first: a listener may (un)subscribe or start another stream.
  for (const listener of [...listeners]) listener(event)
}

/** Called with every stream start and end. Returns an unsubscribe. */
export function subscribeStreams(listener: (event: StreamEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Register a new background stream for `chatId`.
 * No-op if chatId is null or a temp- ID. If the chat is already registered,
 * only `stop` and `detach` are attached (a stream reserved ahead of its request).
 */
export function registerStream(chatId: string | null, stop?: () => void, detach?: () => void): void {
  if (!chatId || chatId.startsWith("temp-")) return
  const existing = registry.get(chatId)
  if (existing) {
    if (stop) existing.stop = stop
    if (detach) existing.detach = detach
    return
  }
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  registry.set(chatId, { promise, resolve, stop, detach })
  emit({ type: "start", chatId })
}

/**
 * Mark the stream for `chatId` as complete.
 * Resolves the stored promise and removes the entry.
 * Safe to call multiple times (subsequent calls are no-ops).
 */
export function completeStream(chatId: string | null, outcome: StreamOutcome = "done"): void {
  if (!chatId) return
  const entry = registry.get(chatId)
  if (entry) {
    entry.resolve()
    registry.delete(chatId)
  }
  if (entry) emit({ type: "end", chatId, outcome })
}

/** Stops the active stream for `chatId`, wherever it was started. Returns
 *  false when there is none, or it can't be stopped from here. */
export function stopStream(chatId: string): boolean {
  const stop = registry.get(chatId)?.stop
  if (!stop) return false
  stop()
  return true
}

/**
 * Drops the connection reading `chatId`'s turn without ending the turn, so the
 * chat can follow it afresh from the turn's stream. No end is announced: the
 * turn is still running. Returns false when there is nothing to drop yet (no
 * stream, or its run has not started).
 */
export function detachStream(chatId: string): boolean {
  const entry = registry.get(chatId)
  if (!entry?.detach) return false
  entry.detach()
  entry.resolve()
  registry.delete(chatId)
  return true
}

/**
 * Returns a Promise that resolves when the stream for `chatId` completes,
 * or null if no active stream is registered for that chatId.
 */
export function getStreamCompletion(chatId: string): Promise<void> | null {
  return registry.get(chatId)?.promise ?? null
}

/** Returns true if there is an active (unresolved) stream for `chatId`. */
export function isStreamActive(chatId: string): boolean {
  return registry.has(chatId)
}

/**
 * Resolves once `chatId` has no active stream — including one that starts
 * the moment another ends (a queued message sent right after the reply it
 * was waiting on). Each stream is waited on for at most `capMs`, so a hung
 * one never blocks the caller indefinitely.
 */
export async function waitForChatStreams(chatId: string, capMs: number): Promise<void> {
  let pending = getStreamCompletion(chatId)
  while (pending) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const capped = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), capMs)
    })
    const result = await Promise.race([pending.then(() => "done" as const), capped])
    clearTimeout(timer)
    if (result === "timeout") return
    pending = getStreamCompletion(chatId)
  }
}
