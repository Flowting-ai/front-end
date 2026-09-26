"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { getChatMessages } from "@/lib/api/chat"
import { toUIMessages } from "@/lib/normalizers/message-transformer"
import { logger } from "@/lib/logger"
import { getStreamCompletion, consumeInterruptedStreamMarker } from "@/lib/stream-registry"
import { stopActiveActivities } from "@/lib/activity"
import type { UIMessage } from "@/types/chat"

// ── Hook result ───────────────────────────────────────────────────────────────

export interface UseChatStateResult {
  messages: UIMessage[]
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  isLoadingMessages: boolean
  hasMoreMessages: boolean
  loadMoreMessages: () => Promise<void>
  /** Inserts an optimistic user message and returns its temp ID. */
  addOptimisticUserMessage: (content: string, files?: File[], mentionedPins?: Array<{ id: string; label: string }>) => string
  /** Inserts an empty loading assistant message and returns its temp ID. */
  addLoadingAssistantMessage: () => string
  /** Removes the last `n` messages (for rollback on error). */
  rollbackLast: (n: number) => void
  clearMessages: () => void
  /** Mark a chat ID as optimistically created (prevents fetch-and-clear on navigate). */
  markChatAsOptimistic: (id: string) => void
  /** Re-fetch the current chat's messages from the API without clearing chatId state.
   *  Used after recovering from a dropped stream connection, and as the retry
   *  action when `messagesLoadError` is set. */
  refreshMessages: () => Promise<void>
  /** Set when the initial message-history fetch for the current chat failed.
   *  `messages` is left as whatever it was before the failed fetch (not
   *  cleared), so the UI can show existing content plus a retry affordance
   *  instead of an unexplained empty thread. Cleared on the next successful
   *  load, initial or retried. */
  messagesLoadError: string | null
}

// ── Reload-interrupted stream recovery ───────────────────────────────────────

/**
 * If a stream for `chatId` was still running when this tab last saw it (see
 * stream-registry.ts — this is only true right after a reload/crash mid-
 * generation), reinterpret the freshly-loaded history so the interrupted turn
 * reads as "Generation stopped" instead of silently looking finished or, if
 * the backend hadn't persisted anything yet, disappearing outright.
 */
function markInterruptedIfNeeded(chatId: string, msgs: UIMessage[]): UIMessage[] {
  if (!consumeInterruptedStreamMarker(chatId)) return msgs

  const last = msgs[msgs.length - 1]
  if (last && last.role === "assistant") {
    return msgs.map((m, i) =>
      i === msgs.length - 1
        ? {
            ...m,
            isLoading: false,
            stoppedByUser: true,
            content: m.content || "Generation stopped.",
            activities: stopActiveActivities(m.activities),
          }
        : m,
    )
  }

  const placeholder: UIMessage = {
    id: `interrupted-${Date.now()}`,
    role: "assistant",
    content: "Generation stopped.",
    created_at: new Date().toISOString(),
    chat_id: chatId,
    isLoading: false,
    stoppedByUser: true,
  }
  return [...msgs, placeholder]
}

// ── Implementation ────────────────────────────────────────────────────────────

export interface UseChatStateOptions {
  /**
   * Override the default message fetcher. When provided, called instead of
   * getChatMessages so persona/brain surfaces can supply their own loader
   * without needing a separate state hook. The returned messages must already
   * be in UIMessage form (fully normalised). Pagination is disabled when this
   * override is active.
   */
  loadMessages?: (chatId: string) => Promise<UIMessage[]>
}

export function useChatState(chatId: string | undefined, options?: UseChatStateOptions): UseChatStateResult {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  // Set when the initial message-history fetch for the current chatId fails.
  // Cleared on the next successful load (initial or retried). Lets the UI
  // show a retry affordance instead of a silently-empty thread — a failed
  // fetch here previously just toasted and left `messages` as the `[]` it
  // was eagerly cleared to before the fetch started, which reads as "this
  // conversation's history is gone" rather than "a refresh failed."
  const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null)
  const cursorRef = useRef<string | undefined>(undefined)
  const loadingRef = useRef(false)
  // Track chat IDs that were created optimistically during streaming -
  // we must NOT clear messages when navigating to these since the streaming
  // hook is still actively writing to the message list.
  const optimisticChatIdsRef = useRef<Set<string>>(new Set())
  // Only clear messages when navigating AWAY from a real chat to a new one.
  // Without this, React 18 StrictMode's double-invocation clears optimistic
  // messages on the simulated remount before they can be re-added.
  const hasPreviousChatRef = useRef(false)

  // Load messages whenever chatId changes
  useEffect(() => {
    if (!chatId) {
      if (hasPreviousChatRef.current) {
        setMessages([])
      }
      setHasMoreMessages(false)
      cursorRef.current = undefined
      setMessagesLoadError(null)
      return
    }

    hasPreviousChatRef.current = true
    setMessagesLoadError(null)

    // If this chatId was just created during an active stream, skip the
    // fetch-and-clear cycle - the stream is still writing messages.
    if (optimisticChatIdsRef.current.has(chatId)) {
      optimisticChatIdsRef.current.delete(chatId)
      return
    }

    // If a background stream is still running for this chat (the user navigated
    // away while it was generating), wait for it to finish before reloading
    // from the API so the complete response is always shown.
    const pendingStream = getStreamCompletion(chatId)
    if (pendingStream) {
      let cancelled = false
      loadingRef.current = true
      setIsLoadingMessages(true)
      setMessages([])
      cursorRef.current = undefined

      // Cap the wait at 90 s so a hung stream never blocks the UI indefinitely.
      const streamTimeout = new Promise<void>((resolve) => setTimeout(resolve, 90_000))
      void Promise.race([pendingStream, streamTimeout]).then(async () => {
        if (cancelled) return
        try {
          if (options?.loadMessages) {
            const msgs = await options.loadMessages(chatId)
            if (!cancelled) {
              setMessages(markInterruptedIfNeeded(chatId, msgs))
              setHasMoreMessages(false)
            }
          } else {
            const res = await getChatMessages(chatId)
            if (!cancelled) {
              setMessages(markInterruptedIfNeeded(chatId, toUIMessages(res.messages)))
              setHasMoreMessages(res.has_more)
              cursorRef.current = res.next_cursor ?? undefined
            }
          }
        } catch (err) {
          logger.error("[useChatState] Failed to reload after background stream", err)
          const message = err instanceof Error ? err.message : "Failed to load messages"
          toast.error(message)
          if (!cancelled) setMessagesLoadError(message)
        } finally {
          if (!cancelled) setIsLoadingMessages(false)
          loadingRef.current = false
        }
      })

      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    loadingRef.current = true
    setIsLoadingMessages(true)
    setMessages([])
    cursorRef.current = undefined

    const fetch = options?.loadMessages
      ? options.loadMessages(chatId).then((msgs) => {
          // Custom loader returns UIMessage[] directly; no pagination.
          if (!cancelled) {
            setMessages(markInterruptedIfNeeded(chatId, msgs))
            setHasMoreMessages(false)
          }
        })
      : getChatMessages(chatId).then((res) => {
          if (cancelled) return
          setMessages(markInterruptedIfNeeded(chatId, toUIMessages(res.messages)))
          setHasMoreMessages(res.has_more)
          cursorRef.current = res.next_cursor ?? undefined
        })

    fetch
      .catch((err) => {
        logger.error("[useChatState] Failed to load messages", err)
        const message = err instanceof Error ? err.message : "Failed to load messages"
        toast.error(message)
        if (!cancelled) setMessagesLoadError(message)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false)
        loadingRef.current = false
      })

    return () => {
      cancelled = true
    }
  }, [chatId])

  // ── Pagination ─────────────────────────────────────────────────────────────

  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingRef.current || !hasMoreMessages) return
    loadingRef.current = true
    try {
      const res = await getChatMessages(chatId, cursorRef.current)
      setMessages((prev) => [...toUIMessages(res.messages), ...prev])
      setHasMoreMessages(res.has_more)
      cursorRef.current = res.next_cursor ?? undefined
    } catch (err) {
      logger.error("[useChatState] Failed to load more messages", err)
      toast.error(err instanceof Error ? err.message : "Failed to load more messages")
    } finally {
      loadingRef.current = false
    }
  }, [chatId, hasMoreMessages])

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const addOptimisticUserMessage = useCallback((content: string, files?: File[], mentionedPins?: Array<{ id: string; label: string }>): string => {
    const id = `optimistic-user-${Date.now()}`
    const msg: UIMessage = {
      id,
      reactKey: id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      chat_id: chatId ?? "",
      attachments: files && files.length > 0
        ? files.map((f, i) => ({
            id:              `opt-att-${i}-${Date.now()}`,
            file_name:       f.name,
            file_type:       f.type || "application/octet-stream",
            file_size:       f.size,
            uploading:       true,
            uploadProgress:  0,
          }))
        : undefined,
      mentionedPins: mentionedPins && mentionedPins.length > 0 ? mentionedPins : undefined,
    }
    setMessages((prev) => [...prev, msg])
    return id
  }, [chatId])

  const addLoadingAssistantMessage = useCallback((): string => {
    const id = `loading-assistant-${Date.now()}`
    const msg: UIMessage = {
      id,
      reactKey: id,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      chat_id: chatId ?? "",
      isLoading: true,
    }
    setMessages((prev) => [...prev, msg])
    return id
  }, [chatId])

  const rollbackLast = useCallback((n: number) => {
    setMessages((prev) => prev.slice(0, prev.length - n))
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  /** Mark a chat ID as optimistically created (prevents fetch-on-navigate). */
  const markChatAsOptimistic = useCallback((id: string) => {
    optimisticChatIdsRef.current.add(id)
  }, [])

  /** Re-fetch the current chat's messages from the API (e.g. after recovering
   *  from a dropped background-stream connection). */
  const refreshMessages = useCallback(async () => {
    if (!chatId || loadingRef.current) return
    loadingRef.current = true
    setIsLoadingMessages(true)
    try {
      if (options?.loadMessages) {
        const msgs = await options.loadMessages(chatId)
        setMessages(markInterruptedIfNeeded(chatId, msgs))
        setHasMoreMessages(false)
      } else {
        const res = await getChatMessages(chatId)
        setMessages(markInterruptedIfNeeded(chatId, toUIMessages(res.messages)))
        setHasMoreMessages(res.has_more)
        cursorRef.current = res.next_cursor ?? undefined
      }
      setMessagesLoadError(null)
    } catch (err) {
      logger.error("[useChatState] Failed to refresh messages", err)
      const message = err instanceof Error ? err.message : "Failed to refresh messages"
      toast.error(message)
      setMessagesLoadError(message)
    } finally {
      setIsLoadingMessages(false)
      loadingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- options is stable for each hook consumer
  }, [chatId])

  return {
    messages,
    setMessages,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    addOptimisticUserMessage,
    addLoadingAssistantMessage,
    rollbackLast,
    clearMessages,
    markChatAsOptimistic,
    refreshMessages,
    messagesLoadError,
  }
}
