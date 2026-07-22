import { describe, expect, it } from "vitest"

import { parseChatPrompt } from "./prompts"

describe("parseChatPrompt", () => {
  it("normalizes question prompts and supplies yes/no choices", () => {
    expect(parseChatPrompt("questions", {
      prompt_id: "p1",
      respond_url: "/chats/prompts/p1",
      title: "A question",
      questions: [{ id: "confirm", question: "Continue?", type: "yes_no" }],
    })).toEqual({
      request_id: "p1",
      kind: "questions",
      title: "A question",
      description: undefined,
      options: [],
      questions: [{
        id: "confirm",
        question: "Continue?",
        type: "yes_no",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        placeholder: undefined,
        required: true,
        allow_custom: true,
      }],
      respond_url: "/chats/prompts/p1",
    })
  })

  it("normalizes approval prompts with a safe default decision pair", () => {
    expect(parseChatPrompt("approval_prompt", {
      prompt_id: "p2",
      verb: "send",
      target: "the email",
    })).toMatchObject({
      request_id: "p2",
      kind: "approval",
      title: "Approve send?",
      description: "the email",
      options: [
        { value: "approve", label: "Approve", style: "primary" },
        { value: "reject", label: "Reject", style: "danger" },
      ],
    })
  })
})
