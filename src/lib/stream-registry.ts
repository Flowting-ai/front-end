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
