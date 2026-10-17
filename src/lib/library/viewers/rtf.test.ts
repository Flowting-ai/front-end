import { describe, expect, it } from "vitest";
import { isRtfDocument, rtfToHtml, wrapRtfFragment } from "./rtf";

// The shape pandoc writes without --standalone: no {\rtf1 header, no font table.
const fragment = [
  "{\\pard \\ql \\f0 \\sa180 \\li0 \\fi0 \\outlinelevel0 \\b \\fs36 Mini Guide\\par}",
  "{\\pard \\ql \\f0 \\sa180 \\li0 \\fi0 Plain text with {\\b bold} and {\\i italic}.\\par}",
  "{",
  "\\trowd \\trgaph120",
  "\\cellx2160\\cellx4320",
  "\\trkeep\\intbl",
  "{",
  "{{\\pard\\intbl \\ql \\f0 \\sa0 \\li0 \\fi0 Concept\\par}",
  "\\cell}",
  "{{\\pard\\intbl \\ql \\f0 \\sa0 \\li0 \\fi0 Purpose\\par}",
  "\\cell}",
  "}",
  "\\intbl\\row}",
  "{\\pard \\ql \\f0 \\sa180 \\li0 \\fi0 \\f1 def f(x):\\line",
  "    return x\\par}",
].join("\n");

describe("rtf", () => {
  it("tells a document from a fragment, and wraps a fragment", () => {
    expect(isRtfDocument("{\\rtf1\\ansi hi}")).toBe(true);
    expect(isRtfDocument(fragment)).toBe(false);
    expect(isRtfDocument(wrapRtfFragment(fragment))).toBe(true);
  });

  it("renders a pandoc fragment: heading, inline styles, table, code with its indentation", () => {
    const html = rtfToHtml(fragment);
    expect(html).not.toContain("\\pard");
    expect(html).toContain('<span style="font-weight:700;font-size:18pt;');
    expect(html).toContain("Mini Guide");
    expect(html).toMatch(/<span style="font-weight:700[^"]*">bold<\/span>/);
    expect(html).toMatch(/<span style="font-style:italic[^"]*">italic<\/span>/);
    expect(html).toMatch(/<table class="rtf-table"><tr><td>.*Concept.*<\/td><td>.*Purpose.*<\/td><\/tr><\/table>/);
    // One paragraph per cell: no empty trailing paragraph from \cell after \par.
    expect(html).not.toContain("<br></p></td>");
    expect(html).toContain("def f(x):<br>    return x");
    expect(html).toContain("Courier New");
  });

  it("reads font and colour tables, code-page and Unicode escapes, alignment and page breaks", () => {
    const html = rtfToHtml([
      "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\froman Times New Roman;}{\\f1\\fswiss Arial;}}",
      "{\\colortbl;\\red200\\green30\\blue60;}",
      "\\pard\\qc\\f1\\cf1 Caf\\'e9 \\u8364? euro\\par",
      "\\page\\pard\\qr Right\\par}",
    ].join("\n"));
    expect(html).toContain("text-align:center");
    expect(html).toContain("font-family:'Arial'");
    expect(html).toContain("color:rgb(200, 30, 60)");
    expect(html).toContain("Café € euro");
    expect(html).toContain('<hr class="rtf-page">');
    expect(html).toContain("text-align:right");
  });

  it("ends a Unicode fallback with its group, and keeps cell text without \\intbl in the cell", () => {
    expect(rtfToHtml("{\\rtf1\\pard {\\u8364}x\\par}")).toContain("€x");
    const html = rtfToHtml("{\\rtf1\\trowd\\cellx1000\\cellx2000\\pard A\\cell B\\cell\\row\\pard After\\par}");
    expect(html).toMatch(/<table class="rtf-table"><tr><td>.*A.*<\/td><td>.*B.*<\/td><\/tr><\/table>.*After/);
  });

  it("keeps a font name from adding CSS", () => {
    const html = rtfToHtml("{\\rtf1{\\fonttbl{\\f0 x';background:url(https://t.example/p);x:';}}\\pard\\f0 Hi\\par}");
    expect(html).not.toContain("url(");
    expect(html).not.toContain("background");
    expect(html).toContain("Hi");
  });

  it("escapes text and skips hidden destinations", () => {
    const html = rtfToHtml("{\\rtf1{\\info{\\title secret}}{\\*\\generator x;}\\pard <script>alert(1)</script>\\par}");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("<script>");
  });
});
