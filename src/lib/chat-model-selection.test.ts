import { describe, expect, it } from "vitest"
import { appendChatModelSelection } from "./chat-model-selection"

describe.each(["model_id", "modelId"] as const)("%s transport", (field) => {
  it.each(["base", "pro"] as const)("sends %s without a stale direct model", (tier) => {
    const form = new FormData()
    appendChatModelSelection(form, "stale-model", tier, field)
    expect([...form.entries()]).toEqual([["algorithm", tier]])
  })
  it("preserves explicit model selection", () => {
    const form = new FormData()
    appendChatModelSelection(form, "chosen", null, field)
    expect([...form.entries()]).toEqual([[field, "chosen"]])
  })
  it("leaves the default to the backend when nothing is selected", () => {
    const form = new FormData()
    appendChatModelSelection(form, null, null, field)
    expect([...form.entries()]).toEqual([])
  })
})
