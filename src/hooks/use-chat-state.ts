"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getChatMessages } from "@/lib/api/chat"
import { toUIMessages } from "@/lib/normalizers/message-transformer"
import { logger } from "@/lib/logger"
import type { Message } from "@/types/chat"

// ── UIMessage ─────────────────────────────────────────────────────────────────

// ── Connector SSE prompt payloads ─────────────────────────────────────────────

/** Emitted when the LLM tries to use a connector that is not yet linked. */
export interface ConnectorConnectPrompt {
  /** Unique request ID from the backend (for deduplication). */
  request_id:    string
  connector_slug: string
  display_name:  string
  auth_mode:     'oauth2' | 'api_key'
  tool_name:     string
  /** Optional icon URL for the connector. */
  icon_url?:     string
}

/** Emitted when the LLM tries to call a connector tool whose policy is "ask". */
export interface ConnectorPermissionPrompt {
  /** Unique request ID from the backend (for deduplication). */
  request_id:     string
  connector_slug: string
  display_name:   string
  tool_name:      string
  suggested_args?: Record<string, unknown>
  /** Optional icon URL for the connector. */
  icon_url?:      string
}

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
  /** Structured response blocks (table, chart, code, callout, etc.). */
  responseBlocks?: ResponseBlock[]
  /** Web citation sources for inline {1} {2} chips in response text. */
  webCitations?: WebCitation[]
  /** Connector "connect" prompts emitted mid-stream when a tool needs linking. */
  connectorConnectPrompts?: ConnectorConnectPrompt[]
  /** Connector "permission" prompts emitted mid-stream when a tool policy is "ask". */
  connectorPermissionPrompts?: ConnectorPermissionPrompt[]
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
  | 'doc-execute'
  | 'docx-progress'
  | 'skills'
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
  /** Human-readable label from backend (e.g. "Generating PDF", "Searching the web"). */
  label?: string
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

// ── Structured output types (response blocks) ─────────────────────────────────

/** A web citation source for inline {1}{2} reference chips (distinct from Message.citations). */
export interface WebCitation {
  title: string
  url?: string
  domain?: string
}

export interface TableBadgeStyle { label: string; color: string; bg: string; border?: string }

export type TableCellValue =
  | string
  | number
  | { type: 'badge';  label: string; color: string; bg: string; border?: string }
  | { type: 'check';  value: boolean }
  | { type: 'rich';   text: string; sub?: string; badge?: TableBadgeStyle }

export interface TableData {
  caption?: string
  headers: string[]
  rows: TableCellValue[][]
  variant?: 'basic' | 'striped' | 'compact' | 'badges' | 'financial' | 'hoverable' | 'minimal' | 'feature-comparison' | 'mixed-content'
  sortable?: boolean
  totalsRow?: boolean
  accentRows?: number[]
  badgeMap?: Record<string, { color: string; bg: string; border?: string }>
}

export interface BarChartData {
  title?: string
  unit?: string
  bars: { label: string; value: number; color?: string }[]
  maxValue?: number
  variant?: 'vertical' | 'horizontal' | 'grouped' | 'stacked' | 'stacked-100' | 'positive-negative'
  datasets?: { label: string; color?: string; values: number[] }[]
  labels?: string[]
}

export interface StepsData {
  title?: string
  steps: { label: string; description?: string }[]
}

export interface CodeData {
  language: string
  code: string
  caption?: string
}

export interface CalloutData {
  variant: 'info' | 'warning' | 'success' | 'error' | 'tip'
  title?: string
  body: string
}

export interface TagsData {
  title?: string
  tags: { label: string; color?: string }[]
}

export interface FollowUpsData {
  prompts: string[]
}

export interface PieChartData {
  title?: string
  unit?: string
  centerLabel?: string
  segments: { label: string; value: number; color?: string }[]
}

export interface LineChartData {
  title?: string
  unit?: string
  xLabel?: string
  yLabel?: string
  lines: { label: string; color?: string; points: { x: string; y: number }[] }[]
}

export interface CardData {
  title?: string
  subtitle?: string
  body: string
  badge?: string
  badgeColor?: string
}

export interface ConnectorErrorData {
  connector: string
  icon?: string
  message: string
  cta: string
}

export interface SearchTimeoutData {
  query: string
  message: string
  cta: string
}

/** Discriminated union of all structured response block types. */
export type ResponseBlock =
  | { kind: 'text';            content: string; webCitations?: WebCitation[] }
  | { kind: 'table';           data: TableData }
  | { kind: 'bar-chart';       data: BarChartData }
  | { kind: 'steps';           data: StepsData }
  | { kind: 'code';            data: CodeData }
  | { kind: 'callout';         data: CalloutData }
  | { kind: 'tags';            data: TagsData }
  | { kind: 'follow-ups';      data: FollowUpsData }
  | { kind: 'pie-chart';       data: PieChartData }
  | { kind: 'line-chart';      data: LineChartData }
  | { kind: 'card';            data: CardData }
  | { kind: 'connector-error'; data: ConnectorErrorData }
  | { kind: 'search-timeout';  data: SearchTimeoutData }

// ── Hook result ───────────────────────────────────────────────────────────────

export interface UseChatStateResult {
  messages: UIMessage[]
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  isLoadingMessages: boolean
  hasMoreMessages: boolean
  loadMoreMessages: () => Promise<void>
  /** Inserts an optimistic user message and returns its temp ID. */
  addOptimisticUserMessage: (content: string, files?: File[]) => string
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
  // Track chat IDs that were created optimistically during streaming -
  // we must NOT clear messages when navigating to these since the streaming
  // hook is still actively writing to the message list.
  const optimisticChatIdsRef = useRef<Set<string>>(new Set())
  // Only clear messages when navigating AWAY from a real chat to a new one.
  // Without this, React 18 StrictMode's double-invocation clears optimistic
  // messages on the simulated remount before they can be re-added.
  const hasPreviousChatRef = useRef(false)

  // Load messages whenever chatId changes
  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!chatId) {
      if (hasPreviousChatRef.current) {
        setMessages([])
      }
      setHasMoreMessages(false)
      cursorRef.current = undefined
      return
    }

    hasPreviousChatRef.current = true

    // If this chatId was just created during an active stream, skip the
    // fetch-and-clear cycle - the stream is still writing messages.
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
        setMessages(toUIMessages(res.messages))
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
      setMessages((prev) => [...toUIMessages(res.messages), ...prev])
      setHasMoreMessages(res.has_more)
      cursorRef.current = res.next_cursor ?? undefined
    } catch (err) {
      logger.error("[useChatState] Failed to load more messages", err)
    } finally {
      loadingRef.current = false
    }
  }, [chatId, hasMoreMessages])

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const addOptimisticUserMessage = useCallback((content: string, files?: File[]): string => {
    const id = `optimistic-user-${Date.now()}`
    const msg: UIMessage = {
      id,
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
