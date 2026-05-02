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
  const rafScheduledRef = useRef(false)

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
    // Schedule a microtask flush as backup (in case setInterval is delayed)
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true
      Promise.resolve().then(() => {
        rafScheduledRef.current = false
        flushPending()
      })
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
            // Plain text token (not JSON) — treat as content chunk
            // The backend sends `data: <token>` for LLM content
            const wasEmpty = !assistantContent
            assistantContent = mergeStreamingText(assistantContent, dataStr)
            const { visibleText, thinkingText } = extractThinkingContent(assistantContent)
            const hasOpenThink = /<think>/i.test(assistantContent)
            const hasCloseThink = /<\/think>/i.test(assistantContent)
            const stillThinking = hasOpenThink && !hasCloseThink
            queueUpdate({
              content: visibleText || "",
              thinking: reasoningContent || thinkingText || undefined,
              isThinkingInProgress: stillThinking && !reasoningContent,
              isLoading: false,
            }, wasEmpty)
            setStreamState?.("streaming")
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
            const wasEmpty = !reasoningContent
            reasoningContent = mergeStreamingText(reasoningContent, delta)
            queueUpdate({
              thinking: reasoningContent,
              isThinkingInProgress: true,
              isLoading: false,
            }, wasEmpty)  // flush immediately on first reasoning chunk
            continue
          }

          if (eventName === "chunk") {
            const delta = asString(parsed.delta) ?? ""
            const wasEmpty = !assistantContent
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
            }, wasEmpty)  // flush immediately on first content chunk
            continue
          }

          if (eventName === "message_saved") {
            // Backend confirmed the message was persisted
            // For new chats, the chat_id may come here
            const evtChatId = extractChatId(parsed)
            if (evtChatId) adoptChatId(evtChatId)
            continue
          }

          if (eventName === "model_selected") {
            // Backend selected a model — update the loading message with model info
            const modelName = asString(parsed.model_name) ?? asString(parsed.modelName)
            if (modelName) {
              queueUpdate({
                modelName,
                modelMeta: {
                  modelId: asString(parsed.model_id) ?? "",
                  modelName: modelName,
                  deploymentName: asString(parsed.deployment_name),
                  company: asString(parsed.company),
                  complexity: asString(parsed.complexity),
                  thinkingEnabled: parsed.thinking_enabled === true,
                  effort: asString(parsed.effort),
                },
              }, true)
            }
            continue
          }

          if (eventName === "web_search") {
            // Web search activity — schema: {query, links[]}
            const query = asString(parsed.query) ?? ""
            const rawLinks = Array.isArray(parsed.links) ? parsed.links : []
            const results = rawLinks
              .slice(0, 6)
              .map((link: unknown) => {
                if (typeof link === "string") {
                  try {
                    const url = new URL(link)
                    return { title: url.hostname + url.pathname.slice(0, 40), url: link, domain: url.hostname }
                  } catch { return { title: link, url: link, domain: "" } }
                }
                if (typeof link === "object" && link !== null) {
                  const obj = link as Record<string, unknown>
                  const url = asString(obj.url) ?? ""
                  let domain = ""
                  try { domain = new URL(url).hostname } catch { /* ignore */ }
                  return {
                    title: asString(obj.title) ?? url,
                    url,
                    domain: asString(obj.domain) ?? domain,
                  }
                }
                return null
              })
              .filter(Boolean) as { title: string; url?: string; domain?: string }[]

            const activity: import("@/hooks/use-chat-state").ActivityItem = {
              id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "web-search",
              detail: query,
              status: "done",
              results,
            }

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === msgId
                    ? { ...msg, activities: [...(msg.activities ?? []), activity] }
                    : msg,
                ),
              )
            }
            continue
          }

          if (eventName === "tool_progress") {
            // Tool progress — schema: {tool, status, filename?, step?, message?, code_preview?}
            const toolName = asString(parsed.tool) ?? "unknown"
            const status = asString(parsed.status) ?? "start"
            const filename = asString(parsed.filename)
            const progressMessage = asString(parsed.message)
            const codePreview = asString(parsed.code_preview)
            const activityId = `tp-${toolName}-${filename ?? "default"}`

            const activityType = toolNameToType(toolName)

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  const existing = (msg.activities ?? []).find((a) => a.id === activityId)
                  if (existing) {
                    // Update existing activity
                    return {
                      ...msg,
                      activities: (msg.activities ?? []).map((a) =>
                        a.id === activityId
                          ? { ...a, status: status as import("@/hooks/use-chat-state").ActivityStatus, progressMessage, codePreview }
                          : a,
                      ),
                    }
                  }
                  // Create new activity
                  const newActivity: import("@/hooks/use-chat-state").ActivityItem = {
                    id: activityId,
                    type: activityType,
                    toolName,
                    detail: progressMessage || filename || toolName,
                    status: status as import("@/hooks/use-chat-state").ActivityStatus,
                    filename,
                    progressMessage,
                    codePreview,
                  }
                  return { ...msg, activities: [...(msg.activities ?? []), newActivity] }
                }),
              )
            }
            continue
          }

          if (eventName === "tool_executing" || parsed.type === "tool_executing") {
            // Tool is about to execute — schema: {content (tool name), tool_call: {name, arguments, ...}}
            const toolCall = parsed.tool_call as Record<string, unknown> | undefined
            const toolName = asString(toolCall?.name) ?? asString(parsed.content) ?? "tool"
            const toolCallId = asString(toolCall?.tool_call_id) ?? `te-${Date.now()}`

            const activityType = toolNameToType(toolName)
            const detail = toolName.replace(/_/g, " ")

            const activity: import("@/hooks/use-chat-state").ActivityItem = {
              id: toolCallId,
              type: activityType,
              toolName,
              detail,
              status: "executing",
            }

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === msgId
                    ? { ...msg, activities: [...(msg.activities ?? []), activity] }
                    : msg,
                ),
              )
            }
            continue
          }

          if (eventName === "tool_complete" || parsed.type === "tool_complete") {
            // Tool finished — schema: {content (tool name), tool_call: {name, tool_call_id, result, duration_s}}
            const toolCall = parsed.tool_call as Record<string, unknown> | undefined
            const toolCallId = asString(toolCall?.tool_call_id)
            const durationS = typeof toolCall?.duration_s === "number" ? toolCall.duration_s : undefined

            if (toolCallId) {
              const msgId = loadingMessageIdRef.current
              if (msgId) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== msgId) return msg
                    return {
                      ...msg,
                      activities: (msg.activities ?? []).map((a) =>
                        a.id === toolCallId
                          ? { ...a, status: "done" as const, durationS }
                          : a,
                      ),
                    }
                  }),
                )
              }
            }
            continue
          }

          if (eventName === "image" || parsed.type === "image") {
            // Image event — either inline from LLM ({images: string[]}) or named ({url, s3_key})
            const msgId = loadingMessageIdRef.current
            if (msgId) {
              if (Array.isArray(parsed.images)) {
                const newImages = (parsed.images as string[]).map((url) => ({ url }))
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === msgId
                      ? { ...msg, images: [...(msg.images ?? []), ...newImages] }
                      : msg,
                  ),
                )
              } else if (parsed.url) {
                const img = { url: asString(parsed.url) ?? "", s3Key: asString(parsed.s3_key) }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === msgId
                      ? { ...msg, images: [...(msg.images ?? []), img] }
                      : msg,
                  ),
                )
              }
            }
            continue
          }

          if (eventName === "generated_file") {
            // Generated file — schema: {url, s3_key, filename, mime_type}
            const msgId = loadingMessageIdRef.current
            if (msgId) {
              const file = {
                url: asString(parsed.url) ?? "",
                s3Key: asString(parsed.s3_key),
                filename: asString(parsed.filename) ?? "file",
                mimeType: asString(parsed.mime_type),
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === msgId
                    ? { ...msg, generatedFiles: [...(msg.generatedFiles ?? []), file] }
                    : msg,
                ),
              )
            }
            continue
          }

          if (eventName === "docx_progress") {
            // Document generation progress — schema: {step, message, filename, code_preview?}
            const step = asString(parsed.step) ?? "start"
            const filename = asString(parsed.filename) ?? "document"
            const progressMessage = asString(parsed.message) ?? ""
            const activityId = `docx-${filename}`

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  const existing = (msg.activities ?? []).find((a) => a.id === activityId)
                  const status: import("@/hooks/use-chat-state").ActivityStatus =
                    step === "done" ? "done" : step === "error" ? "error" : "executing"
                  if (existing) {
                    return {
                      ...msg,
                      activities: (msg.activities ?? []).map((a) =>
                        a.id === activityId
                          ? { ...a, status, detail: progressMessage || a.detail, progressMessage, codePreview: asString(parsed.code_preview) }
                          : a,
                      ),
                    }
                  }
                  const newActivity: import("@/hooks/use-chat-state").ActivityItem = {
                    id: activityId,
                    type: "docx-progress",
                    toolName: "docx",
                    detail: progressMessage || `Generating ${filename}`,
                    status,
                    filename,
                    progressMessage,
                    codePreview: asString(parsed.code_preview),
                  }
                  return { ...msg, activities: [...(msg.activities ?? []), newActivity] }
                }),
              )
            }
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

/** Maps backend tool names to our ActivityType for display purposes. */
function toolNameToType(toolName: string): import("@/hooks/use-chat-state").ActivityType {
  const lower = toolName.toLowerCase()
  if (lower.includes("web_search") || lower.includes("search")) return "web-search"
  if (lower.includes("read_pages") || lower.includes("read_pdf")) return "read-pages"
  if (lower.includes("csv") || lower.includes("data")) return "csv-execute"
  if (lower.includes("fetch")) return "fetch-resource"
  if (lower.includes("docx") || lower.includes("document")) return "docx-progress"
  return "tool-call"
}
