/**
 * Security utilities for input sanitization and XSS prevention
 */

import DOMPurify from "isomorphic-dompurify";

// ---------------------------------------------------------------------------
// Sanitize presets
// ---------------------------------------------------------------------------

/**
 * Allowlist for KaTeX-rendered HTML.
 *
 * KaTeX emits nested <span> elements plus SVG for certain constructs.
 * We explicitly add the SVG tag-set so DOMPurify doesn't strip the output.
 */
const KATEX_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ADD_TAGS: [
    "svg",
    "g",
    "path",
    "use",
    "defs",
    "rect",
    "circle",
    "line",
    "polyline",
    "polygon",
    "clipPath",
    "mask",
    "symbol",
    "text",
    "tspan",
  ],
  ADD_ATTR: [
    "viewBox",
    "xmlns",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "width",
    "height",
    "d",
    "fill",
    "stroke",
    "stroke-width",
    "transform",
    "clip-path",
    "clip-rule",
    "id",
    "href",
    "xlink:href",
  ],
  FORCE_BODY: false,
};

/**
 * Minimal allowlist for inline Markdown-to-HTML content.
 *
 * Permits only the tags we actually generate via regex (strong / em / code /
 * br) — everything else is stripped, blocking all injection vectors.
 */
const INLINE_MARKDOWN_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: ["strong", "em", "code", "br", "span"],
  ALLOWED_ATTR: ["class"],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * Uses DOMPurify with default settings — safe for generic rich-text HTML that
 * does **not** contain KaTeX or SVG output.  For KaTeX, use `sanitizeKaTeX`.
 */
export function sanitizeHTML(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html) as string;
}

/**
 * Sanitize KaTeX-rendered HTML.
 *
 * KaTeX output is trusted (generated from controlled LaTeX), but it still
 * passes through DOMPurify so that any smuggled payload in the original AI
 * response cannot survive the render pipeline.
 */
export function sanitizeKaTeX(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, KATEX_CONFIG) as string;
}

/**
 * Sanitize inline Markdown-to-HTML output.
 *
 * Only `<strong>`, `<em>`, `<code>`, `<br>`, and `<span class="…">` survive.
 * Use this for any HTML that was produced by simple regex-based Markdown
 * expansion of untrusted text.
 */
export function sanitizeInlineMarkdown(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, INLINE_MARKDOWN_CONFIG) as string;
}

/**
 * Escape special HTML characters to prevent XSS
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Protocols explicitly permitted in rendered `href` attributes.
 *
 * Everything else — javascript:, data:, vbscript:, blob:, file:, etc. —
 * is blocked.  We use a positive allowlist (not a blocklist) so that future
 * unknown schemes are blocked by default.
 */
const SAFE_HREF_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Sanitize a URL before using it in an `href` attribute.
 *
 * Uses the native `URL()` parser to canonicalise the protocol, which makes
 * the check immune to unicode homoglyphs (ⓙavascript:), percent-encoding
 * tricks (%6Aavascript:), and mixed-case variants.
 *
 * Returns the original (untrimmed) URL string when safe, or an empty string
 * when the URL contains a disallowed protocol.
 *
 * Safe pass-throughs (returned unchanged):
 *  - Relative paths  /foo, ./foo, ../foo
 *  - Fragment links  #section
 *  - Query strings   ?q=1
 *  - www. prefixes   www.example.com  (caller prepends https://)
 */
export function sanitizeURL(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Relative / fragment / query URLs carry no protocol risk.
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith(".")
  ) {
    return trimmed;
  }

  // www. URLs have no protocol; they are safe — the caller prepends https://.
  if (/^www\./i.test(trimmed)) {
    return trimmed;
  }

  // Attempt to parse as an absolute URL and validate the protocol.
  try {
    const parsed = new URL(trimmed);
    return SAFE_HREF_PROTOCOLS.has(parsed.protocol) ? trimmed : "";
  } catch {
    // URL parsing failed.  If the string contains a colon (protocol-like) but
    // did not parse, treat it as unsafe.  Plain words / paths are fine.
    return trimmed.includes(":") ? "" : trimmed;
  }
}

// ---------------------------------------------------------------------------
// User-generated label sanitizers
// ---------------------------------------------------------------------------

/**
 * Maximum allowed character counts for user-visible labels.
 * These match the backend column constraints and prevent oversized payloads.
 */
const FOLDER_NAME_MAX_LEN = 50;
const TAG_NAME_MAX_LEN = 50;

/**
 * C0/C1 control-character regex.
 *
 * Strips null bytes (U+0000), ASCII control chars (U+0001–U+001F), DEL
 * (U+007F), and C1 control chars (U+0080–U+009F) from the input.
 * Regular printable Unicode, including emoji and non-ASCII scripts, is kept.
 */
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Sanitize a pin-folder name before storing or sending to the API.
 *
 * Rules applied (in order):
 *  1. Trim surrounding whitespace.
 *  2. Strip null bytes and C0/C1 control characters.
 *  3. Collapse runs of internal whitespace to a single space.
 *  4. Hard-truncate to FOLDER_NAME_MAX_LEN (50) characters.
 *  5. Re-trim (in case control chars were stripped from the edges).
 *
 * Returns an empty string if the result is blank after cleaning.
 */
export function sanitizeFolderName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .replace(CONTROL_CHAR_RE, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, FOLDER_NAME_MAX_LEN)
    .trim();
}

/**
 * Sanitize a pin tag name before storing or sending to the API.
 *
 * Rules applied (in order):
 *  1. Trim surrounding whitespace.
 *  2. Strip null bytes and C0/C1 control characters.
 *  3. Collapse runs of internal whitespace to a single space.
 *  4. Hard-truncate to TAG_NAME_MAX_LEN (50) characters.
 *  5. Re-trim.
 *
 * Returns an empty string if the result is blank after cleaning.
 */
export function sanitizeTagName(tag: string): string {
  if (!tag) return "";
  return tag
    .trim()
    .replace(CONTROL_CHAR_RE, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, TAG_NAME_MAX_LEN)
    .trim();
}

/**
 * Sanitize user input for search queries
 * Removes special regex characters to prevent ReDoS attacks
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return '';
  
  // Escape special regex characters
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize file name
 * Prevents path traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return '';
  
  // Remove path traversal attempts
  let clean = fileName.replace(/\.\./g, '');
  
  // Remove path separators
  clean = clean.replace(/[/\\]/g, '');
  
  // Remove null bytes
  clean = clean.replace(/\0/g, '');
  
  return clean.trim();
}

/**
 * Validate file type against whitelist
 */
export function isAllowedFileType(fileName: string, allowedTypes: string[]): boolean {
  if (!fileName) return false;
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  return allowedTypes.includes(extension);
}

/**
 * Validate file size
 */
export function isAllowedFileSize(size: number, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return size > 0 && size <= maxSizeInBytes;
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const safe: Record<string, unknown> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip __proto__, constructor, prototype
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      safe[key] = obj[key];
    }
  }
  
  return safe as T;
}

/**
 * Clear sensitive data from memory
 */
export function clearSensitiveData(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        // Overwrite string with zeros
        obj[key] = '\0'.repeat(value.length);
      }
      obj[key] = null;
    }
  }
}

/**
 * Sanitize JSON input to prevent injection
 */
export function sanitizeJSON(json: string): unknown {
  try {
    // Parse and re-stringify to ensure it's valid JSON
    const parsed = JSON.parse(json);
    
    // Validate that it doesn't contain functions or undefined
    if (typeof parsed === 'function') {
      throw new Error('Functions not allowed');
    }
    
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rate limiter for client-side actions
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  canProceed(): boolean {
    const now = Date.now();
    
    // Remove timestamps outside the current window
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }
  
  reset(): void {
    this.timestamps = [];
  }
}
