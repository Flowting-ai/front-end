import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PinMarkdownRenderer } from "./pin-markdown"

describe("PinMarkdownRenderer", () => {
  it("renders a one-line fence without a language as a code block, never 'undefined'", () => {
    const html = renderToStaticMarkup(<PinMarkdownRenderer content={"```\nnpm install\n```\n\n```\n```"} />)

    expect(html).toContain('<pre class="kaya-scrollbar"')
    expect(html).toContain("<code>npm install</code>")
    expect(html).not.toContain("undefined")
  })

  it("keeps the language class verbatim", () => {
    const html = renderToStaticMarkup(<PinMarkdownRenderer content={"```c++\nint x;\n```"} />)

    expect(html).toContain('<code class="language-c++">int x;</code>')
  })

  it("keeps inline code inline", () => {
    const html = renderToStaticMarkup(<PinMarkdownRenderer content="Run `ls` now" />)

    expect(html).not.toContain("<pre")
    expect(html).toContain(">ls</code>")
  })

  it("keeps single newlines and never leaks the HAST node", () => {
    const html = renderToStaticMarkup(<PinMarkdownRenderer content={"Line one\nLine two\n\n- item\n\n> quote"} />)

    expect(html).toContain("Line one<br/>")
    expect(html).not.toContain("node=")
    expect(html).not.toContain("[object Object]")
  })
})
