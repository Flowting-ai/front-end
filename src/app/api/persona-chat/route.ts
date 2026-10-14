import { type NextRequest } from "next/server"
import { BACKEND_BASE, getSessionToken, newRequestId, routeError, upstreamFetch } from "@/lib/server/backend"
import { logger } from "@/lib/logger"
import { forwardGeoHeaders } from "@/lib/geo-headers"
import { firstIssue, formFields, personaChatFormSchema } from "@/lib/server/chat-forms"

export const dynamic = "force-dynamic"
// Matches the /api/chat proxy's ceiling — see that file for the Vercel Fluid-compute rationale.
export const maxDuration = 800


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
 *   libraryFileIds - optional JSON array of Library file ids attached to the message
 *   connectorSlugs - optional connector slugs (repeated field)
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = await getSessionToken()
  if (!token) return routeError(401, "unauthorized", "Sign in to continue")

  // ── Parse request ───────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return routeError(400, "bad_request", "Invalid form data")
  }

  // Every field is checked against lib/server/chat-forms.ts before anything is forwarded.
  const fields = formFields(formData, ["connectorSlugs"])
  fields.repoId ??= fields.personaId ?? ""
  if (!fields.repoId) return routeError(400, "bad_request", "repoId is required")
  const parsed = personaChatFormSchema.safeParse(fields)
  if (!parsed.success) return routeError(400, "bad_request", firstIssue(parsed.error))
  const { repoId, chatId, input, modelId, connectorSlugs, libraryFileIds } = parsed.data
  if (!input.trim() && !libraryFileIds) {
    return routeError(400, "bad_request", "A message or a file is required")
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  // Both ids are safe single path segments per the schema.
  const isExistingChat = Boolean(chatId && !chatId.startsWith("temp-"))
  const endpoint = isExistingChat
    ? `${BACKEND_BASE}/persona/${repoId}/chats/${chatId}/stream`
    : `${BACKEND_BASE}/persona/${repoId}/chats/create`

  // ── Build body for backend ───────────────────────────────────────────────────
  // Always use multipart/form-data — the backend endpoint declares File() params
  // which require multipart. Unlike the client-side buildStreamBody helper (which
  // avoids multipart to prevent Next.js dev-server buffering the REQUEST body),
  // this proxy already fully reads the incoming FormData before forwarding, so
  // there's no SSE-breaking buffering concern here.
  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "text/event-stream",
    ...forwardGeoHeaders(request),
  }

  const fd = new FormData()
  fd.append("input", input)
  if (libraryFileIds) fd.append("libraryFileIds", libraryFileIds)
  connectorSlugs.forEach((s) => fd.append("connector_slugs", s))
  if (modelId) fd.append("model_id", modelId)
  const body: BodyInit = fd

  // ── Proxy request ────────────────────────────────────────────────────────────
  // One id per request, sent upstream and returned as X-Request-Id; failures are
  // logged as structured lines with status and latency (upstreamFetch).
  const requestId = newRequestId()
  let backendResponse: Response
  try {
    backendResponse = await upstreamFetch("api/persona-chat", endpoint, {
      method: "POST",
      headers: requestHeaders,
      body,
    }, requestId)
  } catch {
    return routeError(503, "upstream_unreachable", "Service unavailable")
  }

  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => "")
    logger.error("[api/persona-chat] Backend error", { request_id: requestId, status: backendResponse.status, body: text.slice(0, 500) })
    // The backend's own error body is passed through: the client reads its
    // detail (credit exhaustion, retired model) to pick the message.
    if (text) return new Response(text, { status: backendResponse.status })
    return routeError(backendResponse.status >= 400 ? backendResponse.status : 502, "upstream_error", "Backend error")
  }

  // ── Stream the response ────────────────────────────────────────────────────
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Request-Id": requestId,
  }

  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  const backendReader = backendResponse.body.getReader()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await backendReader.read()
          if (done) {
            try { controller.close() } catch { /* already closed */ }
            break
          }
          controller.enqueue(value)
        }
      } catch {
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      backendReader.cancel().catch(() => {})
    },
  })

  return new Response(stream, { headers: responseHeaders })
}
