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
 */

interface StreamEntry {
  promise: Promise<void>
  resolve: () => void
}

// Singleton — one entry per chatId that is currently streaming.
const registry = new Map<string, StreamEntry>()

/**
 * Register a new background stream for `chatId`.
 * No-op if chatId is null, a temp- ID, or already registered.
 */
export function registerStream(chatId: string | null): void {
  if (!chatId || chatId.startsWith("temp-") || registry.has(chatId)) return
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  registry.set(chatId, { promise, resolve })
  markInFlight(chatId)
}

/**
 * Mark the stream for `chatId` as complete.
 * Resolves the stored promise and removes the entry.
 * Safe to call multiple times (subsequent calls are no-ops).
 */
export function completeStream(chatId: string | null): void {
  if (!chatId) return
  const entry = registry.get(chatId)
  if (entry) {
    entry.resolve()
    registry.delete(chatId)
  }
  clearInFlight(chatId)
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
