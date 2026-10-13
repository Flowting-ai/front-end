// Where the PDF viewer gets its bytes. A data: URL (the mock's sample, or any small inline PDF) is
// decoded right here, so it needs no network request and no CSP entry. Anything else is an https URL
// to short-lived storage that pdf.js fetches itself; that origin must be in the CSP's connect-src.

export type PdfSource = { kind: "data"; data: Uint8Array } | { kind: "url"; url: string };

const DATA_URL = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/;

/** Whether a URL is a source the viewer may load, without decoding anything (cheap enough to call during render). */
export function isPdfUrlAllowed(url: string): boolean {
  return DATA_URL.test(url) || /^https:\/\//i.test(url) || url.startsWith("/");
}

export function resolvePdfSource(url: string): PdfSource | null {
  const inline = DATA_URL.exec(url);
  if (inline) {
    try {
      const binary = atob(inline[1]);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) data[i] = binary.charCodeAt(i);
      return { kind: "data", data };
    } catch {
      return null;
    }
  }
  // Only https (or same-origin relative) storage URLs; never javascript:, blob: from elsewhere, or other data: types.
  if (/^https:\/\//i.test(url) || url.startsWith("/")) return { kind: "url", url };
  return null;
}
