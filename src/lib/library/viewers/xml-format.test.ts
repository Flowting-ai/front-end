// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatHtml, formatXml } from "./xml-format";

describe("formatHtml", () => {
  it("lays out minified HTML, keeping text, styles and code as written", () => {
    const html = `<!doctype html><html lang="en"><head><title>Guide</title><style>p{color:red}</style></head><body><h1>Title</h1><table><tr><td>A &amp; B</td><td><code>O(1)</code></td></tr></table><pre>def f():\n    return 1</pre></body></html>${" ".repeat(220)}`;
    expect(formatHtml(html)).toBe([
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      "    <title>Guide</title>",
      "    <style>p{color:red}</style>",
      "  </head>",
      "  <body>",
      "    <h1>Title</h1>",
      "    <table>",
      "      <tbody>",
      "        <tr>",
      "          <td>A &amp; B</td>",
      "          <td><code>O(1)</code></td>",
      "        </tr>",
      "      </tbody>",
      "    </table>",
      "    <pre>def f():\n    return 1</pre>",
      "  </body>",
      "</html>",
    ].join("\n"));
  });
});

describe("formatXml", () => {
  it("puts one element per line, indented, keeping text and code exactly", () => {
    const xml = "<?xml version='1.0' encoding='utf-8'?><guide title=\"A &amp; B\"><section id=\"1\"><heading>Overview</heading><p>Uses <b>bold</b> text.</p></section><example>def f():\n    return 1 &lt; 2</example></guide>";
    expect(formatXml(xml)).toBe([
      "<?xml version='1.0' encoding='utf-8'?>",
      '<guide title="A &amp; B">',
      '  <section id="1">',
      "    <heading>Overview</heading>",
      "    <p>Uses <b>bold</b> text.</p>",
      "  </section>",
      "  <example>def f():\n    return 1 &lt; 2</example>",
      "</guide>",
    ].join("\n"));
  });

  it("leaves XML that is already laid out, and anything that does not parse, unchanged", () => {
    const formatted = "<a>\n  <b>1</b>\n  <c>2</c>\n  <d>3</d>\n</a>";
    expect(formatXml(formatted)).toBe(formatted);
    const broken = "<a><b></a>";
    expect(formatXml(broken)).toBe(broken);
  });
});
