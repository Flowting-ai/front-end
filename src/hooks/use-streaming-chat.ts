"use client"

import { useRef } from "react"
import { flushSync } from "react-dom"
import { clearStreamFields, publishStreamFields } from "@/lib/chat/stream-store"
import { stopActiveActivities } from "@/lib/activity"
import { apiFetch } from "@/lib/api/client"
import { CHAT_STOP_ENDPOINT } from "@/lib/config"
import { notifyLibraryFilesChanged } from "@/lib/library/files-changed"
import { ensureFreshToken } from "@/lib/jwt-utils"
import { logger } from "@/lib/logger"
import { friendlyModelError } from "@/lib/model-error"
import { AguiSSEDecoder } from "@/lib/sse-decoder"
import type { UIMessage } from "@/types/chat"
import { registerStream, completeStream, type StreamOutcome } from "@/lib/stream-registry"
import { updateMessage } from "@/lib/chat/stream/message-patches"
import {
  AuthExpiredError,
  FriendlyStreamError,
  SESSION_EXPIRED_MESSAGE,
  dispatchSessionExpired,
  isAuthErrorText,
} from "@/lib/chat/stream/stream-errors"
import { processStreamEvents } from "@/lib/chat/stream/stream-events"
import { buildStreamFormData, resolveStreamTarget, type StreamRequestOptions } from "@/lib/chat/stream/stream-request"
import { createStreamTurn, finishTurn, type StreamEventContext } from "@/lib/chat/stream/stream-turn"
import { sendStreamRequest } from "@/lib/chat/stream/xhr-transport"

// The stream's layers live in lib/chat/stream: the request (stream-request),
// the XHR transport (xhr-transport), and the event handlers that turn decoded
// events into message updates (stream-events, tool-events, message-patches).
// This hook owns the refs, the batching of streamed text, and the turn's
// start and end.

export type { TurnResume } from "@/lib/chat/stream/stream-request"

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
  /** Called after a stream completes successfully (for refreshing usage data). */
  onStreamDone?: () => void
  /** Override the proxy endpoint (defaults to "/api/chat"). Use for persona chat, etc. */
  endpoint?: string
  /** Absolute backend endpoints for proxy-less streaming on deployed origins.
   *  Defaults to the regular chat endpoints; persona chat passes its own.
   *  Callers with a bespoke proxy and no direct equivalent omit this AND pass
   *  `endpoint`, keeping their proxy on all origins. */
  directEndpoints?: { create: string; stream: (chatId: string) => string }
  /** Custom stop handler. When provided, called instead of the default CHAT_STOP_ENDPOINT call.
   *  Receives the resolved chatId. Use for persona chat stop endpoints. */
  onStopBackend?: (chatId: string) => void
  /** Ref to the chatId currently displayed in the UI. When provided, setStreamState calls are
   *  suppressed for background streams whose chatId no longer matches what is displayed. */
  currentChatIdRef?: React.RefObject<string | undefined>
  /** Keep the streaming message's in-flight fields (text, reasoning) in
   *  lib/chat/stream-store instead of React state, committing them into
   *  `messages` only at milestones (tool events, end, stop, error). The caller
   *  must render rows through useLiveMessage or tokens won't show until then. */
  liveOverlay?: boolean
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
  onStreamDone,
  endpoint = "/api/chat",
  directEndpoints,
  onStopBackend,
  currentChatIdRef,
  liveOverlay = false,
}: UseStreamingChatParams) {
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const stopRequestedRef = useRef(false)

  // Pending message field updates - flushed to React every FLUSH_INTERVAL_MS
  const pendingFieldsRef = useRef<Partial<UIMessage> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafScheduledRef = useRef(false)
  // liveOverlay: the message id whose uncommitted fields sit in the stream store.
  const publishedKeyRef = useRef<string | null>(null)

  // The temp ID of the loading placeholder being updated during a stream
  const loadingMessageIdRef = useRef<string | null>(null)
  // Tracks the optimistic user message ID so message_saved can update its attachment URLs
  const userMessageIdRef = useRef<string | null>(null)
  // Resolved chat ID (may start as null/temp and update once backend confirms)
  const resolvedChatIdRef = useRef<string | null>(null)
  // Stops the current call's stream, and only that one — registered with the
  // stream registry so the stream can be stopped from wherever its chat is shown.
  const activeStopRef = useRef<(() => void) | null>(null)

  // ── Flush helpers ───────────────────────────────────────────────────────────

  const applyUpdate = (fields: Partial<UIMessage>) => {
    const msgId = loadingMessageIdRef.current
    if (!msgId) return
    setMessages((prev) =>
      prev.map((msg) => (msg.id === msgId ? { ...msg, ...fields } : msg)),
    )
  }

  // Commits the pending fields into messages. In liveOverlay mode this is the
  // only path to React state for streamed text: the commit renders
  // synchronously, then the store entry is dropped, so the row never shows a
  // frame with neither (no flash back to older text).
  const flushPending = () => {
    const fields = pendingFieldsRef.current
    const key = publishedKeyRef.current
    pendingFieldsRef.current = null
    publishedKeyRef.current = null
    if (fields) {
      if (key) flushSync(() => applyUpdate(fields))
      else applyUpdate(fields)
    }
    if (key) clearStreamFields(key)
  }

  const queueUpdate = (fields: Partial<UIMessage>, immediate = false) => {
    pendingFieldsRef.current = pendingFieldsRef.current
      ? { ...pendingFieldsRef.current, ...fields }
      : fields
    if (immediate) {
      flushPending()
      return
    }
    if (liveOverlay) {
      // Stays out of React state until the next commit; the store batches
      // notifications to one per animation frame.
      const msgId = loadingMessageIdRef.current
      if (!msgId) return
      if (publishedKeyRef.current && publishedKeyRef.current !== msgId) clearStreamFields(publishedKeyRef.current)
      publishedKeyRef.current = msgId
      publishStreamFields(msgId, pendingFieldsRef.current)
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
    if (liveOverlay || flushTimerRef.current) return
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
    completeStream(resolvedChatIdRef.current, "aborted")
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
                // The "Generation stopped" line under the bubble says it; no second copy as text.
                content: msg.content,
                activities: stopActiveActivities(msg.activities),
              }
            : msg,
        ),
      )
    }

    // Signal the backend to stop generation.
    const chatId = resolvedChatIdRef.current
    if (chatId && !chatId.startsWith("temp-")) {
      if (onStopBackend) {
        onStopBackend(chatId)
      } else {
        void apiFetch(CHAT_STOP_ENDPOINT(chatId), { method: "POST" }).catch(() => {})
      }
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
   *
   * Resolves with how the turn ended — the message queue holds a queued
   * message back after a reply that failed or was stopped.
   */
  const fetchAiResponse = async (
    input: string,
    chatId: string | null,
    loadingMessageId: string,
    modelId?: string | number | null,
    options?: StreamRequestOptions,
  ): Promise<StreamOutcome> => {
    stopRequestedRef.current = false
    xhrRef.current = null
    loadingMessageIdRef.current = loadingMessageId
    userMessageIdRef.current = options?.userMessageId ?? null
    resolvedChatIdRef.current = chatId
    // The refs above belong to whichever call ran last, so stopping through
    // the registry is a no-op once a newer call has taken over this hook.
    const stopThisCall = () => {
      if (activeStopRef.current === stopThisCall) handleStopGeneration()
    }
    activeStopRef.current = stopThisCall
    registerStream(chatId, stopThisCall)

    // Returns true if this stream's chat is still the one the user is viewing.
    // Used to suppress setStreamState calls for background (unfocused) streams.
    const isActiveStream = () => {
      if (!currentChatIdRef?.current) return true
      const streamId = resolvedChatIdRef.current
      return streamId === null || streamId === currentChatIdRef.current
    }

    setStreamState?.("waiting")

    const turn = createStreamTurn()
    // The event handlers' view of this call: its refs, batching and callbacks.
    const ctx: StreamEventContext = {
      setMessages,
      queueUpdate,
      flushPending,
      messageId: () => loadingMessageIdRef.current,
      setMessageId: (id) => { loadingMessageIdRef.current = id },
      userMessageId: () => userMessageIdRef.current,
      chatId: () => resolvedChatIdRef.current,
      adoptChatId: (id) => adoptChatId(id),
      onRunStarted: () => { if (isActiveStream()) setStreamState?.("streaming") },
      onTitleUpdate,
      onChatMoveToTop,
      saveToLibrary: undefined,
    }

    try {
      const target = resolveStreamTarget(chatId, endpoint, directEndpoints, options)
      const directToken = target.useDirectBackend ? await ensureFreshToken() : null
      const { fd, fileRefs } = buildStreamFormData(input, chatId, modelId, options, target)
      ctx.saveToLibrary = fileRefs.saveToLibrary
      // The sent message remembers its Library files, for the chat's Sources panel.
      if (fileRefs.libraryFileIds.length > 0 && options?.userMessageId) {
        const sentIds = fileRefs.libraryFileIds
        setMessages(updateMessage(options.userMessageId, (msg) => ({ ...msg, libraryFileIds: sentIds })))
      }

      const sseDecoder = new AguiSSEDecoder()
      await sendStreamRequest({
        target,
        directToken,
        fd,
        chatId,
        hasFiles: Boolean(options?.files?.length),
        onUploadProgress: options?.onUploadProgress,
        setXhr: (xhr) => { xhrRef.current = xhr },
        onUploadEnd: () => {
          if (isActiveStream()) setStreamState?.("streaming")
          startFlushInterval()
        },
        // Safety-net: start flush interval if upload.loadend didn't fire yet
        // (e.g. when there are no files to upload).
        onProgress: () => { if (!flushTimerRef.current) startFlushInterval() },
        // Each new slice of the response stream, decoded and applied in order.
        onText: (text, flush = false) => {
          const decodedEvents = sseDecoder.push(text)
          if (flush) decodedEvents.push(...sseDecoder.flush())
          processStreamEvents(ctx, turn, decodedEvents)
        },
        // Adopted like the stream's own chat-id events, so the new chat's
        // stream is registered too — the message queue must not treat a
        // chat whose first reply is still running as idle.
        onHeaderChatId: (headerChatId) => {
          if (!chatId || chatId.startsWith("temp-")) adoptChatId(headerChatId)
        },
        isStopRequested: () => stopRequestedRef.current,
      })

      stopFlushInterval()
      flushPending()

      // Stream ended without a done or error event - treat what was shown as
      // the complete response. A user Stop already finalised the message.
      if (!turn.streamFinished && !stopRequestedRef.current) finishTurn(ctx, turn, "ended")

      const outcome: StreamOutcome = stopRequestedRef.current ? "aborted" : turn.turnFailed ? "error" : "done"
      completeStream(resolvedChatIdRef.current, outcome)
      // The backend saves the files this turn carried to Library; refresh what Library shows.
      if (options?.files?.length) notifyLibraryFilesChanged()
      setStreamState?.("done")
      onStreamDone?.()
      return outcome
    } catch (error) {
      stopFlushInterval()
      flushPending()
      completeStream(resolvedChatIdRef.current, stopRequestedRef.current ? "aborted" : "error")
      // A turn that failed or was stopped part-way may still have saved its files.
      if (options?.files?.length) notifyLibraryFilesChanged()

      // User-initiated stop - not an error
      if (stopRequestedRef.current) {
        setStreamState?.("aborted")
        return "aborted"
      }

      // A FriendlyStreamError was already logged where it was raised (status, endpoint,
      // body); logging it again here only doubles the dev overlay's issue count.
      if (!(error instanceof FriendlyStreamError)) logger.error("[useStreamingChat] Error", error)

      if (error instanceof AuthExpiredError) {
        setStreamState?.("error")
        // Settle the reply (no cursor or busy state) while the sign-out runs.
        if (!turn.streamFinished) finishTurn(ctx, turn, "error", SESSION_EXPIRED_MESSAGE)
        dispatchSessionExpired()
        return "error"
      }

      const rawMsg =
        error instanceof Error ? error.message : "Failed to connect to AI service"
      const lower = rawMsg.toLowerCase()

      // Fallback for errors that never passed through the XHR reject paths
      // (e.g. a synchronous throw earlier in this function), so weren't
      // already classified as AuthExpiredError there.
      if (isAuthErrorText(lower) || lower.includes("401")) {
        setStreamState?.("error")
        if (!turn.streamFinished) finishTurn(ctx, turn, "error", SESSION_EXPIRED_MESSAGE)
        dispatchSessionExpired()
        return "error"
      }

      setStreamState?.("error")
      // A turn already finished by its done/error event keeps that outcome.
      if (!turn.streamFinished) {
        // Errors from the XHR paths are already translated by
        // friendlyModelError at the point of failure, when the real status
        // code / raw backend text was still available. Re-running the
        // translator on that already-friendly text would match no known
        // pattern and flatten it into the generic fallback — so only
        // translate genuinely-raw messages here.
        finishTurn(ctx, turn, "error", error instanceof FriendlyStreamError ? rawMsg : friendlyModelError(rawMsg))
      }
      return "error"
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const adoptChatId = (chatId: string) => {
    if (resolvedChatIdRef.current === chatId) return
    if (resolvedChatIdRef.current && !resolvedChatIdRef.current.startsWith("temp-")) return
    resolvedChatIdRef.current = chatId
    registerStream(chatId, activeStopRef.current ?? undefined)
    onChatCreated?.(chatId)
  }

  return { fetchAiResponse, handleStopGeneration }
}
