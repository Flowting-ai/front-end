import { BACKEND_BASE } from "@/lib/server/backend"
import { checkServerEnv } from "@/lib/server/env"

export const dynamic = "force-dynamic"

const BACKEND_TIMEOUT_MS = 2_000

/**
 * GET /api/health — public liveness/readiness for uptime checks.
 * `config` reports missing/invalid variable NAMES (never values); `backend` is
 * whether GET <backend>/health answered within 2 s. 200 when both are fine,
 * 503 otherwise, so a load balancer or monitor can act on the status alone.
 */
export async function GET(): Promise<Response> {
  const config = checkServerEnv()
  let backend: "ok" | "unreachable" | "error" = "unreachable"
  if (BACKEND_BASE) {
    try {
      const res = await fetch(`${BACKEND_BASE}/health`, { cache: "no-store", signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) })
      backend = res.ok ? "ok" : "error"
    } catch {
      backend = "unreachable"
    }
  }
  const healthy = config.ok && backend === "ok"
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { config: config.ok ? "ok" : { missing: config.missing, invalid: config.invalid }, backend },
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  )
}
