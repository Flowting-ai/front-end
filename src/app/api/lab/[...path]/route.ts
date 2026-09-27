import { type NextRequest } from "next/server"

/**
 * Same-origin pass-through to the local routing lab (SouvenirAI
 * scripts/routing_lab.py), so the /compare page stays inside the app's CSP.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LAB = "http://127.0.0.1:8777"

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params
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
