import { type NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
// Allow up to 5 minutes for Claude extended-thinking + agentic multi-round responses.
// Without this Vercel serverless cuts the request at 10 s (Hobby) / 60 s (Pro).
export const maxDuration = 300

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

/**
 * POST /api/chat
 *
 * Server-side proxy: reads the Auth0 access token, builds a multipart/form-data
 * request, and pipes the backend SSE stream back to the browser.
 *
 * Accepts multipart/form-data with fields:
 *   input              - required user message
 *   chatId             - existing chat ID (omit or "temp-*" for new chats)
 *   modelId            - optional model override
 *   pinIds             - optional JSON-stringified pin ID array
 *   referenceMessageId - optional reference message for context
 *   webSearch          - "true" to enable web search tool
 *   files              - zero or more File parts (uploaded attachments)
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined
  let token: string
  try {
    const result = await auth0.getAccessToken({ audience })
    token = result.token
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  // ── Parse request (multipart/form-data) ─────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response("Bad Request: invalid form data", { status: 400 })
  }

  const chatId             = (formData.get("chatId") as string | null) || null
  const input              = (formData.get("input") as string | null) ?? ""
  const modelId            = formData.get("modelId") as string | null
  const algorithm          = formData.get("algorithm") as string | null
  const pinIds             = formData.get("pinIds") as string | null
  const referenceMessageId = formData.get("referenceMessageId") as string | null
  const webSearch          = formData.get("webSearch") === "true"
  const personaId          = formData.get("personaId") as string | null
  const clientFiles        = formData.getAll("files").filter((f): f is File => f instanceof File)

  if (!input.trim() && clientFiles.length === 0) {
    return new Response("Bad Request: input or files required", { status: 400 })
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  const isExistingChat = Boolean(chatId && !String(chatId).startsWith("temp-"))
  const endpoint = personaId
    ? isExistingChat && chatId
      ? `${BACKEND_BASE}/persona/${personaId}/chats/${chatId}/stream`
      : `${BACKEND_BASE}/persona/${personaId}/chats/create`
    : isExistingChat && chatId
      ? `${BACKEND_BASE}/chats/${chatId}/stream`
      : `${BACKEND_BASE}/chats/create`

  // ── Build FormData for backend ───────────────────────────────────────────────
  const fd = new FormData()
  fd.append("input", input)
  if (modelId) fd.append("model_id", modelId)
  if (algorithm) fd.append("algorithm", algorithm)
  if (pinIds)  fd.append("pin_ids", pinIds)
  if (referenceMessageId && isExistingChat) fd.append("reference_message_id", referenceMessageId)
  if (webSearch) fd.append("web_search", "true")
  clientFiles.forEach((f) => fd.append("files", f))

  // ── Proxy request ────────────────────────────────────────────────────────────
  let backendResponse: Response
  try {
    backendResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: fd,
    })
  } catch (err) {
    logger.error("[api/chat] Network error reaching backend", err)
    return new Response("Service unavailable", { status: 503 })
  }

  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => "")
    logger.error("[api/chat] Backend error", backendResponse.status, text)
    return new Response(text || "Backend error", { status: backendResponse.status })
  }

  // ── Stream the response with a TransformStream to prevent buffering ────────
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  }

  // Forward chat ID header for new chats so the client can update the URL
  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  const encoder = new TextEncoder()
  const backendReader = backendResponse.body.getReader()

  // Track the keepalive timer outside the ReadableStream so cancel() can clear it
  let keepAliveId: ReturnType<typeof setInterval> | null = null

  // Reset (or start) the keepalive timer.  Sends an SSE comment every 15 s while
  // the backend is silent so that load-balancers / intermediate proxies do NOT
  // close what they perceive as an idle connection (common cause of Claude streams
  // being cut off during its extended-thinking phase).
  const resetKeepAlive = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (keepAliveId !== null) clearInterval(keepAliveId)
    keepAliveId = setInterval(() => {
      try { controller.enqueue(encoder.encode(": ka\n\n")) } catch { /* stream already closed */ }
    }, 15_000)
  }

  // Use a ReadableStream with explicit start/cancel so the backend connection is
  // properly released when the client disconnects, and the keepalive timer is
  // always cleared on teardown.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      resetKeepAlive(controller)
      try {
        while (true) {
          // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential stream reader; chunks must arrive in order
          const { value, done } = await backendReader.read()
          if (done) {
            try { controller.close() } catch { /* already closed */ }
            break
          }
          controller.enqueue(value)
          // Each received chunk resets the keepalive timer so it only fires
          // during genuine idle gaps (e.g. Claude thinking silently).
          resetKeepAlive(controller)
        }
      } catch {
        // Backend stream error or client disconnect – close cleanly
        try { controller.close() } catch { /* already closed */ }
      } finally {
        if (keepAliveId !== null) { clearInterval(keepAliveId); keepAliveId = null }
      }
    },
    cancel() {
      // Client disconnected – stop reading from the backend immediately
      if (keepAliveId !== null) { clearInterval(keepAliveId); keepAliveId = null }
      backendReader.cancel().catch(() => {})
    },
  })

  return new Response(stream, { headers: responseHeaders })
}
