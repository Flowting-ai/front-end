import { type NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

/**
 * POST /api/chat
 *
 * Server-side proxy: reads the Auth0 access token, builds a multipart/form-data
 * request, and pipes the backend SSE stream back to the browser.
 *
 * Accepts multipart/form-data with fields:
 *   input              — required user message
 *   chatId             — existing chat ID (omit or "temp-*" for new chats)
 *   modelId            — optional model override
 *   pinIds             — optional JSON-stringified pin ID array
 *   referenceMessageId — optional reference message for context
 *   webSearch          — "true" to enable web search tool
 *   files              — zero or more File parts (uploaded attachments)
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
  const pinIds             = formData.get("pinIds") as string | null
  const referenceMessageId = formData.get("referenceMessageId") as string | null
  const webSearch          = formData.get("webSearch") === "true"
  const clientFiles        = formData.getAll("files").filter((f): f is File => f instanceof File)

  if (!input.trim() && clientFiles.length === 0) {
    return new Response("Bad Request: input or files required", { status: 400 })
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  const isExistingChat = Boolean(chatId && !String(chatId).startsWith("temp-"))
  const endpoint = isExistingChat && chatId
    ? `${BACKEND_BASE}/chats/${chatId}/stream`
    : `${BACKEND_BASE}/chats/create`

  // ── Build FormData for backend ───────────────────────────────────────────────
  const fd = new FormData()
  fd.append("input", input)
  if (modelId) fd.append("model_id", modelId)
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

  // Pipe through a TransformStream to force chunk-by-chunk flushing
  // (prevents Next.js/Node from buffering the entire SSE stream)
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const reader = backendResponse.body.getReader()

  ;(async () => {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        await writer.write(value)
      }
    } catch {
      // Stream closed by client (abort) — ignore
    } finally {
      writer.close().catch(() => {})
    }
  })()

  return new Response(readable, { headers: responseHeaders })
}
