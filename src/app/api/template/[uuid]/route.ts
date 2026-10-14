import { type NextRequest } from "next/server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { BACKEND_BASE, getSessionToken, routeError, type RouteErrorCode } from "@/lib/server/backend"
import {
  isTimeoutError,
  stateForStatus,
  TEMPLATE_FETCH_TIMEOUT_MS,
  TEMPLATE_ROUTE_ERRORS,
  type TemplateLoadState,
} from "@/lib/templates/template-view"

export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ uuid: z.uuid() })

/**
 * GET /api/template/<uuid>
 *
 * Serves one stored template's HTML for the `<iframe>` on /template/<uuid>.
 *
 * Authorization is the backend's call, not ours: it decides whether this
 * viewer is the creator or a member of the creator's organization. We forward
 * the access token and pass its verdict through unchanged.
 *
 * The body is model-written HTML, so it is served under a `sandbox` CSP. That
 * puts it on an opaque origin — its scripts still run, so charts, filters and
 * drill-downs work, but it cannot read the session of whoever opened it.
 *
 * These headers are deliberately identical to the /api/template override in
 * next.config.ts, which is what actually relaxes the app-wide
 * X-Frame-Options: DENY and frame-ancestors 'none' for this path. Repeating
 * them here means the sandbox survives even if this response is served
 * without that config rule applying.
 */
const SANDBOX_HEADERS = {
  "Content-Security-Policy":
    "sandbox allow-scripts allow-popups allow-forms; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
}

function templateError(code: RouteErrorCode, state: TemplateLoadState): Response {
  const { status, message } = TEMPLATE_ROUTE_ERRORS[state]
  return routeError(status, code, message)
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ uuid: string }> },
): Promise<Response> {
  const parsed = ParamsSchema.safeParse(await ctx.params)
  if (!parsed.success) {
    return routeError(400, "bad_request", "Not a template id")
  }

  const token = await getSessionToken()
  if (!token) return routeError(401, "unauthorized", "Sign in to continue")

  const { uuid } = parsed.data
  let upstream: Response
  try {
    upstream = await fetch(`${BACKEND_BASE}/templates/${uuid}/html`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPLATE_FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    const state = isTimeoutError(error) ? "timeout" : "error"
    logger.error("[api/template] Backend unreachable", uuid, state)
    return templateError(state === "timeout" ? "timeout" : "upstream_unreachable", state)
  }

  if (!upstream.ok || !upstream.body) {
    // The backend's body stays in the server log; the browser gets a fixed message.
    const detail = await upstream.text().catch(() => "")
    logger.error("[api/template] Backend error", uuid, upstream.status, detail.slice(0, 500))
    return templateError("upstream_error", upstream.ok ? "error" : stateForStatus(upstream.status))
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...SANDBOX_HEADERS },
  })
}
