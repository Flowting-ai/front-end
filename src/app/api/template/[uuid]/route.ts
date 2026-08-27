import { type NextRequest } from "next/server"
import { z } from "zod"
import { auth0 } from "@/lib/auth0"

export const dynamic = "force-dynamic"

const BACKEND_BASE = (process.env.SERVER_URL ?? "").replace(/\/+$/, "")

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
 */
const SANDBOX_HEADERS = {
  "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-forms;",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ uuid: string }> },
): Promise<Response> {
  const parsed = ParamsSchema.safeParse(await ctx.params)
  if (!parsed.success) {
    return new Response("Not a template id", { status: 400 })
  }

  const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined
  let token: string
  try {
    token = (await auth0.getAccessToken({ audience })).token
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${BACKEND_BASE}/templates/${parsed.data.uuid}/html`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  } catch {
    return new Response("Failed to load template", { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...SANDBOX_HEADERS },
  })
}
