import { describe, expect, it } from "vitest"
import { getSourcesOff, hasSourcesOff, seedSourcesOff, setSourcesOff } from "./library-sources-off"

describe("sources switched off per chat", () => {
  it("takes the server's stored list when this tab has none", () => {
    seedSourcesOff("chat-a", ["f1"])
    expect(getSourcesOff("chat-a")).toEqual(["f1"])
  })

  it("keeps a list flipped in this tab over the server's older one", () => {
    setSourcesOff("chat-b", [])
    seedSourcesOff("chat-b", ["f1"])
    expect(hasSourcesOff("chat-b")).toBe(true)
    expect(getSourcesOff("chat-b")).toEqual([])
  })

  it("has no list for a chat nothing was switched off in", () => {
    seedSourcesOff("chat-c", [])
    expect(hasSourcesOff("chat-c")).toBe(false)
  })
})
