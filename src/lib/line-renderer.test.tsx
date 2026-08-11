import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LineRenderer } from "./line-renderer"

describe("LineRenderer inline math vs. currency prose", () => {
  it("does not parse currency prose in list items as LaTeX", () => {
    const html = renderToStaticMarkup(
      <LineRenderer
        content={[
          "- Cheaper than buying data separately. Apollo's pricing is ~$50-150/mo depending on plan; buying data from ZoomInfo or Hunter can be $500+/mo.",
        ].join("\n")}
      />,
    )

    expect(html).toContain("$50-150/mo")
    expect(html).toContain("$500+/mo")
    expect(html).toContain("depending on plan")
    expect(html).not.toContain("katex")
  })

  it("still renders real inline math via KaTeX", () => {
    const html = renderToStaticMarkup(<LineRenderer content="The formula is $E=mc^2$ for energy." />)

    expect(html).toContain("katex")
  })

  it("uses compact preview typography for reasoning", () => {
    const html = renderToStaticMarkup(
      <LineRenderer content={"**Clarifying context**\n\nChecking the source."} variant="reasoning" />,
    )

    expect(html).toContain("font-size:14px")
    expect(html).toContain("line-height:22px")
    expect(html).toContain("height:8px")
    expect(html).toContain("color:#524B47")
    expect(html).toContain("color:#26211E")
  })
})
