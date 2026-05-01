"use client"

import { useState, useEffect, useRef } from "react"
import { getChatMessages } from "@/lib/api/chat"
import { logger } from "@/lib/logger"
import type { Message } from "@/types/chat"

// ── UIMessage ─────────────────────────────────────────────────────────────────

/** Extends the API Message with transient streaming-only UI state. */
export interface UIMessage extends Message {
  /** True while the assistant is generating a response for this message. */
  isLoading?: boolean
  /** True while a <think> block is still open (streaming). */
  isThinkingInProgress?: boolean
  /** True when the user clicked Stop during generation. */
  stoppedByUser?: boolean
}

// ── Hook result ───────────────────────────────────────────────────────────────

export interface UseChatStateResult {
  messages: UIMessage[]
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  isLoadingMessages: boolean
  hasMoreMessages: boolean
  loadMoreMessages: () => Promise<void>
  /** Inserts an optimistic user message and returns its temp ID. */
  addOptimisticUserMessage: (content: string) => string
  /** Inserts an empty loading assistant message and returns its temp ID. */
  addLoadingAssistantMessage: () => string
  /** Removes the last `n` messages (for rollback on error). */
  rollbackLast: (n: number) => void
  clearMessages: () => void
}

// ── Implementation ────────────────────────────────────────────────────────────

export function useChatState(chatId: string | undefined): UseChatStateResult {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const cursorRef = useRef<string | undefined>(undefined)
  const loadingRef = useRef(false)

  // Load messages whenever chatId changes
  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setHasMoreMessages(false)
      cursorRef.current = undefined
      return
    }

    let cancelled = false
    loadingRef.current = true
    setIsLoadingMessages(true)
    setMessages([])
    cursorRef.current = undefined

    getChatMessages(chatId)
      .then((res) => {
        if (cancelled) return
        setMessages(res.messages)
        setHasMoreMessages(res.has_more)
        cursorRef.current = res.next_cursor ?? undefined
      })
      .catch((err) => {
        logger.error("[useChatState] Failed to load messages", err)
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

  const loadMoreMessages = async () => {
    if (!chatId || loadingRef.current || !hasMoreMessages) return
    loadingRef.current = true
    try {
      const res = await getChatMessages(chatId, cursorRef.current)
      setMessages((prev) => [...res.messages, ...prev])
      setHasMoreMessages(res.has_more)
      cursorRef.current = res.next_cursor ?? undefined
    } catch (err) {
      logger.error("[useChatState] Failed to load more messages", err)
    } finally {
      loadingRef.current = false
    }
  }

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const addOptimisticUserMessage = (content: string): string => {
    const id = `optimistic-user-${Date.now()}`
    const msg: UIMessage = {
      id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      chat_id: chatId ?? "",
    }
    setMessages((prev) => [...prev, msg])
    return id
  }

  const addLoadingAssistantMessage = (): string => {
    const id = `loading-assistant-${Date.now()}`
    const msg: UIMessage = {
      id,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      chat_id: chatId ?? "",
      isLoading: true,
    }
    setMessages((prev) => [...prev, msg])
    return id
  }

  const rollbackLast = (n: number) => {
    setMessages((prev) => prev.slice(0, prev.length - n))
  }

  const clearMessages = () => setMessages([])

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
  }
}
