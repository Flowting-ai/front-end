import { afterEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/auth0", () => ({ auth0: { getAccessToken: vi.fn().mockResolvedValue({ token: "test" }) } }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), event: vi.fn() } }))
import { GET } from "./route"

const UUID = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b"

afterEach(() => vi.unstubAllGlobals())

const get = (uuid = UUID) =>
  GET(new Request(`http://localhost/api/template/${uuid}`) as NextRequest, {
    params: Promise.resolve({ uuid }),
  })

describe("template html route", () => {
  it("rejects a non-uuid before calling the backend", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const response = await get("../admin")
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("returns 401 without a session", async () => {
    const { auth0 } = await import("@/lib/auth0")
    vi.mocked(auth0.getAccessToken).mockRejectedValueOnce(new Error("missing_session"))
    vi.stubGlobal("fetch", vi.fn())
    const response = await get()
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe("unauthorized")
  })

  it("streams the html under the sandbox headers", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("<h1>hi</h1>"))
    vi.stubGlobal("fetch", fetch)
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<h1>hi</h1>")
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts allow-popups allow-forms; frame-ancestors 'self'",
    )
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    const [url, init] = fetch.mock.calls[0]
    expect(url).toMatch(new RegExp(`/templates/${UUID}/html$`))
    expect(init.headers.Authorization).toBe("Bearer test")
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    [403, 403],
    [404, 404],
    [410, 410],
    [500, 502],
  ])("maps backend %i to %i without leaking its body", async (upstream, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret stack trace", { status: upstream })))
    const response = await get()
    expect(response.status).toBe(status)
    const text = await response.text()
    expect(text).not.toContain("secret")
    expect(JSON.parse(text).error.message).toBeTruthy()
  })

  it("returns 504 on timeout and 502 on network failure", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout))
    expect((await get()).status).toBe(504)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    expect((await get()).status).toBe(502)
  })
})
