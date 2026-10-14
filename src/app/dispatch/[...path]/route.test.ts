import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"

afterEach(() => vi.unstubAllGlobals())

const send = (path: string[], body = "data=1", headers: Record<string, string> = {}) =>
  POST(
    new NextRequest(`https://app.test/dispatch/${path.join("/")}`, { method: "POST", body, headers }),
    { params: Promise.resolve({ path }) },
  )

describe("analytics relay", () => {
  it.each([
    [["evt", ""], "https://api-js.mixpanel.com/track/"],
    [["usr"], "https://api-js.mixpanel.com/engage"],
    [["record", ""], "https://api-js.mixpanel.com/record/"],
  ])("forwards %j to %s without cookies", async (path, target) => {
    const fetch = vi.fn().mockResolvedValue(new Response("1"))
    vi.stubGlobal("fetch", fetch)
    const response = await send(path, "data=1", { cookie: "__session=secret", authorization: "Bearer x" })
    expect(response.status).toBe(200)
    expect(fetch.mock.calls[0][0]).toBe(target)
    const headers: Headers = fetch.mock.calls[0][1].headers
    expect(headers.get("cookie")).toBeNull()
    expect(headers.get("authorization")).toBeNull()
  })

  it.each([[["decide"]], [["evt", "extra"]], [["..", "admin"]]])("404s unknown path %j", async (path) => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    expect((await send(path)).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects oversized bodies", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    expect((await send(["evt"], "x".repeat(1_000_001))).status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
  })
})
