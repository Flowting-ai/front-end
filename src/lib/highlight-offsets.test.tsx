import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { rawRangeFromVisibleRange } from "./highlight-offsets"
import { LineRenderer } from "./line-renderer"
import type { HighlightSpec } from "./markdown-utils"

function renderWithHighlight(content: string, startOffset: number, endOffset: number) {
  const highlights: HighlightSpec[] = [{
    id: "h1",
    text: content.slice(startOffset, endOffset),
    colorIndex: 0,
    startOffset,
    endOffset,
  }]
  return renderToStaticMarkup(<LineRenderer content={content} highlights={highlights} />)
}

function markCount(html: string) {
  return (html.match(/data-highlight-id="h1"/g) ?? []).length
}

describe("raw offset highlights", () => {
  it("maps visible bold text selection back to raw markdown indexes", () => {
    const content = "This is **very important** today."
    const visible = "This is very important today."
    const visibleStart = visible.indexOf("very important")
    const range = rawRangeFromVisibleRange(content, visibleStart, visibleStart + "very important".length)

    expect(range).toEqual({
      startOffset: content.indexOf("very important"),
      endOffset: content.indexOf("very important") + "very important".length,
    })
  })

  it("renders a raw range inside bold markdown without highlighting the markers", () => {
    const content = "This is **very important** today."
    const start = content.indexOf("very important")
    const html = renderWithHighlight(content, start, start + "very important".length)

    expect(markCount(html)).toBe(1)
    expect(html).toContain("<strong")
    expect(html).toContain(">very important</mark>")
    expect(html).not.toContain("**")
  })

  it("uses raw indexes to highlight only the selected repeated phrase", () => {
    const content = "Alpha repeat. Alpha repeat."
    const start = content.lastIndexOf("Alpha repeat")
    const html = renderWithHighlight(content, start, start + "Alpha repeat".length)

    expect(markCount(html)).toBe(1)
    expect(html).toContain("Alpha repeat. <mark")
  })

  it("supports partial selections inside bold markdown", () => {
    const content = "This is **very important** today."
    const start = content.indexOf("important")
    const html = renderWithHighlight(content, start, start + "important".length)

    expect(markCount(html)).toBe(1)
    expect(html).toContain("very <mark")
    expect(html).toContain(">important</mark>")
  })

  it("supports raw ranges in plain text, list items, and inline code", () => {
    const plain = "Plain text highlight"
    expect(renderWithHighlight(plain, 6, 10)).toContain(">text</mark>")

    const list = "- First item\n- Second item"
    const listStart = list.indexOf("Second")
    expect(renderWithHighlight(list, listStart, listStart + "Second".length)).toContain(">Second</mark>")

    const code = "Use `inline_code` here"
    const codeStart = code.indexOf("inline_code")
    const codeHtml = renderWithHighlight(code, codeStart, codeStart + "inline_code".length)
    expect(codeHtml).toContain("<code")
    expect(codeHtml).toContain(">inline_code</mark>")
  })

  it("supports raw ranges in fenced code blocks", () => {
    const content = "```ts\nconst value = 1\nconst value = 2\n```"
    const start = content.lastIndexOf("const value")
    const html = renderWithHighlight(content, start, start + "const value".length)

    expect(markCount(html)).toBe(1)
    expect(html).toContain("const value = 1")
    expect(html).toContain("<mark")
    expect(html).toContain(">const value</mark> = 2")
  })

  it("does not inject marks into inline LaTeX", () => {
    const content = "Math $x+1$ here"
    const start = content.indexOf("x+1")
    const html = renderWithHighlight(content, start, start + "x+1".length)

    expect(markCount(html)).toBe(0)
    expect(html).toContain("katex")
  })
})
