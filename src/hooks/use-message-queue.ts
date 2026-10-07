"use client"

import { useSyncExternalStore } from "react"
import { getChatQueue, subscribeQueue, type ChatQueue } from "@/lib/message-queue"
import { isStreamActive, subscribeStreams } from "@/lib/stream-registry"

/** The messages queued in `key`'s chat, kept current — see message-queue.ts. */
export function useChatQueue(key: string): ChatQueue | undefined {
  return useSyncExternalStore(subscribeQueue, () => getChatQueue(key), () => undefined)
}

/**
 * Whether `chatId` has a reply streaming right now — including one started
 * elsewhere (before the user switched away and back, or a queued message sent
 * in the background).
 */
export function useChatStreamActive(chatId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeStreams,
    () => !!chatId && isStreamActive(chatId),
    () => false,
  )
}
