"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { getChatMessages, getChatStreamId } from "@/lib/api/chat"
import { toUIMessages } from "@/lib/normalizers/message-transformer"
import { logger } from "@/lib/logger"
import { detachStream, getStreamCompletion, waitForChatStreams, subscribeStreams } from "@/lib/stream-registry"
import { stopActiveActivities } from "@/lib/activity"
import {
  readChatHistory,
  saveChatHistory,
  updateCachedMessages,
  dropChatHistory,
  isHistoryStale,
} from "@/lib/chat/chat-message-cache"
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
  /** Bumped every time a chat's history is installed — from the cache, from the
   *  network, or on an explicit refresh — and never on pagination. Consumers
   *  that need to act once per opened thread (scrolling it to the bottom) key
   *  off this rather than an `isLoadingMessages` transition, which a cache hit
   *  does not produce. */
  historyLoadId: number
  /** The reply whose run is still going on the backend, as of the last history
   *  load: the message to follow from the run's stream. Null when none is. */
  runningMessageId: string | null
}

// ── The running turn ─────────────────────────────────────────────────────────

/** The reply the agent is still working on, by its run: the last one, since a chat has one run at a time. */
function runningReply(list: UIMessage[]): UIMessage | undefined {
  return list.findLast((m) => m.role === "assistant" && m.run?.status === "running")
}

/** Shows the running reply as loading. Its text so far (from earlier stretches of the run) stays. */
function withRunningTurn(list: UIMessage[]): UIMessage[] {
  const running = runningReply(list)
  return running ? list.map((m) => (m === running ? { ...m, isLoading: true } : m)) : list
}

// ── Local-work detection ─────────────────────────────────────────────────────

/**
 * A turn this tab started that has not landed yet. Two things key off it: such a
 * list is never written to the cache (coming back to a chat must not restore a
 * bubble that is permanently mid-reply), and a background refresh that would
 * overwrite one is abandoned instead.
 *
 * `isLoading` alone is enough, and the message's temp id deliberately is not
 * part of the test. Every send path pairs addOptimisticUserMessage with
 * addLoadingAssistantMessage (see use-chat-turns.ts and use-initial-prompt.ts),
 * so this also covers the window between composing a turn and the stream being
 * registered — attachment uploads run in it, so it can last seconds. Matching on
 * the `loading-assistant-` id instead would never clear: a finished reply keeps
 * its temp id until the next load, so the chat the user just talked to — the one
 * most worth caching — would be the one chat never cached.
 */
function isPendingLocal(m: UIMessage): boolean {
  return Boolean(m.isLoading)
}

// ── Implementation ────────────────────────────────────────────────────────────

export interface UseChatStateOptions {
  /**
   * Override the default message fetcher. When provided, called instead of
   * getChatMessages so persona surfaces can supply their own loader
   * without needing a separate state hook. The returned messages must already
   * be in UIMessage form (fully normalised). Pagination is disabled when this
   * override is active, and so is caching: this hook cannot know whether a
   * custom loader's result is interchangeable with the default endpoint's.
   */
  loadMessages?: (chatId: string) => Promise<UIMessage[]>
}

/**
 * `messages` with the chat it belongs to carried alongside it, rather than in a
 * ref. Writes come from all over (the streaming hook, the composer, edits), and
 * during a navigation there is a commit where `chatId` is already the new chat
 * while `list` is still the old one's. Tagging the list in state makes "which
 * chat do these messages belong to" a property of the value, so a write-back can
 * never file one chat's history under another's id.
 */
interface HistoryState {
  chatId: string | undefined
  list: UIMessage[]
  /**
   * Whether `list` is this chat's actual history rather than the empty
   * placeholder shown while its first load is in flight. Without it the
   * write-back below would cache that placeholder, and the next visit would
   * render a chat as empty instead of loading it.
   */
  loaded: boolean
}

const EMPTY_HISTORY: HistoryState = { chatId: undefined, list: [], loaded: false }

export function useChatState(chatId: string | undefined, options?: UseChatStateOptions): UseChatStateResult {
  const [state, setState] = useState<HistoryState>(EMPTY_HISTORY)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [historyLoadId, setHistoryLoadId] = useState(0)
  const [runningMessageId, setRunningMessageId] = useState<string | null>(null)
  // Bumped when a background stream ends, purely to re-run the write-back
  // effect: the stream's final commit can land before completeStream() clears
  // the registry, in which case the effect would skip that commit and the chat
  // the user just talked to would never make it into the cache.
  const [streamEndTick, setStreamEndTick] = useState(0)
  // Set when the initial message-history fetch for the current chatId fails.
  // Cleared on the next successful load (initial or retried). Lets the UI
  // show a retry affordance instead of a silently-empty thread — a failed
  // fetch here previously just toasted and left `messages` as the `[]` it
  // was eagerly cleared to before the fetch started, which reads as "this
  // conversation's history is gone" rather than "a refresh failed."
  const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null)
  const cursorRef = useRef<string | undefined>(undefined)
  const pagesRef = useRef(1)
  const loadingRef = useRef(false)
  // Mirrors `state` for the guards that run outside render (a background
  // refresh deciding whether a turn started while it was in flight). Synced in
  // an effect, not during render: a background fetch resolves whole ticks after
  // the commit, so one-commit latency cannot matter here.
  const stateRef = useRef<HistoryState>(EMPTY_HISTORY)
  // Track chat IDs that were created optimistically during streaming -
  // we must NOT clear messages when navigating to these since the streaming
  // hook is still actively writing to the message list.
  const optimisticChatIdsRef = useRef<Set<string>>(new Set())
  // Only clear messages when navigating AWAY from a real chat to a new one.
  // Without this, React 18 StrictMode's double-invocation clears optimistic
  // messages on the simulated remount before they can be re-added.
  const hasPreviousChatRef = useRef(false)

  const cacheEnabled = !options?.loadMessages

  const messages = state.list

  useEffect(() => {
    stateRef.current = state
  }, [state])

  /** Replaces the list while keeping it tagged with the chat it belongs to. */
  const setMessages = useCallback<React.Dispatch<React.SetStateAction<UIMessage[]>>>((action) => {
    setState((prev) => {
      const next = typeof action === "function"
        ? (action as (p: UIMessage[]) => UIMessage[])(prev.list)
        : action
      return next === prev.list ? prev : { ...prev, list: next }
    })
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────

  /** Installs a freshly-loaded history for `id` and records it in the cache. */
  const install = useCallback((
    id: string,
    list: UIMessage[],
    meta: { hasMore: boolean; cursor: string | undefined; runningId: string | null },
  ) => {
    cursorRef.current = meta.cursor
    pagesRef.current = 1
    setState({ chatId: id, list, loaded: true })
    setRunningMessageId(meta.runningId)
    setHasMoreMessages(meta.hasMore)
    setHistoryLoadId((n) => n + 1)
    setMessagesLoadError(null)
    // A history with a reply still being written is not cached; see isPendingLocal.
    if (cacheEnabled && !list.some(isPendingLocal)) {
      saveChatHistory(id, { messages: list, hasMore: meta.hasMore, cursor: meta.cursor, pages: 1 })
    }
  }, [cacheEnabled])

  /** Fetches `id`'s first page through whichever loader is configured. */
  const fetchHistory = useCallback(async (id: string): Promise<{ list: UIMessage[]; hasMore: boolean; cursor: string | undefined; runningId: string | null }> => {
    if (options?.loadMessages) {
      const msgs = await options.loadMessages(id)
      return { list: msgs, hasMore: false, cursor: undefined, runningId: null }
    }
    const res = await getChatMessages(id)
    const list = withRunningTurn(toUIMessages(res.messages))
    return {
      list,
      hasMore: res.has_more,
      cursor: res.next_cursor ?? undefined,
      runningId: runningReply(list)?.id ?? null,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- options is stable for each hook consumer
  }, [])

  // Load messages whenever chatId changes
  useEffect(() => {
    if (!chatId) {
      if (hasPreviousChatRef.current) setState(EMPTY_HISTORY)
      setHasMoreMessages(false)
      cursorRef.current = undefined
      pagesRef.current = 1
      setMessagesLoadError(null)
      return
    }

    hasPreviousChatRef.current = true
    setMessagesLoadError(null)
    setRunningMessageId(null)

    // If this chatId was just created during an active stream, skip the
    // fetch-and-clear cycle - the stream is still writing messages. Re-tag the
    // list it is writing to, which until now was the pre-creation `undefined`,
    // so the finished reply gets cached under the real id.
    if (optimisticChatIdsRef.current.has(chatId)) {
      optimisticChatIdsRef.current.delete(chatId)
      // loaded: the list the stream is building is this new chat's history —
      // there is nothing on the server yet to load it from.
      setState((prev) => (prev.chatId === chatId ? prev : { chatId, list: prev.list, loaded: true }))
      return
    }

    // A reply is still running for this chat (the user navigated away while it
    // was generating). The connection left behind is dropped and the turn is
    // followed afresh from its stream, so the reply and any card it is waiting
    // on show straight away. A turn whose run has not started yet (an upload
    // still going out) cannot be dropped, so that one is waited for. Either way
    // the cached history predates the message they just sent, so it is not shown.
    const reopened = detachStream(chatId)
    const pendingStream = getStreamCompletion(chatId)
    const cached = reopened || pendingStream || !cacheEnabled ? undefined : readChatHistory(chatId)

    if (cached) {
      // Render the thread immediately; revalidate underneath if it has aged.
      cursorRef.current = cached.cursor
      pagesRef.current = cached.pages
      setState({ chatId, list: cached.messages, loaded: true })
      setHasMoreMessages(cached.hasMore)
      setHistoryLoadId((n) => n + 1)

      // A paginated history is served as-is. Revalidating would refetch only
      // the newest page and collapse the thread back to it, throwing away the
      // older pages the user scrolled up for; merging a first page into older
      // ones can't be done safely while edits and deletes can change them.
    } else {
      cursorRef.current = undefined
      pagesRef.current = 1
      setState({ chatId, list: [], loaded: false })
      setHasMoreMessages(false)
    }

    // A refresh behind a rendered thread stays silent: no skeleton, and on
    // failure no toast or error state, because there is already content to read.
    const background = Boolean(cached)

    let cancelled = false

    const load = async () => {
      loadingRef.current = true
      if (!background) setIsLoadingMessages(true)
      try {
        if (pendingStream) await waitForChatStreams(chatId, 90_000)
        if (cancelled) return
        const result = await fetchHistory(chatId)
        if (cancelled) return
        // A turn that started while this was in flight owns the list now;
        // installing the server's copy would delete the message being sent and
        // orphan the stream writing into it.
        if (background && (getStreamCompletion(chatId) || stateRef.current.list.some(isPendingLocal))) return
        install(chatId, result.list, { hasMore: result.hasMore, cursor: result.cursor, runningId: result.runningId })
      } catch (err) {
        logger.error("[useChatState] Failed to load messages", err)
        if (cancelled || background) return
        const message = err instanceof Error ? err.message : "Failed to load messages"
        toast.error(message)
        setMessagesLoadError(message)
      } finally {
        if (!cancelled && !background) setIsLoadingMessages(false)
        loadingRef.current = false
      }
    }

    if (cached && (!isHistoryStale(cached) || cached.pages > 1)) {
      // The cached thread stands, unless a turn is running in this chat (started
      // in another tab or before a reload): then it is refetched to follow the reply.
      void getChatStreamId(chatId).then((runningId) => {
        if (!cancelled && runningId && !getStreamCompletion(chatId)) void load()
      }).catch(() => {})
    } else {
      void load()
    }

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- install/fetchHistory are stable; re-running on anything but chatId would refetch mid-thread
  }, [chatId])

  // ── Write-back ─────────────────────────────────────────────────────────────

  // Mirror the live list into the cache so returning to this chat renders it
  // without a round trip. Skipped while a turn is in flight: a half-written
  // reply or an un-sent optimistic bubble must not be what the user comes back
  // to. The stream's own completion re-runs this (see streamEndTick).
  useEffect(() => {
    if (!cacheEnabled) return
    const owner = state.chatId
    if (!owner || !state.loaded) return
    if (getStreamCompletion(owner) || state.list.some(isPendingLocal)) return
    updateCachedMessages(owner, state.list, {
      hasMore: hasMoreMessages,
      cursor: cursorRef.current,
      pages: pagesRef.current,
    })
  }, [state, hasMoreMessages, streamEndTick, cacheEnabled])

  // Re-run the write-back once a reply for the shown chat has ended.
  useEffect(() => {
    if (!cacheEnabled) return
    return subscribeStreams((event) => {
      if (event.type === "end" && event.chatId === stateRef.current.chatId) {
        setStreamEndTick((n) => n + 1)
      }
    })
  }, [cacheEnabled])

  // ── Pagination ─────────────────────────────────────────────────────────────

  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingRef.current || !hasMoreMessages) return
    loadingRef.current = true
    try {
      const res = await getChatMessages(chatId, cursorRef.current)
      cursorRef.current = res.next_cursor ?? undefined
      pagesRef.current += 1
      setMessages((prev) => [...toUIMessages(res.messages), ...prev])
      setHasMoreMessages(res.has_more)
    } catch (err) {
      logger.error("[useChatState] Failed to load more messages", err)
      toast.error(err instanceof Error ? err.message : "Failed to load more messages")
    } finally {
      loadingRef.current = false
    }
  }, [chatId, hasMoreMessages, setMessages])

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  // Object URLs minted for the previews above. They stay valid for as long as the
  // optimistic message is on screen — the saved message that replaces it carries the
  // backend's own link — and are released when the chat goes away, so a long session
  // of sending images doesn't hold every one of them in memory.
  const localPreviewUrls = useRef<string[]>([])
  useEffect(() => () => {
    for (const url of localPreviewUrls.current) URL.revokeObjectURL(url)
    localPreviewUrls.current = []
  }, [])

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
        ? files.map((f, i) => {
            const isImage = (f.type || "").startsWith("image/")
            // An image is shown from the local file straight away, so the sent
            // message looks the same the moment it appears as it does after a
            // reload. Without this it spent the whole upload as a generic
            // document chip and only became a picture once history re-read it.
            const localUrl = isImage ? URL.createObjectURL(f) : undefined
            if (localUrl) localPreviewUrls.current.push(localUrl)
            return {
              id:              `opt-att-${i}-${Date.now()}`,
              file_name:       f.name,
              file_type:       f.type || "application/octet-stream",
              file_size:       f.size,
              uploading:       true,
              uploadProgress:  0,
              ...(localUrl ? { url: localUrl, localPreview: true as const } : {}),
            }
          })
        : undefined,
      mentionedPins: mentionedPins && mentionedPins.length > 0 ? mentionedPins : undefined,
    }
    setMessages((prev) => [...prev, msg])
    return id
  }, [chatId, setMessages])

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
  }, [chatId, setMessages])

  const rollbackLast = useCallback((n: number) => {
    setMessages((prev) => prev.slice(0, prev.length - n))
  }, [setMessages])

  /** Empties the thread and forgets its cached copy — the emptied list is a
   *  local reset, not a history worth restoring on the next visit. */
  const clearMessages = useCallback(() => {
    const owner = stateRef.current.chatId
    if (owner && cacheEnabled) dropChatHistory(owner)
    // loaded: false so the write-back does not immediately re-create the entry
    // that was just dropped, as an empty one.
    setState((prev) => ({ ...prev, list: [], loaded: false }))
  }, [cacheEnabled])

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
      const result = await fetchHistory(chatId)
      install(chatId, result.list, { hasMore: result.hasMore, cursor: result.cursor, runningId: result.runningId })
    } catch (err) {
      logger.error("[useChatState] Failed to refresh messages", err)
      const message = err instanceof Error ? err.message : "Failed to refresh messages"
      toast.error(message)
      setMessagesLoadError(message)
    } finally {
      setIsLoadingMessages(false)
      loadingRef.current = false
    }
  }, [chatId, fetchHistory, install])

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
    historyLoadId,
    runningMessageId,
  }
}
