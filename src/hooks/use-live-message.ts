"use client"

import { useSyncExternalStore } from "react"
import { getStreamFields, subscribeStreamFields } from "@/lib/chat/stream-store"
import type { UIMessage } from "@/types/chat"

const noFields = () => undefined

/**
 * The message with its in-flight stream fields (lib/chat/stream-store) laid
 * over it. Only the row of the message that is streaming changes per frame;
 * every other row reads `undefined` and returns its message untouched.
 */
export function useLiveMessage(message: UIMessage): UIMessage {
  const id = message.id
  const fields = useSyncExternalStore(
    (listener) => subscribeStreamFields(id, listener),
    () => getStreamFields(id),
    noFields,
  )
  return fields ? { ...message, ...fields } : message
}
