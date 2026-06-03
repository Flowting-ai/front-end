import { type NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"
import { forwardGeoHeaders } from "@/lib/geo-headers"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

/**
 * POST /api/brain-chat
 *
 * Server-side proxy for Brain chat turns that include file uploads.
 * Reads the Auth0 access token, re-assembles the multipart body on the server
 * (so FastAPI receives a complete request with content-length), and pipes
 * the backend SSE stream back to the browser.
 *
 * Accepts multipart/form-data with fields:
 *   input            - required user message
 *   chatId           - existing brain chat ID (omit for new chats)
 *   persona_id       - optional persona override
 *   pin_ids          - optional JSON-stringified pin ID array
 *   use_mistral_ocr  - "true" to enable Mistral OCR for document files
 *   files            - zero or more File parts (uploaded attachments)
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined
  let token: string
  try {
    const result = await auth0.getAccessToken({ audience })
    token = result.token
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  // ── Parse request ─────────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response("Bad Request: invalid form data", { status: 400 })
  }

  const chatId          = (formData.get("chatId") as string | null) || null
  const input           = (formData.get("input") as string | null) ?? ""
  const personaId       = formData.get("persona_id") as string | null
  const pinIds          = formData.get("pin_ids") as string | null
  const useMistralOcr   = formData.get("use_mistral_ocr") === "true"
  const clientFiles     = formData.getAll("files").filter((f): f is File => f instanceof File)

  // ── Resolve backend endpoint ──────────────────────────────────────────────────
  const isExistingChat = Boolean(chatId)
  const endpoint = isExistingChat && chatId
    ? `${BACKEND_BASE}/brain/${chatId}/stream`
    : `${BACKEND_BASE}/brain/create`

  // ── Build FormData for backend ────────────────────────────────────────────────
  const fd = new FormData()
  fd.append("input", input)
  if (personaId)     fd.append("persona_id", personaId)
  if (pinIds)        fd.append("pin_ids", pinIds)
  if (useMistralOcr) fd.append("use_mistral_ocr", "true")
  clientFiles.forEach((f) => fd.append("files", f))

  // ── Proxy to backend ──────────────────────────────────────────────────────────
  let backendResponse: Response
  try {
    backendResponse = await fetch(endpoint, {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        "text/event-stream",
        ...forwardGeoHeaders(request),
      },
      body: fd,
    })
  } catch (err) {
    logger.error("[api/brain-chat] Network error reaching backend", err)
    return new Response("Service unavailable", { status: 503 })
  }

  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => "")
    logger.error("[api/brain-chat] Backend error", backendResponse.status, text)
    return new Response(text || "Backend error", { status: backendResponse.status })
  }

  // ── Stream SSE response back ──────────────────────────────────────────────────
  const responseHeaders: Record<string, string> = {
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache, no-transform",
    "Connection":        "keep-alive",
    "X-Accel-Buffering": "no",
  }

  // Forward X-Chat-Id so the client can update the URL after a new chat starts
  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  const encoder       = new TextEncoder()
  const backendReader = backendResponse.body.getReader()

  let keepAliveId: ReturnType<typeof setInterval> | null = null
  const resetKeepAlive = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (keepAliveId !== null) clearInterval(keepAliveId)
    keepAliveId = setInterval(() => {
      try { controller.enqueue(encoder.encode(": ka\n\n")) } catch { /* stream closed */ }
    }, 15_000)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      resetKeepAlive(controller)
      try {
        while (true) {
          // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential stream reader
          const { value, done } = await backendReader.read()
          if (done) {
            try { controller.close() } catch { /* already closed */ }
            break
          }
          controller.enqueue(value)
          resetKeepAlive(controller)
        }
      } catch {
        try { controller.close() } catch { /* already closed */ }
      } finally {
        if (keepAliveId !== null) { clearInterval(keepAliveId); keepAliveId = null }
      }
    },
    cancel() {
      if (keepAliveId !== null) { clearInterval(keepAliveId); keepAliveId = null }
      backendReader.cancel().catch(() => {})
    },
  })

  return new Response(stream, { headers: responseHeaders })
}
