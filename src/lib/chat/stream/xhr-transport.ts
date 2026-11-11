import { CHAT_CREATE_FIELDS, CHAT_STREAM_FIELDS, keepAcceptedFields } from "@/lib/chat-form-fields"
import { clientGeoHeaders } from "@/lib/geo-headers"
import { logger } from "@/lib/logger"
import { friendlyModelError } from "@/lib/model-error"
import { AuthExpiredError, ConnectionDroppedError, FriendlyStreamError, isAuthErrorText, streamFailureMessage } from "./stream-errors"
import type { StreamTarget } from "./stream-request"

export interface XhrStreamRequest {
  target: StreamTarget
  /** Bearer token for a direct-to-backend send. */
  directToken: string | null
  fd: FormData
  /** Only for the failure logs. */
  chatId: string | null
  /** Set when the request should report upload progress (it carries files). */
  onUploadProgress?: (pct: number) => void
  hasFiles: boolean
  /** The XHR in flight, or null once it has settled — kept by the caller so Stop can abort it. */
  setXhr: (xhr: XMLHttpRequest | null) => void
  /** The upload finished: the response stream starts now. */
  onUploadEnd: () => void
  /** Every progress tick, before its text is read. */
  onProgress: () => void
  /** New response text; `flush` asks the decoder to emit a final event without its trailing delimiter. */
  onText: (text: string, flush?: boolean) => void
  onHeaderChatId: (chatId: string) => void
  /** A user Stop, so a dropped connection isn't reported as a failure. */
  isStopRequested: () => boolean
  /** A follow's stream answered: it owns the reply from here, and replays the
   *  turn from its first event, so the reply starts over with it. */
  onFollowAttached?: () => void
  /** A follow that never reached the stream, with the status that refused it
   *  (404 = the turn ended while nobody was reading). */
  onFollowFailed?: (status: number) => void
}

/**
 * Sends the stream request over XHR (for real upload progress) and feeds the
 * response text to `onText` as it arrives. Resolves when the response ends or
 * the request is aborted; rejects with a FriendlyStreamError or
 * AuthExpiredError when it fails.
 */
export function sendStreamRequest(req: XhrStreamRequest): Promise<void> {
  const { target, fd, chatId, directToken } = req
  const { useDirectBackend, resolvedEndpoint, isExistingChat, resume, follow } = target
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const xhr = new XMLHttpRequest()
    // A failed request reaches DONE and then fires `error` (and, when the upload
    // hadn't finished, the upload's `loadend`). It settles once, at the first:
    // the later events must not log the failure again or report the stream as
    // started again — that left a failed send looking busy (Stop, no Retry, the
    // queue held) when the connection failed before the upload completed.
    let settled = false
    const resolve = () => {
      settled = true
      resolvePromise()
    }
    const reject = (error: Error) => {
      settled = true
      rejectPromise(error)
    }
    req.setXhr(xhr)

    xhr.open(follow ? "GET" : "POST", resolvedEndpoint)
    if (useDirectBackend) {
      // Talking straight to the backend origin — carry credentials and the
      // bearer token the proxy would otherwise have attached server-side.
      xhr.withCredentials = true
      if (directToken) xhr.setRequestHeader("Authorization", `Bearer ${directToken}`)
    }

    // Forward the user's timezone/locale/location so the backend resolves
    // "today" in their zone and knows where they are. This XHR path bypasses
    // apiClient, so set them here; the proxy route (or the backend directly)
    // reads them via extract_geo.
    for (const [name, value] of Object.entries(clientGeoHeaders())) {
      xhr.setRequestHeader(name, value)
    }

    // Report real browser→proxy upload progress per file byte count
    if (req.hasFiles && req.onUploadProgress) {
      const onUploadProgress = req.onUploadProgress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && e.total > 0) {
          // Cap at 99 so the caller can set 100 only on confirmed completion
          onUploadProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
        }
      })
    }

    // Upload finished → signal 100%, enter SSE streaming phase
    xhr.upload.addEventListener("loadend", () => {
      if (settled) return
      req.onUploadProgress?.(100)
      req.onUploadEnd()
    })

    let headersHandled = false
    let processedLength = 0
    // A non-2xx body is a JSON error, not an event stream: kept out of the SSE parser.
    const failed = () => xhr.status > 0 && (xhr.status < 200 || xhr.status >= 300)

    // onprogress fires for every incoming chunk of streaming data and is
    // more reliable than relying on onreadystatechange LOADING events alone.
    xhr.onprogress = () => {
      if (settled) return
      req.onProgress()
      if (failed()) return
      const text = xhr.responseText
      if (text.length > processedLength) {
        req.onText(text.slice(processedLength))
        processedLength = text.length
      }
    }

    xhr.onreadystatechange = () => {
      // Handle response headers once
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && !headersHandled) {
        headersHandled = true
        // A failed request is reported at DONE: the error body hasn't arrived yet here (responseText
        // is always empty), and the backend's own message (e.g. a Library file that isn't ready)
        // is only readable once it has.
        if (failed()) return
        // The follow reached the running turn's stream.
        if (follow && xhr.status > 0) req.onFollowAttached?.()
        const headerChatId =
          xhr.getResponseHeader("X-Chat-Id") ?? xhr.getResponseHeader("x-chat-id")
        if (headerChatId) req.onHeaderChatId(headerChatId)
      }

      if (xhr.readyState === XMLHttpRequest.DONE) {
        req.setXhr(null)
        // Process any data that onprogress may not have seen in the final chunk
        const text = xhr.responseText
        if (!failed() && text.length > processedLength) {
          req.onText(text.slice(processedLength))
          processedLength = text.length
        }
        // Flush a complete final event even if the server omitted the
        // trailing blank-line delimiter.
        if (!failed()) req.onText("", true)
        if (xhr.status === 0 && !req.isStopRequested()) {
          logger.error("[useStreamingChat] Connection dropped mid-stream", {
            chatId, isExistingChat, endpoint: resolvedEndpoint,
          })
          reject(new ConnectionDroppedError())
        } else if (failed()) {
          const rawText = xhr.responseText || `Request failed with status ${xhr.status}`
          req.onFollowFailed?.(xhr.status)
          // A follow that finds no running turn is the turn having ended, not a failure.
          if (!(follow && xhr.status === 404)) {
            logger.error("[useStreamingChat] Stream request failed", {
              status: xhr.status, chatId, isExistingChat, endpoint: resolvedEndpoint, responseText: xhr.responseText,
            })
          }
          if (xhr.status === 401 || isAuthErrorText(rawText.toLowerCase())) {
            reject(new AuthExpiredError())
          } else {
            reject(new FriendlyStreamError(streamFailureMessage(rawText, xhr.status, resolvedEndpoint)))
          }
        } else {
          resolve()
        }
      }
    }

    // Distinguish a user-initiated abort (handleStopGeneration → xhr.abort())
    // from a network error so we resolve cleanly instead of rejecting.
    xhr.onabort = () => {
      if (settled) return
      req.setXhr(null)
      resolve()
    }

    xhr.onerror = () => {
      if (settled) return
      req.setXhr(null)
      logger.error("[useStreamingChat] XHR network error", {
        chatId, isExistingChat, endpoint: resolvedEndpoint,
      })
      reject(new ConnectionDroppedError())
    }

    if (follow) {
      // Nothing to send: the stream replays the turn that is already running.
      xhr.send(null)
    } else if (resume) {
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.send(JSON.stringify({ prompt_id: resume.promptId, response: resume.response }))
    } else {
      // A direct send skips /api/chat, so drop here what the backend would refuse.
      if (useDirectBackend) keepAcceptedFields(fd, isExistingChat ? CHAT_STREAM_FIELDS : CHAT_CREATE_FIELDS)
      // One key per send: the backend refuses a repeat of the same send (`409 already_sent`) instead of answering twice.
      xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID())
      xhr.send(fd)
    }
  })
}
