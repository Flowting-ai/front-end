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
 * only `stop` is attached (a stream reserved ahead of its request).
 */
export function registerStream(chatId: string | null, stop?: () => void): void {
  if (!chatId || chatId.startsWith("temp-")) return
  const existing = registry.get(chatId)
  if (existing) {
    if (stop) existing.stop = stop
    return
  }
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  registry.set(chatId, { promise, resolve, stop })
  markInFlight(chatId)
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
  clearInFlight(chatId)
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

// ── Reload-survival marker ───────────────────────────────────────────────────
//
// The in-memory `registry` above is wiped by a full page reload, so it can't
// tell "this chat's stream was cut off by a reload" apart from "this chat has
// no stream." sessionStorage survives a reload within the same tab (it's only
// cleared when the tab/window closes), so it's used here as a one-shot marker:
// set the moment a stream starts, cleared the moment it ends normally (done,
// error, or user-initiated stop — every exit path already calls
// completeStream). If the marker is still present when a chat's history is
// next loaded, the previous page died mid-stream — used to show "Generation
// stopped" instead of the response silently vanishing.

const INFLIGHT_KEY_PREFIX = "kaya:stream-inflight:"

function inflightKey(chatId: string): string {
  return `${INFLIGHT_KEY_PREFIX}${chatId}`
}

function markInFlight(chatId: string): void {
  try {
    sessionStorage.setItem(inflightKey(chatId), "1")
  } catch {
    // Storage unavailable (private browsing, quota) — best effort only.
  }
}

function clearInFlight(chatId: string): void {
  try {
    sessionStorage.removeItem(inflightKey(chatId))
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/**
 * One-shot check: true if `chatId` had a stream registered that never
 * completed (page reloaded/crashed before `completeStream` ran). Consumes the
 * marker, so it only returns true once per interruption.
 */
export function consumeInterruptedStreamMarker(chatId: string): boolean {
  try {
    const found = sessionStorage.getItem(inflightKey(chatId)) !== null
    if (found) sessionStorage.removeItem(inflightKey(chatId))
    return found
  } catch {
    return false
  }
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
