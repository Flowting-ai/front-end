import { type NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

/**
 * POST /api/persona-chat
 *
 * Server-side proxy for persona chat streaming. Routes to the persona-specific
 * backend endpoints (/persona/{repoId}/chats/create or /persona/{repoId}/chats/{chatId}/stream).
 *
 * Accepts multipart/form-data with fields:
 *   input     - required user message
 *   repoId    - required persona repo ID
 *   chatId    - existing chat ID (omit for new chats)
 *   files     - zero or more File parts (uploaded attachments)
 *   connectorSlugs - optional connector slugs (repeated field)
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

  // ── Parse request ───────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response("Bad Request: invalid form data", { status: 400 })
  }

  const repoId       = (formData.get("repoId") as string | null) || (formData.get("personaId") as string | null) || null
  const chatId       = (formData.get("chatId") as string | null) || null
  const input        = (formData.get("input") as string | null) ?? ""
  const clientFiles  = formData.getAll("files").filter((f): f is File => f instanceof File)
  const connectorSlugs = formData.getAll("connectorSlugs").map(s => String(s)).filter(Boolean)

  if (!repoId) {
    return new Response("Bad Request: repoId required", { status: 400 })
  }
  if (!input.trim() && clientFiles.length === 0) {
    return new Response("Bad Request: input or files required", { status: 400 })
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  const isExistingChat = Boolean(chatId && !chatId.startsWith("temp-"))
  const endpoint = isExistingChat
    ? `${BACKEND_BASE}/persona/${repoId}/chats/${chatId}/stream`
    : `${BACKEND_BASE}/persona/${repoId}/chats/create`

  // ── Build body for backend ───────────────────────────────────────────────────
  // Use FormData when files are present, otherwise use urlencoded (avoids
  // multipart buffering issues that can break SSE streaming).
  let body: BodyInit
  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "text/event-stream",
  }

  if (clientFiles.length > 0) {
    const fd = new FormData()
    fd.append("input", input)
    clientFiles.forEach((f) => fd.append("files", f))
    connectorSlugs.forEach((s) => fd.append("connector_slugs", s))
    body = fd
  } else {
    const params = new URLSearchParams()
    params.append("input", input)
    connectorSlugs.forEach((s) => params.append("connector_slugs", s))
    body = params.toString()
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded"
  }

  // ── Proxy request ────────────────────────────────────────────────────────────
  let backendResponse: Response
  try {
    backendResponse = await fetch(endpoint, {
      method: "POST",
      headers: requestHeaders,
      body,
    })
  } catch (err) {
    logger.error("[api/persona-chat] Network error reaching backend", err)
    return new Response("Service unavailable", { status: 503 })
  }

  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => "")
    logger.error("[api/persona-chat] Backend error", backendResponse.status, text)
    return new Response(text || "Backend error", { status: backendResponse.status })
  }

  // ── Stream the response ────────────────────────────────────────────────────
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  }

  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  const encoder = new TextEncoder()
  const backendReader = backendResponse.body.getReader()

  let keepAliveId: ReturnType<typeof setInterval> | null = null

  const resetKeepAlive = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (keepAliveId !== null) clearInterval(keepAliveId)
    keepAliveId = setInterval(() => {
      try { controller.enqueue(encoder.encode(": ka\n\n")) } catch { /* stream already closed */ }
    }, 15_000)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      resetKeepAlive(controller)
      try {
        while (true) {
          // eslint-disable-next-line no-await-in-loop
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
