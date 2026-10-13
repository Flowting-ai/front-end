// Client-side pre-checks for a chosen file: fast feedback only. The server re-validates everything
// (it sniffs the real content type and scans the file); nothing here is a security control.

import type { Format, Limits, UploadFailureReason } from "../schemas";

/** The extensions Library accepts and the format each maps to (PRD CAP-18). Anything else is "unsupported". */
const FORMAT_BY_EXTENSION: Record<string, Format> = {
  pdf: "pdf",
  docx: "document",
  doc: "document",
  rtf: "document",
  epub: "document",
  pptx: "slides",
  ppt: "slides",
  xlsx: "sheet",
  xls: "sheet",
  csv: "sheet",
  txt: "text",
  md: "text",
  json: "text",
  xml: "text",
  html: "web",
  eml: "email",
  msg: "email",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  svg: "image",
  tiff: "image",
  avif: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 || dot === name.length - 1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function guessFormat(name: string): Format | null {
  return FORMAT_BY_EXTENSION[extensionOf(name)] ?? null;
}

/** Why a file cannot be added, or null when it can. Duplicates are allowed (they become separate files). */
export function validateFile(file: Pick<File, "name" | "size">, limits: Pick<Limits, "maxFileBytes" | "allowedFormats">): UploadFailureReason | null {
  const format = guessFormat(file.name);
  if (format === null || !limits.allowedFormats.includes(format)) return "unsupported";
  if (file.size > limits.maxFileBytes) return "too_large";
  if (file.size === 0) return "unreadable";
  return null;
}
