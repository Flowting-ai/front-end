import { type NextRequest } from "next/server"

/**
 * Same-origin streaming proxy to the backend API.
 *
 * Replaces the previous `next.config.ts` rewrite (which buffered chunked
 * responses in `next dev` / Turbopack, breaking Brain SSE). Route handlers
 * stream both ways: we pass `req.body` upstream as a ReadableStream and pass
 * `upstream.body` back to the browser unchanged.
 *
 * The browser still calls `/api/backend/<path>` exactly as before — only
 * the transport changes.
 */

export const dynamic = "force-dynamic"
// Node runtime (not Edge): we need undici's streaming body / `duplex: 'half'`
// support and longer-lived connections for SSE turns that can run minutes.
export const runtime = "nodejs"

const UPSTREAM = (process.env.SERVER_URL || "http://localhost:8000").replace(/\/$/, "")

// Hop-by-hop request headers that must not be forwarded to the upstream.
// `cookie` is dropped specifically: the upstream API authenticates via
// Bearer token, and forwarding the Next/Auth0 session cookie would leak it.
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "cookie",
])

// Response headers that confuse the browser when paired with a streamed body
// (or that we want to rewrite ourselves).
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
])

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params
  const search = new URL(req.url).search
  const target = `${UPSTREAM}/${path.join("/")}${search}`

  const headers = new Headers()
  for (const [key, value] of req.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  }

  const init: RequestInit & { duplex?: "half" } = {
    method:   req.method,
    headers,
    redirect: "manual",
    cache:    "no-store",
  }

  // GET / HEAD have no body. For everything else, stream the request body
  // straight through — required by `fetch` when `body` is a ReadableStream.
  if (req.body && req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body
    init.duplex = "half"
  }

  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch (err) {
    console.error("[backend-proxy] upstream fetch failed", target, err)
    return new Response(
      JSON.stringify({ detail: "Upstream unreachable" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }

  const responseHeaders = new Headers()
  for (const [key, value] of upstream.headers.entries()) {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  }

  // For SSE specifically, force-disable any downstream buffering. `next start`
  // and most CDNs honour `X-Accel-Buffering: no`; the Cache-Control hint
  // covers the rest.
  if (responseHeaders.get("content-type")?.includes("text/event-stream")) {
    responseHeaders.set("Cache-Control", "no-cache, no-transform")
    responseHeaders.set("X-Accel-Buffering", "no")
  }

  return new Response(upstream.body, {
    status:     upstream.status,
    statusText: upstream.statusText,
    headers:    responseHeaders,
  })
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
}
