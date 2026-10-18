import { type NextRequest } from "next/server"
import { BACKEND_BASE, getSessionToken, newRequestId, routeError, upstreamFetch } from "@/lib/server/backend"
import { logger } from "@/lib/logger"
import { forwardGeoHeaders } from "@/lib/geo-headers"
import { chatFormSchema, firstIssue, formFields } from "@/lib/server/chat-forms"

export const dynamic = "force-dynamic"
// Allow up to Vercel's Fluid-compute ceiling for Claude extended-thinking +
// agentic multi-round responses. Without this Vercel serverless cuts the
// request at 10 s (Hobby) / 60 s (Pro, no Fluid) / 300 s (Pro, default Fluid).
export const maxDuration = 800


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
 *   toneId             - optional style/tone ID (e.g. "professional", "teaching")
 *   systemPrompt       - optional persona system instruction (explicit override)
 *   temperature        - optional persona temperature override
 *   files              - zero or more File parts (uploaded attachments)
 *   libraryFileIds     - optional JSON array of Library file ids attached to the message
 *   saveToLibrary      - optional "true"/"false": the auto-save answer for those files
 *   librarySourcesOff  - optional JSON array of Library file ids switched off for this chat
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = await getSessionToken()
  if (!token) return routeError(401, "unauthorized", "Sign in to continue")

  // ── Parse request (multipart/form-data) ─────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return routeError(400, "bad_request", "Invalid form data")
  }

  // Every field is checked against lib/server/chat-forms.ts before anything is forwarded.
  const parsed = chatFormSchema.safeParse(formFields(formData))
  if (!parsed.success) return routeError(400, "bad_request", firstIssue(parsed.error))
  const {
    chatId, input, modelId, algorithm, pinIds, referenceMessageId, replaceMessageId,
    webSearch, enable_thinking: thinking, effort, personaId, systemPrompt, temperature, toneId, libraryFileIds, saveToLibrary, librarySourcesOff,
  } = parsed.data
  const clientFiles = formData.getAll("files").filter((f): f is File => f instanceof File)

  if (!input.trim() && !libraryFileIds && clientFiles.length === 0) {
    return routeError(400, "bad_request", "A message or a file is required")
  }

  // ── Resolve endpoint ─────────────────────────────────────────────────────────
  // Persona is now applied as an overlay: we always route through the regular
  // /chats endpoints and pass persona_id as a body field. This lets style, web
  // search, pin folders, reasoning, etc. compose with a selected persona.
  // chatId is a safe single path segment (or a "temp-" placeholder) per the schema.
  const isExistingChat = Boolean(chatId && !chatId.startsWith("temp-"))
  const endpoint = isExistingChat && chatId
    ? `${BACKEND_BASE}/chats/${chatId}/stream`
    : `${BACKEND_BASE}/chats/create`

  // ── Build FormData for backend ───────────────────────────────────────────────
  const fd = new FormData()
  fd.append("input", input)
  if (algorithm) fd.append("algorithm", algorithm)
  else if (modelId) fd.append("model_id", modelId)
  if (pinIds)  fd.append("pin_ids", pinIds)
  if (referenceMessageId && isExistingChat) fd.append("reference_message_id", referenceMessageId)
  if (replaceMessageId && isExistingChat) fd.append("replace_message_id", replaceMessageId)
  if (webSearch) fd.append("web_search", "true")
  fd.append("thinking", thinking ? "true" : "false")
  if (thinking && effort) fd.append("effort", effort)
  if (personaId) fd.append("persona_id", personaId)
  if (systemPrompt) fd.append("system_prompt", systemPrompt)
  if (temperature !== undefined) fd.append("temperature", String(temperature))
  if (toneId) fd.append("tone_id", toneId)
  clientFiles.forEach((f) => fd.append("files", f))
  if (libraryFileIds) fd.append("libraryFileIds", libraryFileIds)
  if (saveToLibrary) fd.append("saveToLibrary", saveToLibrary)
  if (librarySourcesOff) fd.append("librarySourcesOff", librarySourcesOff)

  // ── Proxy request ────────────────────────────────────────────────────────────
  // One id per request, sent upstream and returned as X-Request-Id; failures are
  // logged as structured lines with status and latency (upstreamFetch).
  const requestId = newRequestId()
  let backendResponse: Response
  try {
    backendResponse = await upstreamFetch("api/chat", endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
        ...forwardGeoHeaders(request),
      },
      body: fd,
    }, requestId)
  } catch {
    return routeError(503, "upstream_unreachable", "Service unavailable")
  }

  if (!backendResponse.ok || !backendResponse.body) {
    const text = await backendResponse.text().catch(() => "")
    logger.error("[api/chat] Backend error", { request_id: requestId, status: backendResponse.status, body: text.slice(0, 500) })
    // The backend's own error body is passed through: the client reads its
    // detail (credit exhaustion, retired model) to pick the message.
    if (text) return new Response(text, { status: backendResponse.status })
    return routeError(backendResponse.status >= 400 ? backendResponse.status : 502, "upstream_error", "Backend error")
  }

  // ── Stream the response with a TransformStream to prevent buffering ────────
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Request-Id": requestId,
  }

  // Forward chat ID header for new chats so the client can update the URL
  const backendChatId =
    backendResponse.headers.get("X-Chat-Id") ??
    backendResponse.headers.get("x-chat-id")
  if (backendChatId) {
    responseHeaders["X-Chat-Id"] = backendChatId
  }

  const backendReader = backendResponse.body.getReader()

  // Use a ReadableStream with explicit start/cancel so the backend connection is
  // properly released when the client disconnects. The backend already emits
  // complete AG-UI stream_heartbeat frames; injecting comments here can split a
  // data line when a backend chunk ends mid-frame and corrupt its JSON.
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
        // Backend stream error or client disconnect – close cleanly
        try { controller.close() } catch { /* already closed */ }
      }
    },
    cancel() {
      // Client disconnected – stop reading from the backend immediately
      backendReader.cancel().catch(() => {})
    },
  })

  return new Response(stream, { headers: responseHeaders })
}
