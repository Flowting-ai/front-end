// Where the PDF viewer gets its bytes: an https URL to short-lived storage (or a same-origin path)
// that pdf.js fetches itself; that origin must be in the CSP's connect-src.

export type PdfSource = { kind: "url"; url: string };

/** Whether a URL is a source the viewer may load (cheap enough to call during render). */
export function isPdfUrlAllowed(url: string): boolean {
  return /^https:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

export function resolvePdfSource(url: string): PdfSource | null {
  // Only https (or same-origin relative) storage URLs; never javascript:, blob:, data: or other schemes.
  return isPdfUrlAllowed(url) ? { kind: "url", url } : null;
}
