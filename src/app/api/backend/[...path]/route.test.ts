import { afterEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/auth0", () => ({ auth0: {} }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), event: vi.fn() } }))
import { GET, POST } from "./route"

afterEach(() => vi.unstubAllGlobals())

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) })

describe("backend proxy", () => {
  it("strips the session cookie and hop-by-hop headers, keeps auth and adds a request id", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetch)
    const req = new Request("http://localhost/api/backend/chats?limit=5", {
      headers: { cookie: "appSession=secret", authorization: "Bearer t", connection: "keep-alive", "x-custom": "1" },
    })
    const res = await GET(req as NextRequest, ctx("chats"))
    const [url, init] = fetch.mock.calls[0]
    expect(url).toMatch(/\/chats\?limit=5$/)
    const sent = init.headers as Record<string, string>
    expect(sent.cookie).toBeUndefined()
    expect(sent.connection).toBeUndefined()
    expect(sent.authorization).toBe("Bearer t")
    expect(sent["x-custom"]).toBe("1")
    expect(sent["X-Request-Id"]).toMatch(/[0-9a-f-]{36}/)
    expect(init.redirect).toBe("manual")
    expect(res.headers.get("X-Request-Id")).toBe(sent["X-Request-Id"])
  })

  it("streams SSE with buffering disabled and drops content-length/encoding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("data: x\n\n", {
      headers: { "content-type": "text/event-stream", "content-length": "9", "content-encoding": "gzip" },
    })))
    const req = new Request("http://localhost/api/backend/stream", { method: "POST", body: "{}" })
    const res = await POST(req as NextRequest, ctx("stream"))
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(res.headers.get("X-Accel-Buffering")).toBe("no")
    expect(res.headers.get("content-length")).toBeNull()
    expect(res.headers.get("content-encoding")).toBeNull()
    expect(await res.text()).toBe("data: x\n\n")
  })

  it("answers 502 with the backend's error key when upstream is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    const res = await GET(new Request("http://localhost/api/backend/x") as NextRequest, ctx("x"))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ detail: "Upstream unreachable" })
  })
})
