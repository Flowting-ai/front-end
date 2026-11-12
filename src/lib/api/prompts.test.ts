import { describe, expect, it } from "vitest"

import { parsePrompt } from "./prompts"

const gate = { prompt_id: "p1", respond_url: "/chats/c/resume" }
const gmail = { connector_slug: "gmail", display_name: "Gmail", icon_url: "https://logo/gmail.png", tool_slug: "gmail_send" }

describe("parsePrompt", () => {
  it("reads a question card and supplies yes/no choices", () => {
    expect(parsePrompt("question_prompt", {
      ...gate,
      title: "A question",
      questions: [{ id: "confirm", question: "Continue?", type: "yes_no" }],
    })).toEqual({
      card: "chat",
      request_id: "p1",
      respond_url: "/chats/c/resume",
      kind: "questions",
      title: "A question",
      description: "",
      options: [],
      questions: [{
        id: "confirm",
        question: "Continue?",
        type: "yes_no",
        entity: "generic",
        options: [
          { value: "yes", label: "Yes", recommended: false },
          { value: "no", label: "No", recommended: false },
        ],
        required: true,
        allow_custom: true,
      }],
    })
  })

  it("keeps the agent details the server fills on a choice", () => {
    const prompt = parsePrompt("question_prompt", {
      ...gate,
      questions: [{
        id: "agent", question: "Which agent?", type: "single_choice", entity: "persona",
        options: [{ value: "a1", label: "Ada", handle: "ada", avatar_url: "https://img/ada.png", recommended: true }],
      }],
    })
    expect(prompt).toMatchObject({
      title: "Quick question",
      questions: [{ entity: "persona", options: [{ value: "a1", handle: "ada", avatar_url: "https://img/ada.png", recommended: true }] }],
    })
  })

  it("leaves out a question that does not match the schema and keeps the rest", () => {
    const prompt = parsePrompt("question_prompt", {
      ...gate,
      questions: [
        { id: "bad", question: "No type" },
        { id: "worse", question: "Unknown type", type: "slider" },
        { id: "good", question: "Name?", type: "text" },
      ],
    })
    expect(prompt).toMatchObject({ card: "chat", questions: [{ id: "good" }] })
    expect(prompt?.card === "chat" && prompt.questions).toHaveLength(1)
  })

  it("reads an approval card with a default pair of decisions", () => {
    expect(parsePrompt("approval_prompt", { ...gate, ...gmail, verb: "send", target: "the email" })).toMatchObject({
      card: "chat",
      kind: "approval",
      title: "Approve send?",
      description: "the email",
      options: [
        { value: "approve", label: "Approve", style: "primary" },
        { value: "reject", label: "Reject", style: "danger" },
      ],
    })
  })

  it("reads a plain prompt with its own kind and options", () => {
    expect(parsePrompt("user_prompt", {
      ...gate, kind: "confirm", title: "Continue?", options: [{ value: "yes", label: "Yes", style: "primary" }],
    })).toMatchObject({ card: "chat", kind: "confirm", title: "Continue?", options: [{ value: "yes", label: "Yes", style: "primary" }], questions: [] })
  })

  it("reads a connect card with its connector resolved once", () => {
    expect(parsePrompt("tool_connect_prompt", {
      ...gate, ...gmail, auth_mode: "api_key", provider: "mcp", api_key_fields: [{ name: "key", label: "Key" }],
    })).toEqual({
      card: "connect",
      request_id: "p1",
      respond_url: "/chats/c/resume",
      connector: { slug: "gmail", name: "Gmail", logo: "https://logo/gmail.png", status: "connected" },
      auth_mode: "api_key",
      provider: "mcp",
      tool_name: "gmail_send",
      api_key_fields: [{ name: "key", label: "Key", help: "", secret: false, required: true }],
    })
  })

  it("reads a permission card with its connector resolved once", () => {
    expect(parsePrompt("permission_prompt", {
      ...gate, ...gmail, summary: "Send email", persistable: false,
      options: [{ value: "allow_once", label: "Allow this request", style: "primary" }],
    })).toEqual({
      card: "permission",
      request_id: "p1",
      respond_url: "/chats/c/resume",
      connector: { slug: "gmail", name: "Gmail", logo: "https://logo/gmail.png", status: "connected" },
      tool_name: "gmail_send",
      summary: "Send email",
      suggested_args: {},
      persistable: false,
      options: [{ value: "allow_once", label: "Allow this request", style: "primary" }],
    })
  })

  it("returns null for a card that does not match its schema", () => {
    expect(parsePrompt("permission_prompt", { ...gate, tool_slug: "gmail_send" })).toBeNull()
    expect(parsePrompt("question_prompt", { title: "No id" })).toBeNull()
  })
})
