import { describe, expect, it } from "vitest"

import { toUIMessage } from "@/lib/normalizers/message-transformer"
import { INCOMPLETE_ANSWER_MESSAGE } from "@/lib/turn-outcome"
import type { Message } from "@/types/chat"

const base: Message = {
  id: "m1",
  role: "assistant",
  content: "Here is what I found.",
  created_at: "2026-10-04T00:00:00Z",
  chat_id: "c1",
}

describe("toUIMessage", () => {
  it("hydrates persisted tool calls into done activity rows", () => {
    const ui = toUIMessage({
      ...base,
      tool_calls: [
        { tool: "search_web", args: { query: "paris population" }, duration_s: 1.2 },
        { tool: "read_url", args: { url: "https://insee.fr" }, duration_s: 0.4 },
        "csv_execute",
      ],
    })
    expect(ui.activities).toEqual([
      { id: "m1-tool-0", type: "web-search", toolName: "search_web", detail: "paris population", status: "done", durationS: 1.2 },
      { id: "m1-tool-1", type: "tool-call", toolName: "read_url", detail: "https://insee.fr", status: "done", durationS: 0.4 },
      { id: "m1-tool-2", type: "csv-execute", toolName: "csv_execute", detail: undefined, status: "done" },
    ])
    // The raw calls are not kept in UI state.
    expect("tool_calls" in ui).toBe(false)
  })

  it("gives web-search rows their results and does not add a second search row", () => {
    const ui = toUIMessage({
      ...base,
      sources: [{ id: "0", url: "https://en.wikipedia.org/wiki/Paris", title: "Paris" }],
      web_searches: [{ query: "paris", links: ["https://en.wikipedia.org/wiki/Paris"], results: [{ url: "https://en.wikipedia.org/wiki/Paris", title: "Paris" }] }],
      tool_calls: [{ tool: "search_web", args: {} }],
    })
    expect(ui.activities).toHaveLength(1)
    expect(ui.activities?.[0]).toMatchObject({ type: "web-search", detail: "paris", results: [{ title: "Paris", url: "https://en.wikipedia.org/wiki/Paris" }] })
    expect(ui.webCitations).toEqual([{ title: "Paris", url: "https://en.wikipedia.org/wiki/Paris", domain: "en.wikipedia.org" }])
  })

  it("keeps the synthesised search row alongside non-search tool calls", () => {
    const ui = toUIMessage({
      ...base,
      sources: [{ id: "0", url: "https://a.com", title: "A" }],
      tool_calls: [{ tool: "read_url", args: { url: "https://a.com" } }],
    })
    expect(ui.activities?.map((a) => a.id)).toEqual(["m1-websearch", "m1-tool-0"])
  })

  it("shows an incomplete answer with nothing else as the full error", () => {
    const ui = toUIMessage({ ...base, content: "", thinking: "plan", errorNotice: INCOMPLETE_ANSWER_MESSAGE })
    expect(ui).toMatchObject({ content: INCOMPLETE_ANSWER_MESSAGE, isError: true, errorNotice: undefined, thinking: "plan" })
  })

  it("keeps the notice inline when something else is shown", () => {
    const ui = toUIMessage({ ...base, content: "", errorNotice: INCOMPLETE_ANSWER_MESSAGE, image_links: ["https://img/x.png"] })
    expect(ui).toMatchObject({ content: "", isError: false, errorNotice: INCOMPLETE_ANSWER_MESSAGE })
  })
})
