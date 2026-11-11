// Makes a file's HTML (a web page, an email body, converted RTF) safe to show in the file page's
// sandboxed frame: nothing in it can run, load, navigate the app or submit anything.

// The frame's own policy: nothing loads but inline styles and data: images (and, once the person
// asks, https images). Links open in a new tab. Base styles give unstyled pages readable defaults.
function frameHead(showImages: boolean): string {
  return [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:${showImages ? " https:" : ""}; style-src 'unsafe-inline'; font-src data:">`,
    '<base target="_blank">',
    "<style>",
    "html{color-scheme:light;background:#fff}",
    // break-word (not anywhere): a long URL still wraps, but table columns keep whole words.
    'body{display:flow-root;margin:0;padding:28px 32px;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f1f1f;overflow-wrap:break-word}',
    "img,video{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}",
    // The app's scrollbar (.kaya-scrollbar, --neutral-800-30 / -50), for a page wider than the frame.
    // The frame does not see the app's styles, so the values are repeated here.
    "*{scrollbar-width:thin;scrollbar-color:rgba(59,54,50,.3) transparent}",
    "::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}",
    "::-webkit-scrollbar-thumb{background-color:rgba(59,54,50,.3);border-radius:999px}::-webkit-scrollbar-thumb:hover{background-color:rgba(59,54,50,.5)}",
    ".sv-blocked{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:6px 10px;border:1px dashed #c9c4bd;border-radius:6px;background:#faf8f5;color:#77716a;font:12px/1.4 system-ui,sans-serif}",
    "</style>",
  ].join("");
}

// Elements that load or run something; removed outright. <template> too: a declarative shadow root
// (<template shadowrootmode>) is not attached by DOMParser, so its content would skip the clean-up
// here and come alive when the frame parses it.
const DROP = "script, noscript, iframe, frame, frameset, object, embed, applet, link, meta, base, portal, template";
// Attributes that load, navigate or submit; dropped unless they are an inline data: image URL.
const LOADS = ["src", "srcset", "poster", "background", "data", "href", "xlink:href", "action", "formaction", "ping", "srcdoc"];

/** A link target safe to open from a file: web and mail addresses, and anchors within the page. */
function safeLink(href: string): boolean {
  const value = href.trim();
  if (value.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * The file's markup with everything that would load or run removed, so not even the browser's preload
 * scanner (which runs before the frame's own policy applies) can fetch a remote image or tracker.
 * Remote images become a labelled placeholder until the person chooses to show them; images attached
 * to an email (cid:) cannot be shown and say so. Links keep a web or mail target (anything else, such
 * as javascript:, is removed) and open in a new tab without access back to the app.
 */
export function inertHtml(html: string, showImages: boolean): { srcDoc: string; blocked: number } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(DROP).forEach((element) => element.remove());
  let blocked = 0;
  const placeholder = (label: string) => {
    const span = doc.createElement("span");
    span.className = "sv-blocked";
    span.textContent = label;
    return span;
  };
  doc.querySelectorAll("img").forEach((image) => {
    const src = (image.getAttribute("src") ?? "").trim();
    if (!src || /^data:image\//i.test(src) || (showImages && /^https:/i.test(src))) return;
    if (/^cid:/i.test(src)) {
      image.replaceWith(placeholder(`Attached image${image.alt ? `: ${image.alt}` : ""}`));
      return;
    }
    if (!/^https?:/i.test(src)) {
      image.remove();
      return;
    }
    blocked += 1;
    if (!showImages) image.replaceWith(placeholder(`Image hidden${image.alt ? `: ${image.alt}` : ""}`));
  });
  doc.querySelectorAll("*").forEach((element) => {
    const isLink = element.tagName === "A";
    for (const name of LOADS) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      if (name === "href" && isLink && safeLink(value)) continue;
      if (name === "src" && element.tagName === "IMG" && (/^data:image\//i.test(value.trim()) || (showImages && /^https:/i.test(value.trim())))) continue;
      element.removeAttribute(name);
    }
    if (isLink) element.setAttribute("rel", "noopener noreferrer");
    for (const attribute of Array.from(element.attributes)) if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
  });
  doc.head.insertAdjacentHTML("afterbegin", frameHead(showImages));
  // Last in the document, so it wins over the file's own rules (even !important ones, which emails
  // often set): the frame takes the document's height, so a document sized from the frame
  // (height:100%, min-height:100vh) would grow it without end.
  doc.body.insertAdjacentHTML("beforeend", "<style>html,body{height:auto!important;min-height:0!important;max-height:none!important}</style>");
  return { srcDoc: `<!doctype html>${doc.documentElement.outerHTML}`, blocked };
}
