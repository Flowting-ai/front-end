import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownRenderer } from "./markdown-utils"
import { healStreamingTail } from "./markdown-preprocess"

// The streaming path runs the same react-markdown renderer as the final reply, with
// healStreamingTail applied first. These check the mid-stream HTML is sane and the
// final (non-streaming) render is byte-for-byte what it was without the healer.
const html = (content: string, streaming = false) =>
  renderToStaticMarkup(<MarkdownRenderer content={content} streaming={streaming} />)

describe("MarkdownRenderer while streaming", () => {
  it("renders an unclosed code fence as a code block, not prose", () => {
    const out = html("Here:\n\n```ts\nconst a = **1**", true)
    expect(out).toContain("<pre")
    expect(out).toContain("const a = **1**")
    expect(out).not.toContain("<strong>")
  })

  it("renders unclosed bold as bold without a stray marker", () => {
    const out = html("This is **really important", true)
    expect(out).toContain("<strong>really important</strong>")
    expect(out).not.toContain("**")
  })

  it("renders unclosed underscore strong as bold", () => {
    expect(html("This is __really", true)).toContain("<strong>really</strong>")
    expect(healStreamingTail("call dunder__init")).toBe("call dunder__init")
  })

  it("shows only the text of a half-written link", () => {
    const out = html("Read [the docs](https://exa", true)
    expect(out).toContain("Read the docs")
    expect(out).not.toContain("](")
    expect(out).not.toContain("<a")
  })

  it("keeps the text of a link nested in unclosed bold", () => {
    expect(html("See **[docs](https://ex", true)).toContain("<strong>docs</strong>")
  })
})

describe("MarkdownRenderer final output", () => {
  const fixtures = [
    "**Bold** and *italic* with `code` and [a link](https://example.com).",
    "| A | B |\n|---|---|\n| 1 | 2 |",
    "```js\nconst x = 1\n```",
    "Math $x^2$ and price $5.",
    "This is **unclosed at the end",
  ]
  it("is unaffected by the streaming healer once streaming ends", () => {
    for (const f of fixtures) {
      expect(html(f, false)).toMatchSnapshot()
    }
  })

  it("matches the streaming render for already-complete markdown", () => {
    for (const f of fixtures.slice(0, 3)) expect(html(f, true)).toBe(html(f, false))
  })
})
