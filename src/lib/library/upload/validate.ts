// Client-side pre-checks for a chosen file: fast feedback only. The server re-validates everything
// (it sniffs the real content type and scans the file); nothing here is a security control.

import type { Format, Limits, UploadFailureReason } from "../schemas";


export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 || dot === name.length - 1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** The format the server gives a file of this name (its extension map comes with the limits), or null when Library does not hold it. */
export function formatOf(name: string, extensions: Limits["extensions"]): Format | null {
  return extensions[extensionOf(name)] ?? null;
}

/** Why a file cannot be added, or null when it can. Duplicates are allowed (they become separate files). */
export function validateFile(file: Pick<File, "name" | "size">, limits: Pick<Limits, "maxFileBytes" | "allowedFormats" | "extensions">): UploadFailureReason | null {
  const format = formatOf(file.name, limits.extensions);
  if (format === null || !limits.allowedFormats.includes(format)) return "unsupported";
  if (file.size > limits.maxFileBytes) return "too_large";
  if (file.size === 0) return "unreadable";
  return null;
}
