// Pure helpers for changing a file everywhere it is cached. A file shows up in lists, the picker,
// Suggested, Trash and its own detail query; when one changes (rename, trash, unread cleared) these
// keep them in step. They never mutate: each returns the same reference when nothing matched, so
// React Query does not re-render screens that did not change.

import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { libraryKeys } from "./keys";
import type { FileRowWire, Suggested } from "./schemas";
import type { LibraryFile, LibraryFileDetail } from "./file";

type RowsPage = { items: LibraryFile[] };
export type PagedRows<P extends RowsPage = RowsPage> = InfiniteData<P, unknown>;

function mapRows(rows: LibraryFile[], id: string, fn: (row: LibraryFile) => LibraryFile | null): LibraryFile[] {
  let changed = false;
  const next: LibraryFile[] = [];
  for (const row of rows) {
    if (row.id !== id) {
      next.push(row);
      continue;
    }
    changed = true;
    const result = fn(row);
    if (result) next.push(result);
  }
  return changed ? next : rows;
}

function mapPages<P extends RowsPage>(data: PagedRows<P> | undefined, id: string, fn: (row: LibraryFile) => LibraryFile | null): PagedRows<P> | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = mapRows(page.items, id, fn);
    if (items === page.items) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

export function patchInPages<P extends RowsPage>(data: PagedRows<P> | undefined, id: string, patch: Partial<FileRowWire>): PagedRows<P> | undefined {
  return mapPages(data, id, (row) => row.with(patch));
}

export function removeFromPages<P extends RowsPage>(data: PagedRows<P> | undefined, id: string): PagedRows<P> | undefined {
  return mapPages(data, id, () => null);
}

export function patchInSuggested(data: Suggested | undefined, id: string, patch: Partial<FileRowWire>): Suggested | undefined {
  if (!data) return data;
  const recent = mapRows(data.recent, id, (row) => row.with(patch));
  const frequent = mapRows(data.frequent, id, (row) => row.with(patch));
  const generated = mapRows(data.generated, id, (row) => row.with(patch));
  return recent === data.recent && frequent === data.frequent && generated === data.generated ? data : { recent, frequent, generated };
}

export function removeFromSuggested(data: Suggested | undefined, id: string): Suggested | undefined {
  if (!data) return data;
  const recent = mapRows(data.recent, id, () => null);
  const frequent = mapRows(data.frequent, id, () => null);
  const generated = mapRows(data.generated, id, () => null);
  return recent === data.recent && frequent === data.frequent && generated === data.generated ? data : { recent, frequent, generated };
}

/**
 * The one place that writes a file change into every cache that may hold it. */
export function patchFileEverywhere(queryClient: QueryClient, org: string, id: string, patch: Partial<FileRowWire>): void {
  queryClient.setQueryData<LibraryFileDetail>(libraryKeys.detail(org, id), (detail) => detail?.with(patch));
  queryClient.setQueriesData<PagedRows>({ queryKey: libraryKeys.lists(org) }, (data) => patchInPages(data, id, patch));
  queryClient.setQueriesData<PagedRows>({ queryKey: [...libraryKeys.all(org), "picker"] }, (data) => patchInPages(data, id, patch));
  queryClient.setQueriesData<PagedRows>({ queryKey: libraryKeys.trash(org) }, (data) => patchInPages(data, id, patch));
  queryClient.setQueryData<Suggested>(libraryKeys.suggested(org), (data) => patchInSuggested(data, id, patch));
}

/** Takes a file out of every list-like cache (it moved to Trash or was deleted). The detail query is left for the caller. */
export function removeFileFromLists(queryClient: QueryClient, org: string, id: string): void {
  queryClient.setQueriesData<PagedRows>({ queryKey: libraryKeys.lists(org) }, (data) => removeFromPages(data, id));
  queryClient.setQueriesData<PagedRows>({ queryKey: [...libraryKeys.all(org), "picker"] }, (data) => removeFromPages(data, id));
  queryClient.setQueryData<Suggested>(libraryKeys.suggested(org), (data) => removeFromSuggested(data, id));
}

/** Flattens loaded pages into one array, de-duplicated by id (a refetch between page loads can repeat a row). */
export function flattenPages<P extends RowsPage>(data: PagedRows<P> | undefined): LibraryFile[] {
  if (!data) return [];
  const seen = new Set<string>();
  const rows: LibraryFile[] = [];
  for (const page of data.pages) {
    for (const row of page.items) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}
