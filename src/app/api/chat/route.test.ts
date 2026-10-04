import { afterEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { appendChatModelSelection } from "@/lib/chat-model-selection"

vi.mock("@/lib/auth0", () => ({ auth0: { getAccessToken: vi.fn().mockResolvedValue({ token: "test" }) } }))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }))
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
