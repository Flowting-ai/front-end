// Sample binary content for the Library mock (dev and tests only; never imported by the real API).

/** A valid 3-page PDF ("Sample document", "Returns", "Shipping"), base64. pdf.js parses it (verified). */
export const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFs1IDAgUiA3IDAgUiA5IDAgUl0gL0NvdW50IDMgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago0IDAgb2JqCjw8IC9MZW5ndGggMTQ0ID4+CnN0cmVhbQpCVAovRjEgMTggVGYKNzIgNzIwIFRkCihTYW1wbGUgZG9jdW1lbnQpIFRqCjAgLTI4IFRkCihUaGlzIGlzIGEgZ2VuZXJhdGVkIHNhbXBsZSBQREYgZm9yIHRoZSBMaWJyYXJ5IHByb3RvdHlwZS4pIFRqCjAgLTI4IFRkCihQYWdlIDEgb2YgMykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL0NvbnRlbnRzIDQgMCBSIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+ID4+CmVuZG9iago2IDAgb2JqCjw8IC9MZW5ndGggMTUwID4+CnN0cmVhbQpCVAovRjEgMTggVGYKNzIgNzIwIFRkCihSZXR1cm5zKSBUagowIC0yOCBUZAooSXRlbXMgY2FuIGJlIHJldHVybmVkIHdpdGhpbiAzMCBkYXlzIG9mIGRlbGl2ZXJ5IGluIG9yaWdpbmFsIGNvbmRpdGlvbi4pIFRqCjAgLTI4IFRkCihQYWdlIDIgb2YgMykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago3IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL0NvbnRlbnRzIDYgMCBSIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+ID4+CmVuZG9iago4IDAgb2JqCjw8IC9MZW5ndGggMTI1ID4+CnN0cmVhbQpCVAovRjEgMTggVGYKNzIgNzIwIFRkCihTaGlwcGluZykgVGoKMCAtMjggVGQKKFN0YW5kYXJkIHNoaXBwaW5nIHRha2VzIDMgdG8gNSBidXNpbmVzcyBkYXlzLikgVGoKMCAtMjggVGQKKFBhZ2UgMyBvZiAzKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgOCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gPj4KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTI3IDAwMDAwIG4gCjAwMDAwMDAxOTcgMDAwMDAgbiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNTE4IDAwMDAwIG4gCjAwMDAwMDA3MTkgMDAwMDAgbiAKMDAwMDAwMDg0NSAwMDAwMCBuIAowMDAwMDAxMDIxIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgMTAgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjExNDcKJSVFT0YK";

export const SAMPLE_PDF_PAGE_COUNT = 3;

/** The PDF as a data URL. The PDF viewer decodes data: URLs locally, so no network request or CSP entry is needed. */
export const SAMPLE_PDF_DATA_URL = `data:application/pdf;base64,${SAMPLE_PDF_BASE64}`;

/** A neutral picture for image previews, as an SVG data URL (rendered only through <img>, which is safe). */
export function sampleImageDataUrl(label: string): string {
  const safe = label.replace(/[<>&"']/g, "");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ead9f7"/><stop offset="1" stop-color="#c9e7d9"/></linearGradient></defs>' +
    '<rect width="1200" height="800" fill="url(#g)"/>' +
    '<text x="600" y="420" font-family="Helvetica, Arial, sans-serif" font-size="56" text-anchor="middle" fill="#3b3330">' +
    safe +
    "</text></svg>";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * A short sine-wave WAV as a blob: URL (media-src allows blob:). Browser only: call it from an
 * effect or an event handler, never during server rendering.
 */
export function createSampleAudioUrl(seconds = 6): string {
  const sampleRate = 8000;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.min(1, i / 400, (samples - i) / 400);
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 330 * i) / sampleRate) * 3000 * envelope), true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}
