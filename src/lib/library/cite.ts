// A citation opens a file at a place in it: a page, a sheet row, or a time in a recording. The place
// travels in the URL as `?cite=<type>:<value>` (page:2, row:Rates!14, time:42000) so a link to a
// passage works for anyone who can open the file. Anything that does not parse is simply ignored.

import type { CiteLocator } from "./schemas";

const TYPES = ["page", "row", "time"] as const;

// A page citation may also carry the cited sentence in `?passage=`, so the viewer can mark that passage
// instead of the whole page. A passage that is not found on the page just falls back to the page.

const MAX_PASSAGE = 500;

export function parseCite(value: string | null | undefined, passage?: string | null): CiteLocator | null {
  if (!value || value.length > 200) return null;
  const colon = value.indexOf(":");
  if (colon < 1) return null;
  const type = value.slice(0, colon);
  const rest = value.slice(colon + 1);
  if (!(TYPES as readonly string[]).includes(type) || rest.length === 0) return null;
  if (type === "time" && !/^\d+$/.test(rest)) return null;
  const locator: CiteLocator = { type: type as CiteLocator["type"], value: rest };
  const cleanPassage = passage?.replace(/\s+/g, " ").trim();
  if (type === "page" && cleanPassage && cleanPassage.length <= MAX_PASSAGE) locator.passage = cleanPassage;
  return locator;
}

export function formatCite(locator: CiteLocator): string {
  return `${locator.type}:${locator.value}`;
}

/** The query string a citation link carries: `cite=page:2&passage=...`. */
export function citeQuery(locator: CiteLocator): string {
  const params = new URLSearchParams({ cite: formatCite(locator) });
  if (locator.type === "page" && locator.passage) params.set("passage", locator.passage);
  return params.toString();
}

function passagePattern(passage: string): RegExp | null {
  const words = passage.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
}

/** Splits text around the first match of a passage (case and spacing ignored); null when it is not there. */
export function splitPassage(text: string, passage: string | null | undefined): { before: string; match: string; after: string } | null {
  if (!passage) return null;
  const pattern = passagePattern(passage);
  const found = pattern ? pattern.exec(text) : null;
  if (!found) return null;
  return { before: text.slice(0, found.index), match: found[0], after: text.slice(found.index + found[0].length) };
}

/**
 * Which text runs of a page (a PDF's text items, in reading order) hold a passage, matched across run
 * boundaries. Returns their indices, or an empty list when the passage is not on the page.
 */
export function passageRuns(runs: string[], passage: string | null | undefined): number[] {
  if (!passage) return [];
  const pattern = passagePattern(passage);
  if (!pattern) return [];
  const starts: number[] = [];
  let joined = "";
  for (const run of runs) {
    starts.push(joined.length);
    joined += `${run} `;
  }
  const found = pattern.exec(joined);
  if (!found) return [];
  const from = found.index;
  const to = found.index + found[0].length;
  const hit: number[] = [];
  runs.forEach((run, index) => {
    const start = starts[index];
    const end = start + run.length;
    if (run.trim() && start < to && end > from) hit.push(index);
  });
  return hit;
}

/** "Rates!14" or "14" to a sheet name (when given) and a 1-based row number; null when there is no usable row. */
export function parseRowCite(value: string): { sheet?: string; row: number } | null {
  const bang = value.lastIndexOf("!");
  const rowText = bang >= 0 ? value.slice(bang + 1) : value;
  const row = Number(rowText);
  if (!Number.isInteger(row) || row < 1) return null;
  return bang > 0 ? { sheet: value.slice(0, bang), row } : { row };
}

/** A page citation as a 1-based page number, accepting "2", "Page 2" or "p. 2". */
export function parsePageCite(value: string): number | null {
  const match = /(\d+)\s*$/.exec(value);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
