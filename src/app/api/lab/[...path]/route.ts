import { type NextRequest } from "next/server"

/**
 * Same-origin pass-through to the local routing lab (SouvenirAI
 * scripts/routing_lab.py), so the /compare page stays inside the app's CSP.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LAB = "http://127.0.0.1:8777"

// The only routes the /compare page calls: route/old, route/new, cost/<chatId>.
const KNOWN_PATH = /^(route\/(old|new)|cost\/[A-Za-z0-9_-]{1,128})$/

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  // A local dev tool: never forward from a deployed build.
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 })
  const { path } = await ctx.params
  if (!KNOWN_PATH.test(path.join("/"))) return new Response("Not found", { status: 404 })
  const upstream = await fetch(`${LAB}/${path.join("/")}`, {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: req.method === "GET" ? undefined : await req.text(),
    cache: "no-store",
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  })
}

export { handler as GET, handler as POST }
