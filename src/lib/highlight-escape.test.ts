import { describe, expect, it } from "vitest"
import hljs from "highlight.js/lib/common"

// CodeBlock renders hljs output with dangerouslySetInnerHTML and no DOMPurify
// pass. That is safe only because hljs HTML-escapes every piece of source
// text; this test fails if that ever stops being true.
describe("highlight.js output escaping", () => {
  const payload = '</code><img src=x onerror="alert(1)"><script>alert(2)</script>'

  it("escapes markup in explicit-language highlighting", () => {
    const html = hljs.highlight(payload, { language: "javascript", ignoreIllegals: true }).value
    expect(html).not.toMatch(/<img|<script|<\/code>/)
  })

  it("escapes markup in auto-detected highlighting", () => {
    const html = hljs.highlightAuto(payload).value
    expect(html).not.toMatch(/<img|<script|<\/code>/)
  })
})
