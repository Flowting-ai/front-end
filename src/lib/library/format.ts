// Pure display helpers. Every function that depends on "now" or the time zone takes them as
// arguments (with a sensible default) so tests can pin them.

import type { Format, FormatGroup } from "./schemas";
import type { LibraryFile } from "./file";

// ── Formats ───────────────────────────────────────────────────────────────────

const GROUP_BY_FORMAT: Record<Format, FormatGroup> = {
  pdf: "pdfs",
  document: "documents",
  slides: "documents",
  text: "documents",
  web: "documents",
  email: "documents",
  sheet: "spreadsheets",
  image: "images",
  audio: "audio",
};

export function formatGroupOf(format: Format): FormatGroup {
  return GROUP_BY_FORMAT[format];
}

export function formatsInGroup(group: FormatGroup): Format[] {
  return (Object.keys(GROUP_BY_FORMAT) as Format[]).filter((format) => GROUP_BY_FORMAT[format] === group);
}

const FORMAT_LABELS: Record<Format, string> = {
  pdf: "PDF",
  document: "Document",
  slides: "Slides",
  text: "Text",
  web: "Web page",
  email: "Email",
  sheet: "Spreadsheet",
  image: "Image",
  audio: "Audio",
};

export function formatLabel(format: Format): string {
  return FORMAT_LABELS[format];
}

export const FORMAT_GROUP_LABELS: Record<FormatGroup, string> = {
  images: "Images",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  pdfs: "PDFs",
  audio: "Audio",
};

// ── Sizes ─────────────────────────────────────────────────────────────────────

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Decimal units (1 KB = 1000 B), one decimal for MB and above and two for GB, like the storage line in the prototype. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let unit = 0;
  let value = bytes;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit <= 1 ? 0 : unit === 2 ? 1 : 2;
  // A whole number reads "20 GB", not "20.00 GB"; "1.50 GB" keeps its digits.
  return `${value.toFixed(digits).replace(/\.0+$/, "")} ${UNITS[unit]}`;
}

export function storageLabel(usedBytes: number, limitBytes: number | null): string {
  return limitBytes === null
    ? `${formatBytes(usedBytes)} used`
    : `${formatBytes(usedBytes)} of ${formatBytes(limitBytes)} used`;
}

export function storageShare(usedBytes: number, limitBytes: number | null): number {
  if (limitBytes === null || limitBytes <= 0) return 0;
  return Math.min(1, Math.max(0, usedBytes / limitBytes));
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(ms: number, timeZone?: string): number {
  // Whole calendar days in the viewer's time zone, so "Today" flips at their midnight and not at UTC's.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS);
}

function timeOfDay(ms: number, timeZone?: string): string {
  // Newer ICU versions put a narrow no-break space before AM/PM; a plain space keeps the text predictable.
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(ms).replace(/[\u202F\u00A0]/g, " ");
}

/** "Today, 3:42 PM", "Yesterday, 9:05 AM", "Oct 3, 11:20 AM". */
export function formatDateTime(iso: string, now: number = Date.now(), timeZone?: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const gap = dayNumber(now, timeZone) - dayNumber(at, timeZone);
  if (gap <= 0) return `Today, ${timeOfDay(at, timeZone)}`;
  if (gap === 1) return `Yesterday, ${timeOfDay(at, timeZone)}`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at);
  return `${date}, ${timeOfDay(at, timeZone)}`;
}

/** "today", "2d ago", "1w ago", "3mo ago". */
export function agoShort(iso: string, now: number = Date.now(), timeZone?: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const days = dayNumber(now, timeZone) - dayNumber(at, timeZone);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  return `${Math.max(1, Math.floor(days / 30))}mo ago`;
}

/** The latest thing that happened to a file, in generic words: Created 2d ago, Shared today. */
export function activityLine(file: Pick<LibraryFile, "lastActivityAt" | "lastActivityKind">, now: number = Date.now(), timeZone?: string): string {
  const word = { created: "Created", opened: "Opened", modified: "Modified", shared: "Shared" }[file.lastActivityKind];
  return `${word} ${agoShort(file.lastActivityAt, now, timeZone)}`;
}

export function daysLeftLabel(daysLeft: number | undefined): string {
  if (daysLeft === undefined) return "";
  return daysLeft === 1 ? "1 day" : `${daysLeft} days`;
}

// ── Untrusted text ───────────────────────────────────────────────────────────

// File names, titles and people's names come from users. They are only ever rendered as React text,
// but control characters, zero-width characters and bidi overrides can still make a name look like
// something else (a right-to-left override can make "invoice" + "fdp.exe" read as a different extension), so strip them for display. The original is never changed.
const UNSAFE_DISPLAY_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function sanitizeDisplayText(text: string): string {
  // Whitespace (including tabs and newlines, which are control characters too) becomes a single space
  // first; only then are the remaining invisible characters removed.
  return text.replace(/\s+/g, " ").replace(UNSAFE_DISPLAY_CHARS, "").trim();
}

export function truncateText(text: string, max: number): string {
  if (max <= 1 || text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}\u2026`;
}

export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Browser tab title for a file page: a sanitised, truncated name, never the raw one. */
export function fileDocumentTitle(file: LibraryFile): string {
  return `${truncateText(file.name, 80)} | Library`;
}
