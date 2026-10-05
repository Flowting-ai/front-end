import { describe, expect, it } from "vitest"
import { extractThinkingContent } from "./content-parser"

describe("extractThinkingContent", () => {
  it("returns empty output for empty input", () => {
    expect(extractThinkingContent("")).toEqual({ visibleText: "", thinkingText: null, thinkingOpen: false })
    expect(extractThinkingContent(null)).toEqual({ visibleText: "", thinkingText: null, thinkingOpen: false })
  })

  it("leaves plain answers untouched apart from trimming", () => {
    expect(extractThinkingContent("  Hello there\n")).toEqual({
      visibleText: "Hello there",
      thinkingText: null,
      thinkingOpen: false,
    })
  })

  it("splits a leading think block into reasoning", () => {
    expect(extractThinkingContent("\n <think> weighing options </think>\n\nThe answer is 4.")).toEqual({
      visibleText: "The answer is 4.",
      thinkingText: "weighing options",
      thinkingOpen: false,
    })
  })

  it("matches the tags case-insensitively", () => {
    const result = extractThinkingContent("<THINK>plan</Think>Answer")
    expect(result.visibleText).toBe("Answer")
    expect(result.thinkingText).toBe("plan")
  })

  it("drops a dash-only separator line after the reasoning but keeps a list", () => {
    expect(extractThinkingContent("<think>x</think>\n---\nAnswer").visibleText).toBe("Answer")
    expect(extractThinkingContent("<think>x</think>\n- first\n- second").visibleText).toBe("- first\n- second")
  })

  it("routes everything after an unclosed leading think tag to reasoning", () => {
    expect(extractThinkingContent("<think>still working it out")).toEqual({
      visibleText: "",
      thinkingText: "still working it out",
      thinkingOpen: true,
    })
    expect(extractThinkingContent("<think>")).toEqual({ visibleText: "", thinkingText: null, thinkingOpen: true })
  })

  it("leaves think tags that are not at the start of the message alone", () => {
    const prose = "Models wrap reasoning in <think>…</think> tags."
    expect(extractThinkingContent(prose)).toEqual({ visibleText: prose, thinkingText: null, thinkingOpen: false })

    const inline = "Use `<think>x</think>` to mark reasoning."
    expect(extractThinkingContent(inline).visibleText).toBe(inline)

    const fenced = "Example:\n```xml\n<think>plan</think>\n```"
    expect(extractThinkingContent(fenced).visibleText).toBe(fenced)
  })

  it("keeps later think tags in the answer after a leading block", () => {
    const result = extractThinkingContent("<think>plan</think>Write `<think>` to start.")
    expect(result.visibleText).toBe("Write `<think>` to start.")
    expect(result.thinkingText).toBe("plan")
  })

  it("does not treat an unclosed tag later in the text as reasoning", () => {
    const text = "Type <think> to begin"
    expect(extractThinkingContent(text)).toEqual({ visibleText: text, thinkingText: null, thinkingOpen: false })
  })
})
