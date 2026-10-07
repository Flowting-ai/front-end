import React from "react"
import { JSDOM } from "jsdom"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ContentRenderer } from "./content-renderer"
import { applyRenderedHighlights } from "./rendered-highlights"
import type { HighlightSpec } from "./markdown-utils"

describe("ContentRenderer markdown formatting", () => {
  it("shows the streaming cursor before the first word is revealed", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content="" isStreaming cursor={<span>cursor</span>} />,
    )

    expect(html).toContain("cursor")
  })

  it("remaps an unexpected response H1 so it cannot compete with the page heading", () => {
    const html = renderToStaticMarkup(<ContentRenderer content="# Unexpected title" />)

    expect(html).toContain("<h2")
    expect(html).not.toContain("<h1")
  })

  it("constrains prose width while preserving the shared markdown renderer", () => {
    const html = renderToStaticMarkup(<ContentRenderer content="A readable paragraph." />)

    expect(html).toContain("max-width:var(--prose-measure)")
  })

  it("does not present an unmatched citation marker as a valid source", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content="This marker has no source [2]."
        webCitations={[{ title: "Only source", url: "https://example.com/one" }]}
      />,
    )

    expect(html).toContain('data-missing-citation="true"')
    expect(html).toContain('aria-label="Source 2 unavailable"')
    expect(html).toContain(">?</span>")
  })

  it("keeps a matched citation interactive and source-backed", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content="This claim is sourced [1]."
        webCitations={[{ title: "Primary source", url: "https://example.com/primary" }]}
      />,
    )

    expect(html).toContain('aria-label="Source 1: Primary source"')
    expect(html).not.toContain("data-missing-citation")
  })

  it("keeps unsafe model-authored link protocols blocked", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content="[Do not run this](javascript:alert('xss'))" />,
    )

    expect(html).not.toContain("javascript:")
  })

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

  it("keeps a bold title followed by a blockquote as separate blocks", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "Here is the rewrite.",
          "",
          "**Option 1 (Flows into the Slack sentence):**",
          "> My team built Souvenir. **By unifying your organizational knowledge**, our agents live in Slack.",
          "",
          "**Option 2 (Added to the first sentence):**",
          "> My team built Souvenir for modern teams **that unifies your organizational knowledge**. It runs in Slack.",
        ].join("\n")}
      />,
    )

    expect((html.match(/<blockquote/g) ?? []).length).toBe(2)
    expect((html.match(/<strong/g) ?? []).length).toBeGreaterThanOrEqual(4)
    expect(html).not.toContain("&gt; My team")
    expect(html).toContain("Souvenir. <strong")
    expect(html).toContain("modern teams <strong")
  })

  it("renders bold lead-in titles on their own lines without orphaned asterisks", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "**Heavy use of Markdown in training**",
          "Both models were fine-tuned on high-quality responses that use proper Markdown.",
          "",
          "**System prompts (not visible to users)**",
          "OpenAI and Anthropic both include hidden instructions.",
          "",
          "**RLHF / Preference tuning**",
          "Human reviewers consistently rate structured answers higher.",
        ].join("\n")}
      />,
    )

    expect((html.match(/<strong>/g) ?? []).length).toBe(3)
    expect(html).toContain("<strong>Heavy use of Markdown in training</strong>")
    expect(html).toContain("<strong>System prompts (not visible to users)</strong>")
    expect(html).toContain("<strong>RLHF / Preference tuning</strong>")
    expect(html).not.toContain("**")
  })

  it("strips <details>/<summary> wrappers and renders the inner markdown", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={[
          "<details>",
          "**Autonomous Execution:** Role-based digital workers handle complex ops.",
          "**Continuous Logic:** Custom agents remember client history.",
          "</details>",
        ].join("\n")}
      />,
    )

    expect(html).not.toContain("details")
    expect(html).not.toContain("&lt;")
    expect(html).toContain("<strong>Autonomous Execution:</strong>")
    expect(html).toContain("<strong>Continuous Logic:</strong>")
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

  it("renders steps, callout, and tags widgets around the surrounding prose", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={
          "Here is the plan.\n\n" +
          '<steps title="Connecting Notion">' +
          '<step label="Open Settings → Connectors" description="Tap your avatar, then Settings."/>' +
          '<step label="Run a test sync"/>' +
          "</steps>\n\n" +
          '<callout variant="warning" title="May 11 is the deadline">' +
          "Anything not specced by **Apr 30** risks the date." +
          "</callout>\n\n" +
          '<tags title="Risk categories"><tag label="DS handoff timing" color="#C8920A"/></tags>'
        }
      />,
    )

    expect(html).toContain("Here is the plan.")
    expect(html).toContain("Connecting Notion")
    expect(html).toContain("Open Settings → Connectors")
    expect(html).toContain("May 11 is the deadline")
    expect(html).toContain("Risk categories")
    expect(html).toContain("DS handoff timing")
    // Callout body keeps inline markdown rather than literal asterisks.
    expect(html).toContain(">Apr 30</strong>")
    expect(html).not.toContain("**Apr 30**")
    // Raw XML never survives to the DOM.
    expect(html).not.toContain("&lt;steps")
    expect(html).not.toContain("&lt;callout")
  })

  it("keeps an unknown callout variant renderable instead of failing the message", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content='<callout variant="danger">Heads up.</callout>' />,
    )

    expect(html).toContain("Heads up.")
  })
})

describe("ContentRenderer structured blocks", () => {
  it("shows a table-shaped skeleton with an accessible label while a block streams in", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content={"Here:\n<table><tr><th>A</th>"} isStreaming cursor={<span>cursor</span>} />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-label="Loading table…"')
    expect(html).toContain("Rendering table…")
    expect(html).toContain("kaya-skeleton")
    expect(html).not.toContain("&lt;table")
  })

  it("does not let an inline-code tag swallow the rest of the message", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content={"Wrap it in `<chart>` tags.\n\nEverything after still shows."} />,
    )

    expect(html).toContain("&lt;chart&gt;</code>")
    expect(html).toContain("Everything after still shows.")
    expect(html).not.toContain("Rendering")
  })

  it("explains an unclosed block after the stream ends and keeps the text after it", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content={"Intro\n<table>\n<tr><td>1</td></tr>\n\nText after the block."} />,
    )

    expect(html).toContain("Couldn&#x27;t display this table — the response ended early.")
    expect(html).toContain("<details>")
    expect(html).toContain("&lt;table&gt;")
    expect(html).toContain("Text after the block.")
    expect(html).not.toContain("Rendering")
  })

  it("turns the interrupted marker into a friendly line instead of hiding it in a broken block", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content={"Here:\n<table>\n<tr><td>1</td>\n[Response interrupted: something failed]"} isStreaming />,
    )

    expect(html).toContain("Couldn&#x27;t display this table")
    expect(html).not.toContain("[Response interrupted")
    expect(html).not.toContain("Rendering")
  })

  it("renders the interrupted line outside a code fence the interruption left open", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"```js\nconst a = 1\n[Response interrupted: 500: boom]"} />)
    const dom = new JSDOM(html).window.document

    expect(dom.querySelector("pre")?.textContent).toBe("const a = 1")
    expect(dom.querySelector("p")?.textContent?.length).toBeGreaterThan(0)
    expect(html).not.toContain("[Response interrupted")
  })
})

describe("ContentRenderer streaming cursor", () => {
  it("anchors the cursor out of flow after the last block", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer content={"First paragraph.\n\n"} isStreaming cursor={<span>cursor</span>} />,
    )

    expect(html).toContain(
      '<div style="position:relative;height:0"><span style="position:absolute;top:0;left:0;line-height:var(--prose-line-body);white-space:nowrap"><span>cursor</span></span></div>',
    )
    // The cursor is no longer rendered inside a markdown block of its own.
    expect((html.match(/kaya-chat-markdown/g) ?? []).length).toBe(1)
  })

  it("renders no cursor once streaming is over", () => {
    const html = renderToStaticMarkup(<ContentRenderer content="Done." cursor={<span>cursor</span>} />)

    expect(html).not.toContain("cursor")
  })
})

describe("ContentRenderer markdown details", () => {
  it("renders a one-line fence without a language as a full code block with Copy", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"```\nnpm install\n```"} />)

    expect(html).toContain('aria-label="Copy code"')
    expect(html).toContain("npm install")
    expect(html).not.toContain("undefined")
  })

  it("keeps language labels like c++ and objective-c intact", () => {
    const cpp = renderToStaticMarkup(<ContentRenderer content={"```c++\nint main() {}\n```"} />)
    const objc = renderToStaticMarkup(<ContentRenderer content={"```objective-c\n@interface A\n```"} />)

    expect(cpp).toContain(">c++</span>")
    expect(cpp).toContain('class="language-c++"')
    expect(objc).toContain(">objective-c</span>")
  })

  it("never renders the text undefined for an empty fence", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"```\n```"} />)

    expect(html).toContain('aria-label="Copy code"')
    expect(html).not.toContain("undefined")
  })

  it("keeps a single newline as a line break", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"Line one\nLine two"} />)

    expect(html).toContain("Line one<br/>")
  })

  it("styles h4-h6 like h3 while keeping their semantic level", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"### Three\n\n#### Four\n\n##### Five\n\n###### Six"} />)
    const style = (tag: string) => html.match(new RegExp(`<${tag} style="([^"]*)"`))?.[1]

    expect(style("h3")).toContain("font-size:var(--prose-size-h3)")
    expect(style("h4")).toBe(style("h3"))
    expect(style("h5")).toBe(style("h3"))
    expect(style("h6")).toBe(style("h3"))
  })

  it("never leaks the HAST node onto DOM elements", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        content={"# H\n\nPara `code`\n\n> quote\n\n- item\n\n1. one\n\n| a | b |\n|---|---|\n| 1 | 2 |"}
      />,
    )

    expect(html).not.toContain("node=")
    expect(html).not.toContain("[object Object]")
  })

  it("keeps footnote links in the tab with per-message ids and a hidden label", () => {
    const content = "Claim.[^1]\n\n[^1]: The source."
    const html = renderToStaticMarkup(
      <>
        <ContentRenderer content={content} />
        <ContentRenderer content={content} />
      </>,
    )
    const dom = new JSDOM(html).window.document
    const refs = [...dom.querySelectorAll("a[data-footnote-ref]")]
    const backrefs = [...dom.querySelectorAll("a[data-footnote-backref]")]

    expect(refs).toHaveLength(2)
    expect(backrefs).toHaveLength(2)
    for (const link of [...refs, ...backrefs]) {
      expect(link.getAttribute("href")).toMatch(/^#/)
      expect(link.hasAttribute("target")).toBe(false)
      expect(link.hasAttribute("rel")).toBe(false)
      // Each in-page link points at an element that exists.
      expect(dom.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull()
    }
    expect(backrefs[0].getAttribute("aria-label")).toBe("Back to reference 1")

    const ids = [...dom.querySelectorAll("[id]")].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)

    const label = dom.querySelector("h2.sr-only") as HTMLElement
    expect(label.textContent).toBe("Footnotes")
    expect(label.getAttribute("style")).toContain("position:absolute")
    expect(refs[0].getAttribute("aria-describedby")).toBe(label.id)
  })

  it("renders GFM task lists with a read-only checkbox and no bullet", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"- [x] Done\n- [ ] Todo"} />)
    const dom = new JSDOM(html).window.document
    const items = [...dom.querySelectorAll("li")]
    const boxes = [...dom.querySelectorAll('[role="checkbox"]')]

    expect(items.every((li) => li.getAttribute("style")?.includes("list-style-type:none"))).toBe(true)
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "false"])
    expect(boxes.every((box) => box.hasAttribute("disabled"))).toBe(true)
    // Only the KDS checkbox is exposed (Radix keeps a hidden form input of its own).
    expect(dom.querySelector("input:not([aria-hidden])")).toBeNull()
  })

  it("renders an escaped dollar inside math without breaking the span", () => {
    const html = renderToStaticMarkup(<ContentRenderer content={"It costs $\\$5 + x$ today."} />)

    expect(html).toContain("katex")
    expect(html).toContain("today.")
    expect(html).not.toContain("katex-error")
  })
})
