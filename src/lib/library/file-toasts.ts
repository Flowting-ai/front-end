// Pure helpers behind the file-action toasts (mutations.ts): the name a toast shows, how many files
// Empty Trash removed, and which grants a share added (for its Undo). Kept free of React so they test
// in isolation.

import type { QueryClient } from "@tanstack/react-query";
import { LibraryFile } from "./file";
import { libraryKeys } from "./keys";
import type { AccessList } from "./schemas";

/** Finds a file row by id anywhere inside a cached query value (a page list, Suggested, a detail). */
export function findRowIn(data: unknown, id: string, depth = 0): LibraryFile | undefined {
  if (!data || typeof data !== "object" || depth > 5) return undefined;
  if (data instanceof LibraryFile && data.id === id) return data;
  const values = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
  for (const value of values) {
    const found = findRowIn(value, id, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** The display name a toast uses for a file: the caller's, else whatever the cache holds, else "File". */
export function cachedFileName(queryClient: QueryClient, org: string, id: string, given?: string): string {
  if (given) return given;
  for (const [, data] of queryClient.getQueriesData({ queryKey: libraryKeys.all(org) })) {
    const row = findRowIn(data, id);
    if (row) return row.name;
  }
  return "File";
}

/** How many files the loaded Trash pages hold (what Empty Trash removes when the caller does not say). */
export function countTrashRows(queryClient: QueryClient, org: string): number {
  let count = 0;
  for (const [, data] of queryClient.getQueriesData<{ pages?: { items?: unknown[] }[] }>({ queryKey: libraryKeys.trash(org) })) {
    for (const page of data?.pages ?? []) count += page.items?.length ?? 0;
  }
  return count;
}

/** Grants present after a share that were not there before: the ones its Undo removes. */
export function addedGrantIds(before: AccessList | undefined, after: AccessList): string[] {
  const had = new Set((before?.entries ?? []).map((entry) => entry.grantId));
  return after.entries.filter((entry) => entry.kind !== "owner" && !had.has(entry.grantId)).map((entry) => entry.grantId);
}
