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
  /** Optional - lets the caller render a loading indicator from stream state. */
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
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const stopRequestedRef = useRef(false)

  // Pending message field updates - flushed to React every FLUSH_INTERVAL_MS
  const pendingFieldsRef = useRef<Partial<UIMessage> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafScheduledRef = useRef(false)

  // The temp ID of the loading placeholder being updated during a stream
  const loadingMessageIdRef = useRef<string | null>(null)
  // Tracks the optimistic user message ID so message_saved can update its attachment URLs
  const userMessageIdRef = useRef<string | null>(null)
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
    xhrRef.current?.abort()
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

    // Signal the backend to stop generation. Persona-overlay chats live on the
    // regular /chats endpoint, so the regular stop endpoint applies.
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
   * The function is NOT memoised - re-creating it every render ensures it
   * always closes over the freshest callbacks without ref gymnastics.
   * It is only ever called from event handlers, so identity changes are safe.
   */
  const fetchAiResponse = async (
    input: string,
    chatId: string | null,
    loadingMessageId: string,
    modelId?: string | number | null,
    options?: { webSearch?: boolean; files?: File[]; enableReasoning?: boolean; algorithm?: 'base' | 'pro' | null; userMessageId?: string; pinIds?: string[]; onUploadProgress?: (pct: number) => void; personaId?: string; systemPrompt?: string; temperature?: number; toneId?: string },
  ): Promise<void> => {
    stopRequestedRef.current = false
    xhrRef.current = null
    loadingMessageIdRef.current = loadingMessageId
    userMessageIdRef.current = options?.userMessageId ?? null
    resolvedChatIdRef.current = chatId

    setStreamState?.("waiting")

    let assistantContent = ""
    let reasoningContent = ""
    // Accumulated structured reasoning sections from heading/body SSE events
    const reasoningSectionsAcc: Array<{ heading: string; body: string }> = []
    let currentReasHeading = ""
    let currentReasBody = ""
    // Returns a snapshot of all sections including the in-progress one
    const snapshotSections = (): Array<{ heading: string; body: string }> => {
      const out = [...reasoningSectionsAcc]
      if (currentReasHeading) out.push({ heading: currentReasHeading, body: currentReasBody })
      return out
    }
    let streamFinished = false
    let shouldStopReading = false
    let titleWasSet = false    // guards: prevent `done` from overwriting a title already set by the `title` SSE event
    let receivedImages = false  // true when at least one image event was received this stream
    // Maps toolName → activityId so tool_progress events can find the activity
    // created by the preceding tool_executing event.
    const toolCallIdByName = new Map<string, string>()

    try {
      // ── POST to Next.js proxy ─────────────────────────────────────────────

      const fd = new FormData()
      fd.append("input", input)
      if (chatId) fd.append("chatId", chatId)
      if (modelId !== null && modelId !== undefined) fd.append("modelId", String(modelId))
      if (options?.algorithm) fd.append("algorithm", options.algorithm)
      if (options?.webSearch) fd.append("webSearch", "true")
      if (options?.enableReasoning) fd.append("enable_thinking", "true")
      if (options?.pinIds && options.pinIds.length > 0) fd.append("pinIds", JSON.stringify(options.pinIds))
      if (options?.personaId) fd.append("personaId", options.personaId)
      if (options?.systemPrompt) fd.append("systemPrompt", options.systemPrompt)
      if (options?.temperature != null) fd.append("temperature", String(options.temperature))
      if (options?.toneId) fd.append("toneId", options.toneId)
      options?.files?.forEach((f) => fd.append("files", f))

      let buffer = ""

      // ── SSE processor ─────────────────────────────────────────────────────
      // Called with each new text slice arriving from the XHR response stream.

      const processSSEText = (text: string) => {
        buffer += text

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
                const inlineRaw = line.slice(inlineData + 5)
                dataStr += inlineRaw.startsWith(" ") ? inlineRaw.slice(1) : inlineRaw
              } else {
                eventName = line.slice(6).trim()
              }
            } else if (line.startsWith("data:")) {
              // Per SSE spec: strip exactly one leading space (the protocol separator), preserve all other whitespace
              const raw = line.slice(5)
              dataStr += raw.startsWith(" ") ? raw.slice(1) : raw
            }
          }

          if (!dataStr) continue

          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(dataStr)
          } catch {
            // Plain text token (not JSON) - treat as content chunk
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
              isLoading: true,
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

          // ── Universal file_attachments extractor ──────────────────────────
          // Run before any specific handler so file links are captured
          // regardless of which SSE event the backend places them in.
          {
            const universalMsgId = loadingMessageIdRef.current
            const universalAtts = Array.isArray(parsed.file_attachments)
              ? (parsed.file_attachments as Array<Record<string, unknown>>)
              : Array.isArray(
                  (parsed.message as Record<string, unknown> | undefined)
                    ?.file_attachments,
                )
              ? (
                  (parsed.message as Record<string, unknown>)
                    .file_attachments as Array<Record<string, unknown>>
                )
              : null

            if (universalMsgId && universalAtts) {
              const toAdd = universalAtts
                .flatMap((a) => {
                  if (a.origin !== "generated") return []
                  const url = (
                    typeof a.file_link === "string" ? a.file_link
                    : typeof a.url === "string" ? a.url
                    : typeof a.link === "string" ? a.link
                    : ""
                  ).trim()
                  if (!url) return []
                  const rawName =
                    typeof a.file_name === "string" ? a.file_name
                    : typeof a.name === "string" ? a.name
                    : undefined
                  const filename =
                    rawName?.trim() || url.split("/").pop() || "file"
                  const mimeType =
                    typeof a.mime_type === "string" ? a.mime_type : undefined
                  return [{ url, filename, mimeType }]
                })
              if (toAdd.length > 0) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== universalMsgId) return msg
                    const existing = msg.generatedFiles ?? []
                    const existingUrls = new Set(existing.map((f) => f.url))
                    const newFiles: import("@/hooks/use-chat-state").GeneratedFile[] = []
                    for (const f of toAdd) {
                      if (!existingUrls.has(f.url)) newFiles.push(f)
                    }
                    return newFiles.length > 0
                      ? { ...msg, generatedFiles: [...existing, ...newFiles] }
                      : msg
                  }),
                )
              }
            }
          }

          // ── Event handlers ──────────────────────────────────────────────────

          if (eventName === "metadata" || eventName === "title") {
            const evtChatId = extractChatId(parsed)
            if (evtChatId) adoptChatId(evtChatId)
            const title = asString(parsed.title ?? parsed.chat_title)
            if (title && resolvedChatIdRef.current) {
              titleWasSet = true
              onTitleUpdate?.(resolvedChatIdRef.current, title)
            }
            continue
          }

          if (eventName === "reasoning") {
            const delta = typeof parsed.delta === "string" ? parsed.delta : ""
            const wasEmpty = !reasoningContent
            reasoningContent = mergeStreamingText(reasoningContent, delta)
            queueUpdate({
              thinking: reasoningContent,
              isThinkingInProgress: true,
              isLoading: true,
            }, wasEmpty)  // flush immediately on first reasoning chunk
            continue
          }

          if (eventName === "reasoning_heading") {
            const content = typeof parsed.content === "string" ? parsed.content : ""
            if (content) {
              // Commit the previous section before starting a new one
              if (currentReasHeading) {
                reasoningSectionsAcc.push({ heading: currentReasHeading, body: currentReasBody })
              }
              currentReasHeading = content
              currentReasBody = ""
              const wasEmpty = !reasoningContent
              reasoningContent = mergeStreamingText(reasoningContent, content)
              queueUpdate({
                thinking: reasoningContent,
                isThinkingInProgress: true,
                isLoading: true,
                reasoning_sections: snapshotSections(),
              }, wasEmpty)
            }
            continue
          }

          if (eventName === "reasoning_body") {
            const content = typeof parsed.content === "string" ? parsed.content : ""
            if (content) {
              currentReasBody = mergeStreamingText(currentReasBody, content)
              const wasEmpty = !reasoningContent
              reasoningContent = mergeStreamingText(reasoningContent, content)
              queueUpdate({
                thinking: reasoningContent,
                isThinkingInProgress: true,
                isLoading: true,
                reasoning_sections: snapshotSections(),
              }, wasEmpty)
            }
            continue
          }

          if (eventName === "chunk") {
            const delta = typeof parsed.delta === "string" ? parsed.delta : ""
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
              isLoading: true,
            }, wasEmpty)  // flush immediately on first content chunk
            continue
          }

          if (eventName === "message_saved") {
            // Backend confirmed the message was persisted.
            // The payload IS the saved message object (top-level fields) or may
            // wrap it under parsed.message / parsed.data.
            const evtChatId = extractChatId(parsed)
            if (evtChatId) adoptChatId(evtChatId)

            // The backend sends the full persisted message at top-level in this event.
            // Also support legacy nesting under parsed.message / parsed.data.
            const savedMsg = (
              typeof (parsed.message ?? parsed.data) === "object" && (parsed.message ?? parsed.data) !== null
                ? (parsed.message ?? parsed.data)
                : parsed
            ) as Record<string, unknown>

            const msgId = loadingMessageIdRef.current

            // ── Replace temp ID with the real backend message ID ─────────────
            // The backend sends message_id in this event. Without this, the
            // temp "loading-assistant-…" ID is never replaced and features
            // like pinning will fail because the backend doesn't know that ID.
            const realMessageId =
              asString(savedMsg.message_id ?? savedMsg.id ?? parsed.message_id ?? parsed.messageId)
            if (realMessageId && msgId && realMessageId !== msgId) {
              loadingMessageIdRef.current = realMessageId
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === msgId ? { ...msg, id: realMessageId } : msg,
                ),
              )
            }

            // ── sources / citations ──────────────────────────────────────────
            // Use the (possibly updated) real message ID from the ref.
            const currentMsgId = loadingMessageIdRef.current
            const rawSources = Array.isArray(savedMsg.sources) ? savedMsg.sources : null
            if (rawSources && rawSources.length > 0 && currentMsgId) {
              const hydratedCitations = (rawSources as Array<Record<string, unknown>>)
                .flatMap((s) => s.url || s.title ? [{
                  title: asString(s.title) ?? asString(s.url) ?? "",
                  url: asString(s.url),
                  domain: asString(s.domain) ?? (() => {
                    try { return new URL(asString(s.url) ?? "").hostname.replace(/^www\./, "") } catch { return undefined }
                  })(),
                }] : [])
              if (hydratedCitations.length > 0) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === currentMsgId ? { ...msg, webCitations: hydratedCitations } : msg,
                  ),
                )
              }
            }

            // ── file_attachments → generatedFiles ─────────────────────────────
            // The backend returns uploaded + generated files in `file_attachments`.
            // origin === "generated" → render as downloadable files in the assistant bubble.
            if (currentMsgId) {
              const rawAtts = Array.isArray(savedMsg.file_attachments)
                ? (savedMsg.file_attachments as Array<Record<string, unknown>>)
                : []
              const generatedFromSaved: import("@/hooks/use-chat-state").GeneratedFile[] = rawAtts
                .flatMap((a) => {
                  if (a.origin !== "generated") return []
                  const url = (
                    typeof a.file_link === "string" ? a.file_link :
                    typeof a.url      === "string" ? a.url :
                    typeof a.link     === "string" ? a.link : ""
                  ).trim()
                  if (!url) return []
                  const rawName = typeof a.file_name === "string" ? a.file_name
                    : typeof a.name === "string" ? a.name : undefined
                  const filename = rawName?.trim() || url.split("/").pop() || "file"
                  const mimeType = typeof a.mime_type === "string" ? a.mime_type : undefined
                  return [{ url, filename, mimeType }]
                })

              if (generatedFromSaved.length > 0) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== currentMsgId) return msg
                    const existing = msg.generatedFiles ?? []
                    const existingUrls = new Set(existing.map((f) => f.url))
                    const toAdd = generatedFromSaved.filter((f) => !existingUrls.has(f.url))
                    return toAdd.length > 0
                      ? { ...msg, generatedFiles: [...existing, ...toAdd] }
                      : msg
                  }),
                )
              }

              // ── file_attachments → user message attachment URLs ─────────────
              // origin === "uploaded" → backend has saved the file; update the
              // optimistic user message's attachments with the real file_link URL
              // so the chip in the user bubble becomes a proper link.
              const userMsgId = userMessageIdRef.current
              if (userMsgId) {
                const uploadedAtts = rawAtts
                  .flatMap((a) => {
                    if (a.origin !== "uploaded" && a.origin !== "user") return []
                    const url = (
                      typeof a.file_link === "string" ? a.file_link :
                      typeof a.url       === "string" ? a.url :
                      typeof a.link      === "string" ? a.link : ""
                    ).trim()
                    if (!url) return []
                    const rawName = typeof a.file_name === "string" ? a.file_name
                      : typeof a.name === "string" ? a.name : undefined
                    const filename = rawName?.trim() || url.split("/").pop() || "file"
                    const mimeType = typeof a.mime_type === "string" ? a.mime_type : "application/octet-stream"
                    return [{ filename, url, mimeType }]
                  })

                if (uploadedAtts.length > 0) {
                  setMessages((prev) =>
                    prev.map((msg) => {
                      if (msg.id !== userMsgId) return msg
                      const existing = msg.attachments ?? []
                      const updated = existing.map((att) => {
                          // eslint-disable-next-line react-doctor/js-index-maps -- uploadedAtts is tiny (1-5 files); Map overhead not justified
                        const match = uploadedAtts.find((u) => u.filename === att.file_name)
                        return match ? { ...att, url: match.url } : att
                      })
                      // If the optimistic message had no attachments yet (initial-prompt path),
                      // create them fresh from the backend data.
                      const merged = existing.length > 0 ? updated : uploadedAtts.map((u, i) => ({
                        id: `srv-att-${i}-${Date.now()}`,
                        file_name: u.filename,
                        file_type: u.mimeType,
                        file_size: 0,
                        url: u.url,
                      }))
                      return { ...msg, attachments: merged }
                    }),
                  )
                }
              }
            }

            // ── response_blocks (structured content including tags) ────────────
            // The backend includes response_blocks in the message_saved payload
            // for any structured content generated during streaming. Merge them
            // into the message so that tags are available when the user pins.
            const rawResponseBlocks = Array.isArray(savedMsg.response_blocks)
              ? (savedMsg.response_blocks as Array<Record<string, unknown>>)
              : null
            if (rawResponseBlocks && rawResponseBlocks.length > 0 && currentMsgId) {
              const validBlocks = rawResponseBlocks.filter(
                (b): b is import("@/hooks/use-chat-state").ResponseBlock =>
                  b !== null && typeof b === "object" && typeof b.kind === "string",
              )
              if (validBlocks.length > 0) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== currentMsgId) return msg
                    const existing = msg.responseBlocks ?? []
                    // Only add blocks not already delivered via structured_block events.
                    const toAdd = validBlocks.filter((b) => !existing.some((e) => e.kind === b.kind))
                    return toAdd.length > 0
                      ? { ...msg, responseBlocks: [...existing, ...toAdd] }
                      : msg
                  }),
                )
              }
            }

            continue
          }

          if (eventName === "model_selected") {
            // Backend selected a model - update the loading message with model info
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
            // Web search activity - schema: {query, links[]}
            const query = asString(parsed.query) ?? ""
            const rawLinks = Array.isArray(parsed.links) ? parsed.links : []
            const results = rawLinks
              .slice(0, 6)
              .flatMap((link: unknown): { title: string; url?: string; domain?: string }[] => {
                if (typeof link === "string") {
                  try {
                    const url = new URL(link)
                    return [{ title: url.hostname + url.pathname.slice(0, 40), url: link, domain: url.hostname }]
                  } catch { return [{ title: link, url: link, domain: "" }] }
                }
                if (typeof link === "object" && link !== null) {
                  const obj = link as Record<string, unknown>
                  const url = asString(obj.url) ?? ""
                  let domain = ""
                  try { domain = new URL(url).hostname } catch { /* ignore */ }
                  return [{
                    title: asString(obj.title) ?? url,
                    url,
                    domain: asString(obj.domain) ?? domain,
                  }]
                }
                return []
              })

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
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  // Merge new web-search results into webCitations (deduped by url)
                  const existing = msg.webCitations ?? []
                  const newCitations = results
                    .flatMap((r) => r.url && !existing.some((c) => c.url === r.url)
                      ? [{ title: r.title, url: r.url, domain: r.domain ?? "" }]
                      : [])
                  return {
                    ...msg,
                    activities: [...(msg.activities ?? []), activity],
                    webCitations: newCitations.length > 0 ? [...existing, ...newCitations] : existing,
                  }
                }),
              )
            }
            continue
          }

          if (eventName === "structured_block") {
            // Structured output block - schema: {block: ResponseBlock}
            const block = parsed.block as import("@/hooks/use-chat-state").ResponseBlock | undefined
            if (block && typeof block === "object" && "kind" in block) {
              const msgId = loadingMessageIdRef.current
              if (msgId) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === msgId
                      ? { ...msg, responseBlocks: [...(msg.responseBlocks ?? []), block] }
                      : msg,
                  ),
                )
              }
            }
            continue
          }

          if (eventName === "tool_progress") {
            // Tool progress - schema: {tool, label, status, filename, step?, message?, code_preview?}
            const toolName = asString(parsed.tool) ?? "unknown"
            const label = asString(parsed.label)
            const status = asString(parsed.status) ?? "start"
            const filename = asString(parsed.filename)
            const progressMessage = asString(parsed.message)
            const codePreview = asString(parsed.code_preview)
            // Prefer the activityId linked from tool_executing; fall back to constructed key
            const activityId = toolCallIdByName.get(toolName) ?? `tp-${toolName}-${filename ?? "default"}`

            const activityType = toolNameToType(toolName)

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  // eslint-disable-next-line react-doctor/js-index-maps -- early return on msg.id !== msgId means find runs at most once across all messages
                  const existing = (msg.activities ?? []).find((a) => a.id === activityId)
                  if (existing) {
                    // Update existing activity
                    return {
                      ...msg,
                      activities: (msg.activities ?? []).map((a) =>
                        a.id === activityId
                          ? { ...a, status: status as import("@/hooks/use-chat-state").ActivityStatus, label: label ?? a.label, detail: label ?? a.detail, progressMessage, codePreview }
                          : a,
                      ),
                    }
                  }
                  // Create new activity (tool_executing may have been missed)
                  const newActivity: import("@/hooks/use-chat-state").ActivityItem = {
                    id: activityId,
                    type: activityType,
                    toolName,
                    label,
                    detail: label || progressMessage || filename || toolName,
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
            // Tool is about to execute - schema: {content (tool name), label, tool_call: {name, arguments, ...}}
            const toolCall = parsed.tool_call as Record<string, unknown> | undefined
            const toolName = asString(toolCall?.name) ?? asString(parsed.content) ?? "tool"
            const label = asString(parsed.label)
            const toolCallId = asString(toolCall?.tool_call_id) ?? `te-${toolName}-${Date.now()}`

            // Register this tool_call_id so subsequent tool_progress events can find this activity
            toolCallIdByName.set(toolName, toolCallId)

            const activityType = toolNameToType(toolName)
            const detail = label ?? toolName.replace(/_/g, " ")

            const activity: import("@/hooks/use-chat-state").ActivityItem = {
              id: toolCallId,
              type: activityType,
              toolName,
              label,
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

          if (eventName === "tool_calls_streaming" || parsed.type === "tool_calls_streaming") {
            // Streaming partial tool call arguments - no UI update needed
            continue
          }

          if (eventName === "tool_connect_prompt") {
            // Backend requests the user to link a connector before the tool can run.
            // Schema: { connector_slug, display_name, auth_mode, tool_name, request_id, api_key_fields?, icon_url? }
            // api_key_fields is an array of ApiKeyField objects: { name, label, help?, secret, required }
            type ApiKeyField = import("@/lib/api/connectors").ApiKeyField
            const rawFields = parsed.api_key_fields
            const apiKeyFields: ApiKeyField[] | undefined = Array.isArray(rawFields)
              ? rawFields.filter(
                  (f): f is ApiKeyField =>
                    typeof f === 'object' && f !== null &&
                    typeof (f as Record<string, unknown>).name === 'string',
                )
              : undefined
            const prompt: import("@/hooks/use-chat-state").ConnectorConnectPrompt = {
              request_id:      asString(parsed.request_id) ?? `ccp-${Date.now()}`,
              connector_slug:  asString(parsed.connector_slug) ?? "",
              display_name:    asString(parsed.display_name) ?? asString(parsed.connector_slug) ?? "",
              auth_mode:       (asString(parsed.auth_mode) ?? "oauth2") as 'oauth2' | 'api_key',
              tool_name:       asString(parsed.tool_name) ?? "",
              api_key_fields:  apiKeyFields,
              icon_url:        asString(parsed.icon_url),
            }
            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  const existing = msg.connectorConnectPrompts ?? []
                  // Deduplicate by request_id
                  if (existing.some((p) => p.request_id === prompt.request_id)) return msg
                  return { ...msg, connectorConnectPrompts: [...existing, prompt] }
                }),
              )
            }
            continue
          }

          if (eventName === "tool_permission_prompt") {
            // Backend requests permission to run a connector tool (policy is "ask").
            // Schema: { connector_slug, display_name, tool_name, request_id, suggested_args?, icon_url? }
            const prompt: import("@/hooks/use-chat-state").ConnectorPermissionPrompt = {
              request_id:     asString(parsed.request_id) ?? `cpp-${Date.now()}`,
              connector_slug: asString(parsed.connector_slug) ?? "",
              display_name:   asString(parsed.display_name) ?? asString(parsed.connector_slug) ?? "",
              tool_name:      asString(parsed.tool_name) ?? "",
              suggested_args: typeof parsed.suggested_args === 'object' && parsed.suggested_args !== null
                ? (parsed.suggested_args as Record<string, unknown>)
                : undefined,
              icon_url:       asString(parsed.icon_url),
            }
            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  const existing = msg.connectorPermissionPrompts ?? []
                  if (existing.some((p) => p.request_id === prompt.request_id)) return msg
                  return { ...msg, connectorPermissionPrompts: [...existing, prompt] }
                }),
              )
            }
            continue
          }

          if (eventName === "tool_complete" || parsed.type === "tool_complete") {
            // Tool finished - schema: {content (tool name), label, tool_call: {name, tool_call_id, result, duration_s}}
            const toolCall = parsed.tool_call as Record<string, unknown> | undefined
            const toolCallId = asString(toolCall?.tool_call_id)
            const label = asString(parsed.label)
            const durationS = typeof toolCall?.duration_s === "number" ? toolCall.duration_s : undefined
            // Clean up the name→id mapping
            const toolName = asString(toolCall?.name) ?? asString(parsed.content)
            if (toolName) toolCallIdByName.delete(toolName)

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
                          ? { ...a, status: "done" as const, durationS, ...(label ? { label, detail: label } : {}) }
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
            // Image event - either inline from LLM ({images: string[]}) or named ({url, s3_key})
            const msgId = loadingMessageIdRef.current
            if (msgId) {
              if (Array.isArray(parsed.images)) {
                const newImages = (parsed.images as string[]).map((url) => ({ url }))
                receivedImages = true
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === msgId
                      ? { ...msg, images: [...(msg.images ?? []), ...newImages] }
                      : msg,
                  ),
                )
              } else if (parsed.url) {
                const img = { url: asString(parsed.url) ?? "", s3Key: asString(parsed.s3_key) }
                receivedImages = true
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
            // Generated file - schema: {url, s3_key, filename, mime_type}
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
            // Document generation progress - schema: {step, message, filename, code_preview?}
            const step = asString(parsed.step) ?? "start"
            const filename = asString(parsed.filename) ?? "document"
            const progressMessage = asString(parsed.message) ?? ""
            const activityId = `docx-${filename}`

            const msgId = loadingMessageIdRef.current
            if (msgId) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  // eslint-disable-next-line react-doctor/js-index-maps -- early return on msg.id !== msgId means find runs at most once across all messages
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
            const finishReason = asString(parsed.finish_reason)
            const isToolCallRound = finishReason === "tool_calls"

            const doneChatId = extractChatId(parsed)
            if (doneChatId) adoptChatId(doneChatId)

            const doneTitle = asString(parsed.title ?? parsed.chat_title)
            if (doneTitle && !titleWasSet && resolvedChatIdRef.current) {
              onTitleUpdate?.(resolvedChatIdRef.current, doneTitle)
            }

            flushPending()

            if (isToolCallRound) {
              // Agentic intermediate round - tool calls are about to execute.
              // More content rounds are coming; do not finalise the message.
              queueUpdate({ isThinkingInProgress: false }, true)
              continue
            }

            // Final round (finish_reason: "stop", "length", etc.)
            const { visibleText, thinkingText } = extractThinkingContent(assistantContent)
            const finalReasoning = reasoningContent || thinkingText

            if (resolvedChatIdRef.current) {
              onChatMoveToTop?.(resolvedChatIdRef.current)
            }

            // Extract generated files from file_attachments in the done payload
            const doneFileAttachments = Array.isArray(parsed.file_attachments)
              ? (parsed.file_attachments as Array<Record<string, unknown>>)
              : []
            const doneGeneratedFiles = doneFileAttachments
              .flatMap((a) => {
                if (a.origin !== "generated") return []
                const url = (
                  typeof a.file_link === "string" ? a.file_link :
                  typeof a.url === "string" ? a.url : ""
                ).trim()
                if (!url) return []
                const rawName = typeof a.file_name === "string" ? a.file_name : typeof a.name === "string" ? a.name : undefined
                const filename = rawName?.trim() || url.split("/").pop() || "file"
                return [{ url, filename, mimeType: typeof a.mime_type === "string" ? a.mime_type : undefined }]
              })

            // Merge with any files already set via generated_file SSE events
            const msgId = loadingMessageIdRef.current
            if (msgId && doneGeneratedFiles.length > 0) {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== msgId) return msg
                  const existing = msg.generatedFiles ?? []
                  const existingUrls = new Set(existing.map((f) => f.url))
                  const toAdd = doneGeneratedFiles.filter((f) => !existingUrls.has(f.url))
                  return toAdd.length > 0
                    ? { ...msg, generatedFiles: [...existing, ...toAdd] }
                    : msg
                }),
              )
            }

            // Update user message attachments with real backend URLs for uploaded files
            const doneUserMsgId = userMessageIdRef.current
            if (doneUserMsgId) {
              const uploadedFromDone = doneFileAttachments
                .flatMap((a) => {
                  if (a.origin !== "uploaded" && a.origin !== "user") return []
                  const url = (
                    typeof a.file_link === "string" ? a.file_link :
                    typeof a.url       === "string" ? a.url :
                    typeof a.link      === "string" ? a.link : ""
                  ).trim()
                  if (!url) return []
                  const rawName = typeof a.file_name === "string" ? a.file_name
                    : typeof a.name === "string" ? a.name : undefined
                  const filename = rawName?.trim() || url.split("/").pop() || "file"
                  const mimeType = typeof a.mime_type === "string" ? a.mime_type : "application/octet-stream"
                  return [{ filename, url, mimeType }]
                })

              if (uploadedFromDone.length > 0) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== doneUserMsgId) return msg
                    const existing = msg.attachments ?? []
                    const updated = existing.map((att) => {
                        // eslint-disable-next-line react-doctor/js-index-maps -- uploadedFromDone is tiny (1-5 files); Map overhead not justified
                        const match = uploadedFromDone.find((u) => u.filename === att.file_name)
                      return match ? { ...att, url: match.url } : att
                    })
                    const merged = existing.length > 0 ? updated : uploadedFromDone.map((u, i) => ({
                      id: `srv-att-${i}-${Date.now()}`,
                      file_name: u.filename,
                      file_type: u.mimeType,
                      file_size: 0,
                      url: u.url,
                    }))
                    return { ...msg, attachments: merged }
                  }),
                )
              }
            }

            queueUpdate(
              {
                content:
                  visibleText || (finalReasoning || receivedImages ? "" : "API didn't respond"),
                thinking: finalReasoning || undefined,
                isThinkingInProgress: false,
                isLoading: false,
                stoppedByUser: false,
                reasoning_sections: snapshotSections().length > 0 ? snapshotSections() : undefined,
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

            // eslint-disable-next-line react-doctor/js-set-map-lookups -- substring search; Set.has() checks exact values, not substrings
            if (lower.includes("token expired") ||
              // eslint-disable-next-line react-doctor/js-set-map-lookups
              lower.includes("not authenticated") ||
              // eslint-disable-next-line react-doctor/js-set-map-lookups
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

      // ── XHR transport with real upload progress ───────────────────────────

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.open("POST", "/api/chat")

        // Report real browser→proxy upload progress per file byte count
        if (options?.files?.length && options.onUploadProgress) {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable && e.total > 0) {
              // Cap at 99 so the caller can set 100 only on confirmed completion
              options.onUploadProgress!(Math.min(99, Math.round((e.loaded / e.total) * 100)))
            }
          })
        }

        // Upload finished → signal 100%, enter SSE streaming phase
        xhr.upload.addEventListener("loadend", () => {
          options?.onUploadProgress?.(100)
          setStreamState?.("streaming")
          startFlushInterval()
        })

        let headersHandled = false
        let processedLength = 0

        // onprogress fires for every incoming chunk of streaming data and is
        // more reliable than relying on onreadystatechange LOADING events alone.
        xhr.onprogress = () => {
          if (shouldStopReading) return
          // Safety-net: start flush interval if upload.loadend didn't fire yet
          // (e.g. when there are no files to upload).
          if (!flushTimerRef.current) startFlushInterval()
          const text = xhr.responseText
          if (text.length > processedLength) {
            processSSEText(text.slice(processedLength))
            processedLength = text.length
          }
        }

        xhr.onreadystatechange = () => {
          // Handle response headers once
          if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && !headersHandled) {
            headersHandled = true
            if (xhr.status > 0 && (xhr.status < 200 || xhr.status >= 300)) {
              reject(new Error(
                friendlyApiError(xhr.responseText || `Request failed with status ${xhr.status}`, xhr.status),
              ))
              return
            }
            const headerChatId =
              xhr.getResponseHeader("X-Chat-Id") ?? xhr.getResponseHeader("x-chat-id")
            if (headerChatId && (!chatId || chatId.startsWith("temp-"))) {
              resolvedChatIdRef.current = headerChatId
              onChatCreated?.(headerChatId)
            }
          }

          if (xhr.readyState === XMLHttpRequest.DONE) {
            xhrRef.current = null
            // Process any data that onprogress may not have seen in the final chunk
            if (!shouldStopReading) {
              const text = xhr.responseText
              if (text.length > processedLength) {
                processSSEText(text.slice(processedLength))
                processedLength = text.length
              }
            }
            // Flush any incomplete SSE event still in the buffer
            if (buffer.trim()) processSSEText("\n\n")
            if (xhr.status === 0 && !stopRequestedRef.current) {
              reject(new Error(friendlyApiError("", 503)))
            } else {
              resolve()
            }
          }
        }

        // Distinguish a user-initiated abort (handleStopGeneration → xhr.abort())
        // from a network error so we resolve cleanly instead of rejecting.
        xhr.onabort = () => {
          xhrRef.current = null
          resolve()
        }

        xhr.onerror = () => {
          xhrRef.current = null
          reject(new Error(friendlyApiError("", 503)))
        }

        xhr.send(fd)
      })

      stopFlushInterval()
      flushPending()

      // Stream ended without a done or error event - treat accumulated content
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
              reasoning_sections: snapshotSections().length > 0 ? snapshotSections() : undefined,
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

      // User-initiated stop - not an error
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
  if (lower === "web_search" || lower.includes("search")) return "web-search"
  if (lower === "read_pages" || lower.includes("read_pdf")) return "read-pages"
  if (lower === "csv_execute" || lower.includes("csv")) return "csv-execute"
  if (lower === "fetch_resource" || lower.includes("fetch")) return "fetch-resource"
  if (lower === "doc_execute") return "doc-execute"
  if (lower === "docx_execute" || lower.includes("docx") || lower.includes("document")) return "docx-progress"
  if (lower === "skills") return "skills"
  return "tool-call"
}
