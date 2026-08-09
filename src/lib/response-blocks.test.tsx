import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BlockSequenceRenderer } from "@/components/chat/ResponseBlocks"
import type { ResponseBlock } from "@/hooks/use-chat-state"
import { responseBlockFromEventPayload } from "@/lib/response-blocks"

describe("structured response blocks", () => {
  const callout: ResponseBlock = {
    kind: "callout",
    data: {
      variant: "warning",
      title: "May 11 is the single point of failure",
      body: "Keep the **critical path** visible.",
    },
  }

  it("accepts wrapped and direct block event payloads", () => {
    expect(responseBlockFromEventPayload({ block: callout })).toEqual(callout)
    expect(responseBlockFromEventPayload(callout)).toEqual(callout)
  })

  it("renders preview callouts and tags in the real message block sequence", () => {
    const html = renderToStaticMarkup(
      <BlockSequenceRenderer
        static
        blocks={[
          callout,
          {
            kind: "tags",
            data: {
              title: "Risk categories",
              tags: [
                { label: "DS handoff timing", color: "#C8920A" },
                { label: "First user batch", color: "#80B707" },
              ],
            },
          },
        ]}
      />,
    )

    expect(html).toContain("May 11 is the single point of failure")
    expect(html).toContain("critical path")
    expect(html).toContain("Risk categories")
    expect(html).toContain("DS handoff timing")
    expect(html).toContain("First user batch")
    expect(html).toContain("border-left:3px solid #C8920A")
    expect(html).toContain("border-radius:99px")
    expect(html).toContain("font-family:var(--font-body)")
  })
})
