import { describe, expect, it } from "vitest"
import { extractCredits, httpErrorMessage, omitKey, resolveModelId } from "./run-events"

describe("resolveModelId", () => {
  it("reads either casing and trims", () => {
    expect(resolveModelId({ model_id: " a " })).toBe("a")
    expect(resolveModelId({ modelId: 7 })).toBe("7")
  })
  it("returns null when missing or blank", () => {
    expect(resolveModelId({})).toBeNull()
    expect(resolveModelId({ model_id: "  " })).toBeNull()
  })
})

describe("extractCredits", () => {
  it("prefers the top-level fields in order", () => {
    expect(extractCredits({ credits_used: 1, cost: 9 })).toBe(1)
    expect(extractCredits({ creditsUsed: 2 })).toBe(2)
    expect(extractCredits({ cost: 0 })).toBe(0)
  })
  it("falls back to usage", () => {
    expect(extractCredits({ usage: { total_cost: 3 } })).toBe(3)
    expect(extractCredits({ usage: { cost: 4 } })).toBe(4)
  })
  it("ignores non-numbers", () => {
    expect(extractCredits({ credits: "5", usage: null })).toBeNull()
  })
})

describe("httpErrorMessage", () => {
  it("maps common statuses", () => {
    expect(httpErrorMessage(402)).toMatch(/credits/)
    expect(httpErrorMessage(429)).toMatch(/Too many/)
    expect(httpErrorMessage(503)).toMatch(/503/)
    expect(httpErrorMessage(400)).toBe("Request failed (400).")
  })
})

describe("omitKey", () => {
  it("removes a key without mutating", () => {
    const m = { a: 1, b: 2 }
    expect(omitKey(m, "a")).toEqual({ b: 2 })
    expect(m).toEqual({ a: 1, b: 2 })
  })
  it("returns the same object when the key is absent", () => {
    const m = { a: 1 }
    expect(omitKey(m, "z")).toBe(m)
  })
})
