// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { inertHtml } from "./inert-html";

const body = (srcDoc: string) => new DOMParser().parseFromString(srcDoc, "text/html").body;

describe("inertHtml", () => {
  it("removes scripts, frames, templates and handlers, and anything that loads or submits", () => {
    const { srcDoc } = inertHtml(
      '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://e.x"></iframe>' +
        '<template shadowrootmode="open"><img src="https://t.x/p"></template>' +
        '<form action="https://e.x"><button formaction="https://e.x">Go</button></form>' +
        '<svg><a xlink:href="javascript:alert(1)"><text>s</text></a><image href="https://t.x/i"/></svg><a href="https://ok.x" ping="https://t.x">ok</a>',
      false,
    );
    expect(srcDoc).not.toMatch(/<script|<iframe|<template|onclick|action=|formaction|xlink:href|ping=|t\.x/);
    expect(srcDoc).toContain('content="default-src \'none\';');
    const link = body(srcDoc).querySelector('a[href="https://ok.x"]');
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("ends with a height reset that wins over the file's own full-height rules", () => {
    const { srcDoc } = inertHtml("<style>html,body{height:100% !important;min-height:100vh}</style><p>x</p>", false);
    const styles = [...new DOMParser().parseFromString(srcDoc, "text/html").querySelectorAll("style")].map((s) => s.textContent ?? "");
    expect(styles[styles.length - 1]).toContain("height:auto!important");
  });

  it("keeps only web, mail and in-page link targets", () => {
    const { srcDoc } = inertHtml('<a href="javascript:alert(1)">a</a><a href="data:text/html,x">b</a><a href="mailto:a@b.c">c</a><a href="#top">d</a>', false);
    const hrefs = [...body(srcDoc).querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([null, null, "mailto:a@b.c", "#top"]);
  });

  it("hides web images until shown, labels email attachments, and keeps inline images", () => {
    const html = '<img src="https://e.x/a.png" alt="Logo"><img src="cid:part1" alt="Chart"><img src="data:image/png;base64,AA==">';
    const hidden = inertHtml(html, false);
    expect(hidden.blocked).toBe(1);
    expect(body(hidden.srcDoc).textContent).toContain("Image hidden: Logo");
    expect(body(hidden.srcDoc).textContent).toContain("Attached image: Chart");
    expect(body(hidden.srcDoc).querySelectorAll("img")).toHaveLength(1);
    const shown = inertHtml(html, true);
    expect(body(shown.srcDoc).querySelector('img[src="https://e.x/a.png"]')).not.toBeNull();
    expect(shown.srcDoc).toContain("img-src data: https:");
  });
});
