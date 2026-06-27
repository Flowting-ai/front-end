import React from "react"
import { JSDOM } from "jsdom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ContentRenderer } from "./content-renderer"
import { applyRenderedHighlights } from "./rendered-highlights"
import type { HighlightSpec } from "./markdown-utils"

describe("ContentRenderer markdown formatting", () => {
  it("preserves preview-style generated response structure for headings, nested lists, emphasis, code, and math", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "## 2. Do you need to keep paying Instantly?",
          "",
          "**No, you do not** have to keep paying *Instantly* just to keep warmup active.",
          "",
          "You have three options:",
          "",
          "- **Option A - Stop Instantly**",
          "  - Send from another platform",
          "  - Keep SPF, DKIM, and `p=none` set up",
          "- **Option B - Keep warmup**",
          "",
          "Inline math should render: $x^2 + y^2 = z^2$.",
        ].join("\n")}
      />,
    )

    expect(html).toContain("<h2")
    expect(html).toContain("<strong")
    expect(html).toContain("<em")
    expect(html).toContain("<code")
    expect(html).toContain("katex")
    expect((html.match(/<ul/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it("does not parse currency prose in ordered lists as LaTeX", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "**Perks:**",
          "",
          "1. **No separate data tool.** You don't need ZoomInfo, Hunter, RocketReach, etc. Apollo has the data built in.",
          "2. **Easier list building.** Search by title, company size, industry, location -> export -> send.",
          "3. **Integrated workflows.** Find -> sequence -> track -> CRM, all in one place.",
          "4. **Cheaper than buying data separately.** Apollo's pricing is ~$50-150/mo depending on plan; buying data from ZoomInfo or Hunter can be $500+/mo.",
        ].join("\n")}
      />,
    )

    expect(html).toContain("<ol")
    expect(html).toContain("<strong")
    expect(html).toContain("$50-150/mo")
    expect(html).toContain("$500+/mo")
    expect(html).not.toContain("katex")
  })

  it("handles generic currency formats without breaking real math or code spans", () => {
    const currencyHtml = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "Pricing can be $19/mo, $1,200 per year, or US$99 for a seat.",
          "",
          "Discounts often move from $50 to $100 depending on plan.",
          "",
          "Literal code should stay code: `$500`.",
        ].join("\n")}
      />,
    )

    expect(currencyHtml).toContain("$19/mo")
    expect(currencyHtml).toContain("$1,200")
    expect(currencyHtml).toContain("US$99")
    expect(currencyHtml).toContain("$50")
    expect(currencyHtml).toContain("$100")
    expect(currencyHtml).toContain("<code")
    expect(currencyHtml).toContain("$500")
    expect(currencyHtml).not.toContain("katex")

    const mathHtml = renderToStaticMarkup(
      <ContentRenderer content="Real math should still render: $2x + 1$ and $x^2 + y^2 = z^2$." />,
    )

    expect(mathHtml).toContain("katex")
    expect(mathHtml).not.toContain("\\$2x")
  })

  it("keeps rendered highlights working across markdown elements", () => {
    const content = [
      "## Model selection by feature",
      "",
      "**Founder-led content** is the dominant channel.",
      "",
      "- Use `p=none` while testing",
      "- Preserve inbox reputation",
    ].join("\n")
    const html = renderToStaticMarkup(<ContentRenderer content={content} />)
    const dom = new JSDOM(`<main id="root">${html}</main>`)
    const previousDocument = globalThis.document
    const previousNode = globalThis.Node
    globalThis.document = dom.window.document
    globalThis.Node = dom.window.Node

    try {
      const root = dom.window.document.getElementById("root")
      expect(root).not.toBeNull()

      const renderedText = root!.textContent ?? ""
      const founderStart = renderedText.indexOf("Founder-led content")
      const codeStart = renderedText.indexOf("p=none")
      const highlights: HighlightSpec[] = [
        {
          id: "h-bold",
          text: "Founder-led content",
          colorIndex: 0,
          startOffset: founderStart,
          endOffset: founderStart + "Founder-led content".length,
        },
        {
          id: "h-code",
          text: "p=none",
          colorIndex: 1,
          startOffset: codeStart,
          endOffset: codeStart + "p=none".length,
        },
      ]

      applyRenderedHighlights(root!, highlights)

      expect(root!.querySelector('mark[data-highlight-id="h-bold"]')?.textContent).toBe("Founder-led content")
      expect(root!.querySelector('mark[data-highlight-id="h-code"]')?.textContent).toBe("p=none")
      expect(root!.querySelector("strong mark")).not.toBeNull()
      expect(root!.querySelector("code mark")).not.toBeNull()
    } finally {
      globalThis.document = previousDocument
      globalThis.Node = previousNode
    }
  })
})
