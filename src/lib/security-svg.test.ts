import { describe, expect, it } from "vitest"
import { renderMermaidSVG } from "beautiful-mermaid"
import { sanitizeSVG } from "./security"

describe("sanitizeSVG", () => {
  it("strips scripts, handlers and foreignObject", () => {
    const out = sanitizeSVG(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script>' +
        '<foreignObject><img src=x onerror="alert(3)"></foreignObject><rect width="10" height="10"/></svg>',
    )
    expect(out).not.toMatch(/onload|onerror|<script|foreignObject|alert/)
    expect(out).toContain("<rect")
  })

  it("keeps a real Mermaid diagram intact", () => {
    const svg = renderMermaidSVG("graph TD\n  A[Start] --> B[End]", {})
    const out = sanitizeSVG(svg)
    expect(out).toContain("<svg")
    expect(out).toContain("Start")
    expect(out).toContain("End")
    // Only scripting is dropped, so the drawing keeps (almost) all of its markup.
    expect(out.length).toBeGreaterThan(svg.length * 0.8)
  })

  it("escapes markup smuggled into a node label", () => {
    const out = sanitizeSVG(renderMermaidSVG('graph TD\n  A["<img src=x onerror=alert(1)>"] --> B', {}))
    // The label may survive as text or inside a quoted attribute value
    // (data-label="<img …>", inert), but never as a live element.
    expect(out.replace(/"[^"]*"/g, '""')).not.toMatch(/<img/)
  })
})
