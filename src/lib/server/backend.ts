import { auth0 } from "@/lib/auth0"
import { logger } from "@/lib/logger"

/**
 * Shared pieces for the server route handlers that call the backend
 * (`/api/chat`, `/api/persona-chat`, `/api/template`). One place for the base
 * URL, the session token, id checks and the error shape, so each route does
 * not re-decide them.
 */

export const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

/** An id that is interpolated into a backend path: one plain segment, nothing else. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value)
}

/** The session's backend access token, or null when there is no usable session. */
export async function getSessionToken(): Promise<string | null> {
  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined
  try {
    const { token } = await auth0.getAccessToken({ audience })
    return token || null
  } catch {
    return null
  }
}

/** One id per proxied request: sent to the backend as X-Request-Id and logged with the outcome. */
export function newRequestId(): string {
  return crypto.randomUUID()
}

/**
 * `fetch` to the backend with a request id and one structured log line per
 * outcome that needs attention: `{ event: "upstream", route, request_id,
 * status, ms }` for a non-2xx answer, `upstream_unreachable` for a network
 * failure (then rethrown). Successful calls are not logged. Bodies, headers and
 * URLs with ids are never logged.
 */
export async function upstreamFetch(
  route: string,
  url: string,
  init: RequestInit & { headers?: Record<string, string> },
  requestId: string = newRequestId(),
): Promise<Response> {
  const started = Date.now()
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { ...init.headers, "X-Request-Id": requestId } })
  } catch (error) {
    safeLog("upstream_unreachable", { route, request_id: requestId, ms: Date.now() - started, error }, "error")
    throw error
  }
  if (!response.ok) safeLog("upstream", { route, request_id: requestId, status: response.status, ms: Date.now() - started })
  return response
}

/** Logging must never change what the route returns. */
function safeLog(name: string, fields: Record<string, unknown>, level?: "warn" | "error") {
  try { logger.event(name, fields, level) } catch { /* ignore */ }
}

export type RouteErrorCode =
  | "unauthorized"
  | "bad_request"
  | "not_found"
  | "upstream_unreachable"
  | "upstream_error"
  | "timeout"
  | "payload_too_large"

/**
 * The error shape every route handler returns for errors it produces itself,
 * matching the proxy's 401: `{ error: { code, message } }`. Errors the backend
 * produced are passed through as-is, since the client reads their detail
 * (credit exhaustion, retired model).
 */
export function routeError(status: number, code: RouteErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  )
}
