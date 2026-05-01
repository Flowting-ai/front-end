"use client"

import { useRef } from "react"
import { extractThinkingContent } from "@/lib/parsers/content-parser"
import { mergeStreamingText } from "@/lib/streaming"
import { friendlyApiError } from "@/lib/api/client"
import { apiFetch } from "@/lib/api/client"
import { CHAT_STOP_ENDPOINT } from "@/lib/config"
import { logger } from "@/lib/logger"
import type { UIMessage } from "@/hooks/use-chat-state"

// ── Types ─────────────────────────────────────────────────────────────────────

export type StreamState = "idle" | "waiting" | "streaming" | "done" | "aborted" | "error"

export interface UseStreamingChatParams {
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>
  /** Called with the real chat ID once the backend creates a new chat. */
  onChatCreated?: (chatId: string) => void
  /** Called when the backend sends a chat title update. */
  onTitleUpdate?: (chatId: string, title: string) => void
  /** Called when the stream finishes so the sidebar can re-order the chat. */
  onChatMoveToTop?: (chatId: string) => void
  /** Optional — lets the caller render a loading indicator from stream state. */
  setStreamState?: React.Dispatch<React.SetStateAction<StreamState>>
}

// ── Batch-flush interval ──────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 50

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStreamingChat({
  setMessages,
  onChatCreated,
  onTitleUpdate,
  onChatMoveToTop,
  setStreamState,
}: UseStreamingChatParams) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const stopRequestedRef = useRef(false)

  // Pending message field updates — flushed to React every FLUSH_INTERVAL_MS
  const pendingFieldsRef = useRef<Partial<UIMessage> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The temp ID of the loading placeholder being updated during a stream
  const loadingMessageIdRef = useRef<string | null>(null)
  // Resolved chat ID (may start as null/temp and update once backend confirms)
  const resolvedChatIdRef = useRef<string | null>(null)

  // ── Flush helpers ───────────────────────────────────────────────────────────

  const applyUpdate = (fields: Partial<UIMessage>) => {
    const msgId = loadingMessageIdRef.current
    if (!msgId) return
    setMessages((prev) =>
      prev.map((msg) => (msg.id === msgId ? { ...msg, ...fields } : msg)),
    )
  }

  const flushPending = () => {
    if (!pendingFieldsRef.current) return
    const fields = pendingFieldsRef.current
    pendingFieldsRef.current = null
    applyUpdate(fields)
  }

  const queueUpdate = (fields: Partial<UIMessage>, immediate = false) => {
    pendingFieldsRef.current = pendingFieldsRef.current
      ? { ...pendingFieldsRef.current, ...fields }
      : fields
    if (immediate) {
      flushPending()
      return
    }
  }

  const startFlushInterval = () => {
    if (flushTimerRef.current) return
    flushTimerRef.current = setInterval(flushPending, FLUSH_INTERVAL_MS)
  }

  const stopFlushInterval = () => {
    if (!flushTimerRef.current) return
    clearInterval(flushTimerRef.current)
    flushTimerRef.current = null
  }

  // ── handleStopGeneration ────────────────────────────────────────────────────

  const handleStopGeneration = () => {
    stopRequestedRef.current = true
    abortControllerRef.current?.abort()
    stopFlushInterval()
    flushPending()
    setStreamState?.("aborted")

    const msgId = loadingMessageIdRef.current
    if (msgId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId && msg.isLoading
            ? {
                ...msg,
                isLoading: false,
                isThinkingInProgress: false,
                stoppedByUser: true,
                content: msg.content || "Generation stopped.",
              }
            : msg,
        ),
      )
    }

    // Signal the backend to stop generation
    const chatId = resolvedChatIdRef.current
    if (chatId && !chatId.startsWith("temp-")) {
      void apiFetch(CHAT_STOP_ENDPOINT(chatId), { method: "POST" }).catch(() => {})
    }
  }

  // ── fetchAiResponse ─────────────────────────────────────────────────────────

  /**
   * Opens an SSE stream to the /api/chat proxy route and applies incoming
   * events to the loading placeholder message identified by `loadingMessageId`.
   *
   * The function is NOT memoised — re-creating it every render ensures it
   * always closes over the freshest callbacks without ref gymnastics.
   * It is only ever called from event handlers, so identity changes are safe.
   */
  const fetchAiResponse = async (
    input: string,
    chatId: string | null,
    loadingMessageId: string,
    modelId?: string | number | null,
  ): Promise<void> => {
    stopRequestedRef.current = false
    const controller = new AbortController()
    abortControllerRef.current = controller
    loadingMessageIdRef.current = loadingMessageId
    resolvedChatIdRef.current = chatId

    setStreamState?.("waiting")

    let assistantContent = ""
    let reasoningContent = ""
    let streamFinished = false
    let shouldStopReading = false

    try {
      // ── POST to Next.js proxy ─────────────────────────────────────────────

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          input,
          ...(modelId !== null && modelId !== undefined ? { modelId } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "")
        throw new Error(
          friendlyApiError(text || `Request failed with status ${response.status}`, response.status),
        )
      }

      // Adopt a real chat ID from the response header (new chats only)
      const headerChatId =
        response.headers.get("X-Chat-Id") ?? response.headers.get("x-chat-id")
      if (headerChatId && (!chatId || chatId.startsWith("temp-"))) {
        resolvedChatIdRef.current = headerChatId
        onChatCreated?.(headerChatId)
      }

      setStreamState?.("streaming")
      startFlushInterval()

      // ── SSE read loop ─────────────────────────────────────────────────────

      const decoder = new TextDecoder()
      const reader = response.body.getReader()
      let buffer = ""

      const processChunk = (chunk: Uint8Array) => {
        buffer += decoder.decode(chunk, { stream: true })

        // SSE events separated by \n\n; some backends use \n before "event:"
        const rawChunks = buffer.split("\n\n")
        buffer = rawChunks.pop() ?? ""

        const events: string[] = []
        for (const raw of rawChunks) {
          for (const part of raw.split(/\n(?=event:)/)) events.push(part)
        }

        for (const eventStr of events) {
          const lines = eventStr.split("\n")
          let eventName = ""
          let dataStr = ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              const inlineData = line.indexOf("data:", 6)
              if (inlineData !== -1) {
                eventName = line.slice(6, inlineData).trim()
                dataStr += line.slice(inlineData + 5).trim()
              } else {
                eventName = line.slice(6).trim()
              }
            } else if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim()
            }
          }

          if (!dataStr) continue

          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(dataStr)
          } catch {
            logger.warn("[useStreamingChat] Failed to parse SSE data", dataStr)
            continue
          }

          // Normalise backends that emit `type` on the JSON object instead of
          // the SSE `event:` field
          if (!eventName && parsed.type) {
            const t = String(parsed.type)
            if (t === "content") {
              eventName = "chunk"
              if (typeof parsed.content === "string" && !("delta" in parsed)) {
                parsed = { ...parsed, delta: parsed.content }
              }
            } else {
              eventName = t
            }
          }
          if (
            eventName === "content" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content }
            eventName = "chunk"
          }
          if (
            eventName === "reasoning" &&
            typeof parsed.content === "string" &&
            !("delta" in parsed)
          ) {
            parsed = { ...parsed, delta: parsed.content }
          }

          // ── Event handlers ──────────────────────────────────────────────────

          if (eventName === "metadata" || eventName === "title") {
            const evtChatId = extractChatId(parsed)
            if (evtChatId) adoptChatId(evtChatId)
            const title = asString(parsed.title ?? parsed.chat_title)
            if (title && resolvedChatIdRef.current) {
              onTitleUpdate?.(resolvedChatIdRef.current, title)
            }
            continue
          }

          if (eventName === "reasoning") {
            const delta = asString(parsed.delta) ?? ""
            reasoningContent = mergeStreamingText(reasoningContent, delta)
            queueUpdate({
              thinking: reasoningContent,
              isThinkingInProgress: true,
              isLoading: false,
            })
            continue
          }

          if (eventName === "chunk") {
            const delta = asString(parsed.delta) ?? ""
            assistantContent = mergeStreamingText(assistantContent, delta)
            const { visibleText, thinkingText } = extractThinkingContent(assistantContent)
            const hasOpenThink = /<think>/i.test(assistantContent)
            const hasCloseThink = /<\/think>/i.test(assistantContent)
            const stillThinking = hasOpenThink && !hasCloseThink
            queueUpdate({
              content: visibleText || "",
              thinking: reasoningContent || thinkingText || undefined,
              isThinkingInProgress: stillThinking && !reasoningContent,
              isLoading: false,
            })
            continue
          }

          if (eventName === "message_saved") {
            // Backend confirmed the message was persisted — track but don't
            // change the optimistic ID (reconciliation happens on next load)
            continue
          }

          if (eventName === "done") {
            const finalText =
              typeof parsed.response === "string" ? parsed.response : assistantContent
            const { visibleText, thinkingText } = extractThinkingContent(
              finalText || assistantContent || "",
            )
            const finalReasoning = reasoningContent || thinkingText

            const doneChatId = extractChatId(parsed)
            if (doneChatId) adoptChatId(doneChatId)

            const doneTitle = asString(parsed.title ?? parsed.chat_title)
            if (doneTitle && resolvedChatIdRef.current) {
              onTitleUpdate?.(resolvedChatIdRef.current, doneTitle)
            }
            if (resolvedChatIdRef.current) {
              onChatMoveToTop?.(resolvedChatIdRef.current)
            }

            flushPending()
            queueUpdate(
              {
                content:
                  visibleText || (finalReasoning ? "" : "API didn't respond"),
                thinking: finalReasoning || undefined,
                isThinkingInProgress: false,
                isLoading: false,
                stoppedByUser: false,
              },
              true,
            )

            streamFinished = true
            continue
          }

          if (eventName === "error") {
            const rawError =
              typeof parsed.error === "string"
                ? parsed.error
                : "Unexpected error from model"
            const lower = rawError.toLowerCase()

            flushPending()

            if (
              lower.includes("token expired") ||
              lower.includes("not authenticated") ||
              lower.includes("unauthorized")
            ) {
              queueUpdate(
                {
                  content: "Your session has expired. Signing you out…",
                  isLoading: false,
                },
                true,
              )
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("auth:session-expired"))
              }
            } else {
              queueUpdate(
                {
                  content: friendlyApiError(rawError),
                  isThinkingInProgress: false,
                  isLoading: false,
                },
                true,
              )
            }

            streamFinished = true
            shouldStopReading = true
            continue
          }
        }
      }

      // ── Main read loop ────────────────────────────────────────────────────

      while (true) {
        const { value, done } = await reader.read()
        if (value) processChunk(value)
        if (done || shouldStopReading) break
      }

      // Flush any partial event left in the buffer
      if (buffer.trim()) {
        buffer += "\n\n"
        processChunk(new Uint8Array(0))
      }

      reader.cancel().catch(() => {})
      stopFlushInterval()
      flushPending()

      // Stream ended without a done or error event — treat accumulated content
      // as the complete response
      if (!streamFinished) {
        if (assistantContent) {
          const { visibleText, thinkingText } = extractThinkingContent(assistantContent)
          const finalReasoning = reasoningContent || thinkingText
          queueUpdate(
            {
              content: visibleText || assistantContent,
              thinking: finalReasoning || undefined,
              isThinkingInProgress: false,
              isLoading: false,
            },
            true,
          )
        } else {
          queueUpdate(
            { content: "Generation interrupted. Please retry.", isLoading: false },
            true,
          )
        }
      }

      setStreamState?.("done")
    } catch (error) {
      stopFlushInterval()
      flushPending()

      // User-initiated stop — not an error
      if (stopRequestedRef.current) {
        setStreamState?.("aborted")
        return
      }

      logger.error("[useStreamingChat] Error", error)

      const rawMsg =
        error instanceof Error ? error.message : "Failed to connect to AI service"
      const lower = rawMsg.toLowerCase()

      if (
        lower.includes("token expired") ||
        lower.includes("not authenticated") ||
        lower.includes("unauthorized") ||
        lower.includes("401")
      ) {
        setStreamState?.("error")
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("auth:session-expired"))
        }
        return
      }

      setStreamState?.("error")
      queueUpdate(
        {
          content: friendlyApiError(rawMsg),
          isThinkingInProgress: false,
          isLoading: false,
        },
        true,
      )
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const adoptChatId = (chatId: string) => {
    if (resolvedChatIdRef.current === chatId) return
    if (resolvedChatIdRef.current && !resolvedChatIdRef.current.startsWith("temp-")) return
    resolvedChatIdRef.current = chatId
    onChatCreated?.(chatId)
  }

  return { fetchAiResponse, handleStopGeneration }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function extractChatId(parsed: Record<string, unknown>): string | null {
  const raw = parsed.chat_id ?? parsed.chatId ?? null
  if (raw === null || raw === undefined) return null
  const resolved = String(raw).trim()
  return resolved.length > 0 ? resolved : null
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}
