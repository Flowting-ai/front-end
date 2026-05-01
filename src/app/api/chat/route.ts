import { type NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

interface ChatRequestBody {
  chatId?: string | null
  input: string
  modelId?: string | number | null
  memoryPercentage?: number
}

/**
 * POST /api/chat
 *
 * Server-side proxy: reads the Auth0 access token, builds a multipart/form-data
 * request, and pipes the backend SSE stream back to the browser.
 *
 * The auth token never leaves the server — the browser only sees the SSE events.
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

  // ── Parse request ────────────────────────────────────────────────────────────
  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return new Response("Bad Request: invalid JSON body", { status: 400 })
  }

  const { chatId, input, modelId, memoryPercentage = 0.2 } = body

  if (!input?.trim()) {
    return new Response("Bad Request: input is required", { status: 400 })
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  const isExistingChat = Boolean(chatId && !String(chatId).startsWith("temp-"))
  const endpoint = isExistingChat && chatId
    ? `${BACKEND_BASE}/chats/${chatId}/stream`
    : `${BACKEND_BASE}/chats/create`

  // ── Build FormData for backend ───────────────────────────────────────────────
  const fd = new FormData()
  fd.append("input", input)
  if (modelId !== null && modelId !== undefined) {
    fd.append("model_id", String(modelId))
  }
  fd.append("memory_percentage", String(memoryPercentage))

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

  // ── Build response headers ────────────────────────────────────────────────────
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  }

  // Forward chat ID header for new chats so the client can update the URL
  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  return new Response(backendResponse.body, { headers: responseHeaders })
}
