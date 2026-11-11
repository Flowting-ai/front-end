import { afterEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { appendChatModelSelection } from "@/lib/chat-model-selection"

vi.mock("@/lib/auth0", () => ({ auth0: { getAccessToken: vi.fn().mockResolvedValue({ token: "test" }) } }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), event: vi.fn() } }))
vi.mock("@/lib/geo-headers", () => ({ forwardGeoHeaders: () => ({}) }))
import { POST } from "./route"

afterEach(() => vi.unstubAllGlobals())

describe.each([false, true])("chat proxy existing=%s", (existing) => {
  it.each(["base", "pro"] as const)("forwards %s to the backend", async (tier) => {
    const fetch = vi.fn().mockResolvedValue(new Response("done"))
    vi.stubGlobal("fetch", fetch)
    const form = new FormData()
    form.set("input", "hello")
    if (existing) form.set("chatId", "chat-123")
    appendChatModelSelection(form, null, tier, "modelId")
    // A stale caller must not override the explicitly selected tier.
    form.set("modelId", "stale")
    const request = new Request("http://localhost/api/chat", { method: "POST", body: form })
    const response = await POST(request as NextRequest)
    expect(await response.text()).toBe("done")
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(existing ? /chats\/chat-123\/stream$/ : /chats\/create$/)
    expect(options.body.get("algorithm")).toBe(tier)
    expect(options.body.has("model_id")).toBe(false)
  })
})

describe("chat proxy validation", () => {
  const post = (fields: Record<string, string>) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.set(key, value)
    return POST(new Request("http://localhost/api/chat", { method: "POST", body: form }) as NextRequest)
  }

  it.each([
    [{ input: "hi", chatId: "../admin" }, "Invalid chatId"],
    [{ input: "hi", temperature: "7" }, "temperature must be between 0 and 2"],
    [{ input: "hi", pinIds: "not-json" }, "pinIds must be a JSON array of ids"],
    [{ input: " " }, "A message or a file is required"],
  ])("rejects %j before calling the backend", async (fields, message) => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const response = await post(fields)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: { code: "bad_request", message } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("returns a JSON 401 without a session token", async () => {
    const { auth0 } = await import("@/lib/auth0")
    vi.mocked(auth0.getAccessToken).mockRejectedValueOnce(new Error("missing_session"))
    const response = await post({ input: "hi" })
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe("unauthorized")
  })

  it("passes the backend's own error body through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"detail":"credits"}', { status: 402 })))
    const response = await post({ input: "hi" })
    expect(response.status).toBe(402)
    expect(await response.text()).toBe('{"detail":"credits"}')
  })
})

describe("chat proxy stream", () => {
  it("returns SSE headers and the request id it sent upstream", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("data: x\n\n", { headers: { "X-Chat-Id": "c1" } }))
    vi.stubGlobal("fetch", fetch)
    const form = new FormData()
    form.set("input", "hi")
    const res = await POST(new Request("http://localhost/api/chat", { method: "POST", body: form }) as NextRequest)
    expect(res.headers.get("Content-Type")).toBe("text/event-stream")
    expect(res.headers.get("X-Accel-Buffering")).toBe("no")
    expect(res.headers.get("X-Chat-Id")).toBe("c1")
    expect(res.headers.get("X-Request-Id")).toBe(fetch.mock.calls[0][1].headers["X-Request-Id"])
  })
})
