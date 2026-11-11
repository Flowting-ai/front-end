// Which text-preview files the file page renders from their own bytes, and how. Kept apart from the
// viewer so the preview can decide without loading the viewer (Markdown, highlighting) up front.

import type { LibraryFileDetail } from "../file";

export type SourceMode = "html" | "markdown" | "email" | "code" | "plain";

// Larger files keep the indexed text preview: rendering or highlighting megabytes in the page is slow.
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

const HTML = new Set(["html", "htm"]);
const MARKDOWN = new Set(["md", "markdown"]);
const PLAIN = new Set(["txt", "log", "rst"]);

export function sourceModeOf(extension: string | null | undefined): SourceMode | null {
  const ext = (extension ?? "").toLowerCase();
  if (HTML.has(ext)) return "html";
  if (MARKDOWN.has(ext)) return "markdown";
  if (ext === "eml") return "email";
  if (PLAIN.has(ext)) return "plain";
  return ext ? "code" : null;
}

/** Whether a text-preview file is shown from its own bytes (rendered, highlighted) instead of the indexed text. */
export function rendersSource(file: Pick<LibraryFileDetail, "extension" | "sizeBytes">): boolean {
  return sourceModeOf(file.extension) !== null && (file.sizeBytes ?? Number.POSITIVE_INFINITY) <= MAX_SOURCE_BYTES;
}
