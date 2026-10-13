// The Suggested tab's display rules (owner decisions from the prototype): Recent is one row of up to
// five cards; Frequently used and Generated are compact tiles, at most three each; empty rows are
// hidden; Frequently used skips files already shown in Recent.

import { MESSAGES } from "./messages";
import type { LibraryFileRow, Suggested } from "./schemas";

export const RECENT_LIMIT = 5;
export const TILE_LIMIT = 3;

export type SuggestedView = {
  recent: LibraryFileRow[];
  frequent: LibraryFileRow[];
  generated: LibraryFileRow[];
};

export function selectSuggested(data: Suggested): SuggestedView {
  const recent = data.recent.slice(0, RECENT_LIMIT);
  const inRecent = new Set(recent.map((file) => file.id));
  return {
    recent,
    frequent: data.frequent.filter((file) => !inRecent.has(file.id)).slice(0, TILE_LIMIT),
    generated: data.generated.slice(0, TILE_LIMIT),
  };
}

/**
 * The tile's second line, as in the prototype: "Opened 4 times" under Frequently used, "Run of Weekly
 * sales report" under Generated (empty for a file a chat made). Falls back to `fallback` when the
 * server did not send the count.
 */
export function tileLine(row: "frequent" | "generated", file: LibraryFileRow, fallback: string): string {
  if (row === "frequent") return file.openCount !== undefined ? MESSAGES.openedTimes(file.openCount) : fallback;
  return file.generatedFrom?.kind === "routine" && file.generatedFrom.label ? MESSAGES.runOf(file.generatedFrom.label) : "";
}

export function isSuggestedEmpty(view: SuggestedView): boolean {
  return view.recent.length === 0 && view.frequent.length === 0 && view.generated.length === 0;
}
