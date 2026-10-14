import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  flattenPages,
  patchFileEverywhere,
  patchInPages,
  patchInSuggested,
  removeFileFromLists,
  removeFromPages,
  removeFromSuggested,
  type PagedRows,
} from "./cache";
import { libraryKeys } from "./keys";
import { DEFAULT_QUERY, toListParams } from "./query-params";
import type { FileRowWire, Suggested } from "./schemas";
import { testFile } from "./test-files";
import { LibraryFileDetail, type LibraryFile } from "./file";

const ORG = "org1";

function row(id: string, overrides: Partial<FileRowWire> = {}): LibraryFile {
  return testFile({ id, title: `File ${id}`, ...overrides });
}

function pages(...groups: LibraryFile[][]): PagedRows<{ items: LibraryFile[]; nextCursor: string | null }> {
  return {
    pages: groups.map((items, index) => ({ items, nextCursor: index < groups.length - 1 ? String(index + 1) : null })),
    pageParams: groups.map((_, index) => (index === 0 ? null : String(index))),
  };
}

describe("patchInPages / removeFromPages", () => {
  it("patches one row and leaves every other reference untouched", () => {
    const data = pages([row("a"), row("b")], [row("c")]);
    const next = patchInPages(data, "b", { title: "Renamed" });
    expect(next?.pages[0].items[1].title).toBe("Renamed");
    expect(next?.pages[1]).toBe(data.pages[1]);
    expect(next?.pages[0].items[0]).toBe(data.pages[0].items[0]);
  });

  it("returns the same data object when the id is not there", () => {
    const data = pages([row("a")]);
    expect(patchInPages(data, "zzz", { title: "x" })).toBe(data);
    expect(removeFromPages(data, "zzz")).toBe(data);
    expect(patchInPages(undefined, "a", {})).toBeUndefined();
  });

  it("removes a row from whichever page holds it", () => {
    const next = removeFromPages(pages([row("a")], [row("b"), row("c")]), "b");
    expect(next?.pages[1].items.map((item) => item.id)).toEqual(["c"]);
  });
});

describe("suggested helpers", () => {
  const suggested: Suggested = { recent: [row("a"), row("b")], frequent: [row("a")], generated: [row("g")] };

  it("patches and removes a file in every row of Suggested", () => {
    expect(patchInSuggested(suggested, "a", { unread: true })?.frequent[0].unread).toBe(true);
    expect(patchInSuggested(suggested, "a", { unread: true })?.recent[0].unread).toBe(true);
    const removed = removeFromSuggested(suggested, "a");
    expect(removed?.recent.map((item) => item.id)).toEqual(["b"]);
    expect(removed?.frequent).toEqual([]);
  });

  it("keeps the same object when nothing matched", () => {
    expect(patchInSuggested(suggested, "none", {})).toBe(suggested);
    expect(removeFromSuggested(suggested, "none")).toBe(suggested);
  });
});

describe("flattenPages", () => {
  it("de-duplicates rows repeated across pages and keeps order", () => {
    const flat = flattenPages(pages([row("a"), row("b")], [row("b"), row("c")]));
    expect(flat.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(flattenPages(undefined)).toEqual([]);
  });
});

describe("patchFileEverywhere / removeFileFromLists", () => {
  function seededClient() {
    const client = new QueryClient();
    const listKey = libraryKeys.list(ORG, toListParams({ ...DEFAULT_QUERY, tab: "all" }));
    const pickerKey = libraryKeys.picker(ORG, { q: "", types: [], generatedOnly: false });
    client.setQueryData<InfiniteData<{ items: LibraryFile[]; nextCursor: string | null }, unknown>>(listKey, pages([row("a"), row("b")]));
    client.setQueryData(pickerKey, pages([row("a")]));
    client.setQueryData(libraryKeys.suggested(ORG), { recent: [row("a")], frequent: [], generated: [] } satisfies Suggested);
    client.setQueryData(libraryKeys.trash(ORG), pages([row("t", { life: "trashed" })]));
    client.setQueryData(libraryKeys.detail(ORG, "a"), new LibraryFileDetail({
      ...row("a"), phase: "ready", scope: "private", provenance: { kind: "upload", label: "", via: "web", isTestRun: false },
      mimeType: "application/pdf", updatedAt: "2026-10-01T00:00:00.000Z", ways: [], previewKind: "pdf",
    }));
    // Another workspace's cache must never be touched.
    const otherKey = libraryKeys.list("org2", toListParams({ ...DEFAULT_QUERY, tab: "all" }));
    client.setQueryData(otherKey, pages([row("a")]));
    return { client, listKey, pickerKey, otherKey };
  }

  it("writes a change into the list, picker, Suggested, Trash and detail caches of that workspace only", () => {
    const { client, listKey, pickerKey, otherKey } = seededClient();
    patchFileEverywhere(client, ORG, "a", { title: "Renamed" });
    expect(client.getQueryData<PagedRows>(listKey)?.pages[0].items[0].title).toBe("Renamed");
    expect(client.getQueryData<PagedRows>(pickerKey)?.pages[0].items[0].title).toBe("Renamed");
    expect(client.getQueryData<Suggested>(libraryKeys.suggested(ORG))?.recent[0].title).toBe("Renamed");
    const detail = client.getQueryData<LibraryFileDetail>(libraryKeys.detail(ORG, "a"));
    expect(detail?.title).toBe("Renamed");
    expect(detail).toBeInstanceOf(LibraryFileDetail);
    expect(client.getQueryData<PagedRows>(otherKey)?.pages[0].items[0].title).toBe("File a");
  });

  it("does not create a detail entry that was never loaded", () => {
    const { client } = seededClient();
    patchFileEverywhere(client, ORG, "b", { title: "x" });
    expect(client.getQueryData(libraryKeys.detail(ORG, "b"))).toBeUndefined();
  });

  it("takes a file out of lists, the picker and Suggested but not Trash or detail", () => {
    const { client, listKey, pickerKey } = seededClient();
    removeFileFromLists(client, ORG, "a");
    expect(client.getQueryData<PagedRows>(listKey)?.pages[0].items.map((item) => item.id)).toEqual(["b"]);
    expect(client.getQueryData<PagedRows>(pickerKey)?.pages[0].items).toEqual([]);
    expect(client.getQueryData<Suggested>(libraryKeys.suggested(ORG))?.recent).toEqual([]);
    expect(client.getQueryData<PagedRows>(libraryKeys.trash(ORG))?.pages[0].items).toHaveLength(1);
    expect(client.getQueryData(libraryKeys.detail(ORG, "a"))).toBeDefined();
  });
});
