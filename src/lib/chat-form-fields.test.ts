import { describe, expect, it } from "vitest"
import { CHAT_CREATE_FIELDS, CHAT_STREAM_FIELDS, keepAcceptedFields } from "./chat-form-fields"

describe("keepAcceptedFields", () => {
  it("drops fields the chat endpoints refuse and keeps the rest", () => {
    const fd = new FormData()
    fd.append("input", "hi")
    fd.append("web_search", "true")
    fd.append("tone_id", "warm")
    fd.append("librarySourcesOff", "[\"a\"]")
    fd.append("libraryFileIds", "[\"b\"]")
    fd.append("files", new File(["x"], "a.txt"))
    fd.append("files", new File(["y"], "b.txt"))
    keepAcceptedFields(fd, CHAT_CREATE_FIELDS)
    expect([...new Set(fd.keys())]).toEqual(["input", "librarySourcesOff", "libraryFileIds", "files"])
    expect(fd.getAll("files")).toHaveLength(2)
  })

  it("keeps persona_id (an agent version id) on create and stream", () => {
    const make = () => {
      const fd = new FormData()
      fd.append("input", "hi")
      fd.append("persona_id", "v1")
      fd.append("personaId", "v1")
      return fd
    }
    expect([...keepAcceptedFields(make(), CHAT_CREATE_FIELDS).keys()]).toEqual(["input", "persona_id"])
    expect([...keepAcceptedFields(make(), CHAT_STREAM_FIELDS).keys()]).toEqual(["input", "persona_id"])
  })

  it("keeps the reply fields only on an existing chat", () => {
    const make = () => {
      const fd = new FormData()
      fd.append("input", "hi")
      fd.append("replace_message_id", "m1")
      return fd
    }
    expect(keepAcceptedFields(make(), CHAT_CREATE_FIELDS).has("replace_message_id")).toBe(false)
    expect(keepAcceptedFields(make(), CHAT_STREAM_FIELDS).has("replace_message_id")).toBe(true)
  })

  it("filters a url-encoded body", () => {
    const params = new URLSearchParams({ input: "hi", model_id: "m", connector_slugs: "slack" })
    expect(keepAcceptedFields(params, CHAT_CREATE_FIELDS).toString()).toBe("input=hi&model_id=m")
  })
})
