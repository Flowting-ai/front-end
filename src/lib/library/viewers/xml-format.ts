// Pretty-prints XML for the file page: one element per line, nested elements indented. Text is never
// changed: an element whose content is only text stays on one line exactly as written (multi-line text,
// code, keeps its own line breaks), and an element that mixes text with child elements is kept as
// written. Anything that does not parse as XML is returned unchanged.

const INDENT = "  ";

/** Whether the text already has its elements on separate lines (then it is shown as written). */
function looksFormatted(xml: string): boolean {
  const lines = xml.split("\n");
  return lines.length > 3 && Math.max(...lines.map((line) => line.length)) <= 200;
}

export function formatXml(xml: string): string {
  if (looksFormatted(xml) || typeof DOMParser === "undefined") return xml;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;
  const serializer = new XMLSerializer();
  const out: string[] = [];

  const print = (node: Node, depth: number) => {
    const pad = INDENT.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim()) out.push(pad + serializer.serializeToString(node).trim());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Comments, CDATA, processing instructions: as written.
      out.push(pad + serializer.serializeToString(node));
      return;
    }
    const element = node as Element;
    const children = Array.from(element.childNodes);
    const elementChildren = children.filter((child) => child.nodeType === Node.ELEMENT_NODE);
    const hasText = children.some((child) => (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) && (child.textContent ?? "").trim());
    // Text only, or text mixed with elements: the element as written.
    if (elementChildren.length === 0 || hasText) {
      out.push(pad + serializer.serializeToString(element));
      return;
    }
    // Only child elements (and white space): open tag, each child indented, close tag.
    const shallow = element.cloneNode(false) as Element;
    const tag = serializer.serializeToString(shallow);
    // A childless clone serializes as <name .../>; split it into an open and a close tag.
    const open = tag.replace(/\s*\/>$/, ">");
    out.push(pad + open);
    for (const child of children) print(child, depth + 1);
    out.push(`${pad}</${element.tagName}>`);
  };

  const declaration = /^\s*(<\?xml[^>]*\?>)/.exec(xml);
  if (declaration) out.push(declaration[1]);
  for (const child of Array.from(doc.childNodes)) print(child, 0);
  return out.join("\n");
}

// Content that is shown as written, never re-laid out (white space or code matters inside).
const HTML_AS_WRITTEN = new Set(["PRE", "TEXTAREA", "SCRIPT", "STYLE", "CODE"]);
// Inline elements stay on their parent's line; only an element holding a block is opened up.
const HTML_INLINE = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "CODE", "DATA", "DFN", "EM", "I", "IMG", "KBD", "MARK", "Q", "S",
  "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR", "WBR", "LABEL", "INPUT", "BUTTON", "SELECT",
]);

/**
 * The same layout for an HTML source view: elements that only hold other elements are opened, indented
 * and closed on their own lines; anything holding text (a paragraph, a cell, <pre>, <style>) stays on
 * one line as written. Only for minified HTML (long lines); a laid-out file is shown as written.
 */
export function formatHtml(html: string): string {
  if (looksFormatted(html) || typeof DOMParser === "undefined") return html;
  // Parsing only: a parsed document runs no scripts and loads nothing.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  const doctype = /^\s*(<!doctype[^>]*>)/i.exec(html);
  if (doctype) out.push(doctype[1]);

  const print = (node: Node, depth: number) => {
    const pad = INDENT.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) out.push(pad + text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      return;
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      out.push(`${pad}<!--${node.textContent ?? ""}-->`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const children = Array.from(element.childNodes);
    const hasText = children.some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim());
    const hasBlocks = children.some((child) => child.nodeType === Node.ELEMENT_NODE && !HTML_INLINE.has((child as Element).tagName));
    if (HTML_AS_WRITTEN.has(element.tagName) || hasText || !hasBlocks) {
      out.push(pad + element.outerHTML);
      return;
    }
    const tag = element.tagName.toLowerCase();
    const open = (element.cloneNode(false) as Element).outerHTML.replace(new RegExp(`</${tag}>$`, "i"), "");
    out.push(pad + open);
    for (const child of children) print(child, depth + 1);
    out.push(`${pad}</${tag}>`);
  };

  print(doc.documentElement, 0);
  return out.join("\n");
}
