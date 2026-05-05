"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  /** Model name reported by backend during streaming. */
  modelName?: string
  /** Model metadata from model_selected event. */
  modelMeta?: ModelSelectedMeta
  /** Activities performed during response generation (tool uses, web search, etc.) */
  activities?: ActivityItem[]
  /** Generated images (inline from LLM or named event). */
  images?: GeneratedImage[]
  /** Generated files (documents, CSVs, etc.). */
  generatedFiles?: GeneratedFile[]
}

/** Model selection metadata from the backend. */
export interface ModelSelectedMeta {
  modelId: string
  modelName: string
  deploymentName?: string
  company?: string
  complexity?: string
  thinkingEnabled?: boolean
  effort?: string
}

/** Activity types matching backend tool names. */
export type ActivityType =
  | 'web-search'
  | 'read-pages'
  | 'csv-execute'
  | 'fetch-resource'
  | 'tool-call'
  | 'docx-progress'
  | 'other'

/** Status values for tool progress. */
export type ActivityStatus = 'start' | 'executing' | 'reading' | 'done' | 'error'

/** A single activity (tool use) performed by the AI during response generation. */
export interface ActivityItem {
  /** Unique ID for this activity (tool_call_id or generated). */
  id: string
  /** Type of activity. */
  type: ActivityType
  /** Tool name as reported by backend. */
  toolName?: string
  /** Human-readable detail text. */
  detail?: string
  /** Current status. */
  status: ActivityStatus
  /** Search results or links. */
  results?: { title: string; url?: string; domain?: string }[]
  /** Duration in seconds (from tool_complete). */
  durationS?: number
  /** Progress message from tool_progress. */
  progressMessage?: string
  /** Code preview from tool_progress (csv_execute, docx). */
  codePreview?: string
  /** Filename associated with the tool (read_pages, csv, docx). */
  filename?: string
}

/** An image generated during the response. */
export interface GeneratedImage {
  url: string
  s3Key?: string
}

/** A file generated during the response. */
export interface GeneratedFile {
  url: string
  s3Key?: string
  filename: string
  mimeType?: string
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
  /** Mark a chat ID as optimistically created (prevents fetch-and-clear on navigate). */
  markChatAsOptimistic: (id: string) => void
}

// ── Implementation ────────────────────────────────────────────────────────────

export function useChatState(chatId: string | undefined): UseChatStateResult {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const cursorRef = useRef<string | undefined>(undefined)
  const loadingRef = useRef(false)
  // Track chat IDs that were created optimistically during streaming —
  // we must NOT clear messages when navigating to these since the streaming
  // hook is still actively writing to the message list.
  const optimisticChatIdsRef = useRef<Set<string>>(new Set())

  // Load messages whenever chatId changes
  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setHasMoreMessages(false)
      cursorRef.current = undefined
      return
    }

    // If this chatId was just created during an active stream, skip the
    // fetch-and-clear cycle — the stream is still writing messages.
    if (optimisticChatIdsRef.current.has(chatId)) {
      optimisticChatIdsRef.current.delete(chatId)
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

  const loadMoreMessages = useCallback(async () => {
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
  }, [chatId, hasMoreMessages])

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const addOptimisticUserMessage = useCallback((content: string): string => {
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
  }, [chatId])

  const addLoadingAssistantMessage = useCallback((): string => {
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
  }, [chatId])

  const rollbackLast = useCallback((n: number) => {
    setMessages((prev) => prev.slice(0, prev.length - n))
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  /** Mark a chat ID as optimistically created (prevents fetch-on-navigate). */
  const markChatAsOptimistic = useCallback((id: string) => {
    optimisticChatIdsRef.current.add(id)
  }, [])

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
  }
}
