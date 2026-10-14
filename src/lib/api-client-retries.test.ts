import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultRetries, secureFetch } from "./api-client"

describe("defaultRetries", () => {
  it("retries idempotent reads only", () => {
    expect(defaultRetries()).toBe(3)
    expect(defaultRetries("get")).toBe(3)
    expect(defaultRetries("HEAD")).toBe(3)
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(defaultRetries(m)).toBe(0)
  })
})

describe("secureFetch", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sends a failing POST once, not 4 times", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(secureFetch("/x", { method: "POST", body: "{}" })).rejects.toThrow(/HTTP 500/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
