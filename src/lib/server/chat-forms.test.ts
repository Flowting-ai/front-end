import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth0", () => ({ auth0: {} }))
import { MAX_INPUT_CHARS, chatFormSchema, formFields, personaChatFormSchema } from "./chat-forms"

const form = (entries: [string, string | Blob][]) => {
  const fd = new FormData()
  for (const [k, v] of entries) fd.append(k, v)
  return fd
}

describe("formFields", () => {
  it("drops empty values and files, lists repeated keys", () => {
    const fd = form([["input", "hi"], ["modelId", ""], ["files", new Blob(["x"])], ["connectorSlugs", "gmail"], ["connectorSlugs", "slack"]])
    expect(formFields(fd, ["connectorSlugs"])).toEqual({ input: "hi", connectorSlugs: ["gmail", "slack"] })
  })
})

describe("chatFormSchema", () => {
  const parse = (fields: Record<string, string>) => chatFormSchema.safeParse(fields)

  it("accepts a normal message and coerces flags and numbers", () => {
    const r = parse({ input: "hi", webSearch: "true", enable_thinking: "true", effort: "high", temperature: "0.7", chatId: "temp-1" })
    expect(r.success && r.data).toMatchObject({ webSearch: true, enable_thinking: true, effort: "high", temperature: 0.7, chatId: "temp-1" })
  })

  it.each([
    [{ input: "x".repeat(MAX_INPUT_CHARS + 1) }, "Message is too long"],
    [{ input: "hi", algorithm: "max" }, undefined],
    [{ input: "hi", enable_thinking: "true", effort: "extreme" }, "effort must be low, medium or high"],
    [{ input: "hi", temperature: "3" }, "temperature must be between 0 and 2"],
    [{ input: "hi", chatId: "../x" }, "Invalid chatId"],
    [{ input: "hi", pinIds: JSON.stringify(Array.from({ length: 101 }, (_, i) => `p${i}`)) }, "pinIds must be a JSON array of ids"],
  ])("rejects %j", (fields, message) => {
    const r = parse(fields as Record<string, string>)
    expect(r.success).toBe(false)
    if (message && !r.success) expect(r.error.issues[0].message).toBe(message)
  })

  it("ignores an effort sent without thinking (the route never forwards it)", () => {
    expect(parse({ input: "hi", effort: "off" }).success).toBe(true)
  })
})

describe("personaChatFormSchema", () => {
  it("requires a safe repo id and caps connector slugs", () => {
    expect(personaChatFormSchema.safeParse({ repoId: "r1", input: "hi" }).success).toBe(true)
    expect(personaChatFormSchema.safeParse({ repoId: "a/b", input: "hi" }).success).toBe(false)
    expect(personaChatFormSchema.safeParse({ repoId: "r1", connectorSlugs: Array.from({ length: 51 }, () => "s") }).success).toBe(false)
  })
})
