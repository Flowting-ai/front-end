import { afterEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/auth0", () => ({ auth0: { getAccessToken: vi.fn().mockResolvedValue({ token: "test" }) } }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), event: vi.fn() } }))
vi.mock("@/lib/geo-headers", () => ({ forwardGeoHeaders: () => ({ "X-Geo-Country": "US" }) }))
import { POST } from "./route"

afterEach(() => vi.unstubAllGlobals())

const post = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return POST(new Request("http://localhost/api/persona-chat", { method: "POST", body: form }) as NextRequest)
}

describe("persona chat proxy", () => {
  it.each([
    [{ repoId: "repo-1", chatId: "chat-9" }, /\/persona\/repo-1\/chats\/chat-9\/stream$/],
    [{ repoId: "repo-1" }, /\/persona\/repo-1\/chats\/create$/],
    [{ repoId: "repo-1", chatId: "temp-abc" }, /\/persona\/repo-1\/chats\/create$/],
  ])("routes %j to the right backend URL with the token and geo headers", async (ids, url) => {
    const fetch = vi.fn().mockResolvedValue(new Response("data: ok\n\n"))
    vi.stubGlobal("fetch", fetch)
    const response = await post({ input: "hi", ...ids })
    expect(response.status).toBe(200)
    const [calledUrl, options] = fetch.mock.calls[0]
    expect(calledUrl).toMatch(url)
    expect(options.headers.Authorization).toBe("Bearer test")
    expect(options.headers["X-Geo-Country"]).toBe("US")
  })

  it.each([
    [{ input: "hi" }, 400],
    [{ input: "hi", repoId: "../users" }, 400],
    [{ input: "hi", repoId: "repo-1", chatId: "a/b" }, 400],
    [{ input: " ", repoId: "repo-1" }, 400],
  ])("rejects %j before calling the backend", async (fields, status) => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const response = await post(fields)
    expect(response.status).toBe(status)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("accepts a Library file without a message and forwards its ids", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("data: ok\n\n"))
    vi.stubGlobal("fetch", fetch)
    const response = await post({ input: "",repoId: "repo-1", libraryFileIds: JSON.stringify(["file-1"]) })
    expect(response.status).toBe(200)
    expect((fetch.mock.calls[0][1].body as FormData).get("libraryFileIds")).toBe(JSON.stringify(["file-1"]))
  })

  it("rejects libraryFileIds that are not a JSON array of ids", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const response = await post({ input: "hi", repoId: "repo-1", libraryFileIds: "file-1" })
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
