import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  activeFilterCount,
  appliedFilterCount,
  chosenSort,
  effectiveListTab,
  isSearching,
  isUntouchedSharedOrder,
  tabPatch,
  parseLibraryQuery,
  patchQuery,
  resolveSort,
  sortPatch,
  toggleSortPatch,
  toLibraryHref,
  toListParams,
  toSearchParams,
  type LibraryQuery,
} from "./query-params";

const parse = (search: string) => parseLibraryQuery(new URLSearchParams(search));

describe("parseLibraryQuery", () => {
  it("returns the defaults for an empty URL", () => {
    expect(parse("")).toEqual(DEFAULT_QUERY);
  });

  it("falls back to defaults for unknown or malformed values instead of throwing", () => {
    expect(parse("tab=nope&scope=weird&sort=color&dir=sideways&source=bogus&type=exe")).toEqual(DEFAULT_QUERY);
  });

  it("reads tab, search, scope, filters and sort", () => {
    const query = parse("tab=shared&q=return%20policy&scope=all&source=generated&type=pdfs&type=images&sort=name&dir=asc");
    expect(query).toEqual({
      tab: "shared",
      q: "return policy",
      scope: "all",
      source: ["generated"],
      type: ["images", "pdfs"],
      sort: "name",
      dir: "asc",
    });
  });

  it("trims and caps the search text", () => {
    expect(parse(`q=${encodeURIComponent("  hello  ")}`).q).toBe("hello");
    expect(parse(`q=${"x".repeat(500)}`).q).toHaveLength(200);
  });

  it("treats repeated filter keys as a set in canonical order, ignoring duplicates", () => {
    const a = parse("type=pdfs&type=images&type=pdfs");
    const b = parse("type=images&type=pdfs");
    expect(a.type).toEqual(["images", "pdfs"]);
    expect(a).toEqual(b);
  });

  it("drops a direction that has no sort key", () => {
    expect(parse("dir=asc").dir).toBeNull();
  });
});

describe("toSearchParams / toLibraryHref", () => {
  it("leaves out defaults so equal views have one canonical URL", () => {
    expect(toLibraryHref("/library", DEFAULT_QUERY)).toBe("/library");
    expect(toLibraryHref("/library", { ...DEFAULT_QUERY, tab: "all" })).toBe("/library?tab=all");
  });

  it("round-trips a full query", () => {
    const query: LibraryQuery = {
      tab: "all",
      q: "acme",
      scope: "all",
      source: ["uploaded", "shared"],
      type: ["documents", "audio"],
      sort: "created",
      dir: "asc",
    };
    expect(parse(toSearchParams(query).toString())).toEqual(query);
  });

  it("does not write a scope without a search", () => {
    expect(toSearchParams({ ...DEFAULT_QUERY, scope: "all" }).toString()).toBe("");
  });
});

describe("patchQuery", () => {
  it("resets the scope when the search is cleared and the direction when the sort is cleared", () => {
    const base: LibraryQuery = { ...DEFAULT_QUERY, tab: "all", q: "acme", scope: "all", sort: "name", dir: "asc" };
    expect(patchQuery(base, { q: "" }).scope).toBe("tab");
    expect(patchQuery(base, { sort: null }).dir).toBeNull();
  });
});

describe("derived values", () => {
  it("applies each tab's default sort", () => {
    expect(resolveSort({ ...DEFAULT_QUERY, tab: "all" })).toEqual({ key: "created", dir: "desc" });
    expect(resolveSort({ ...DEFAULT_QUERY, tab: "shared" })).toEqual({ key: "shared", dir: "desc" });
    expect(resolveSort({ ...DEFAULT_QUERY, tab: "all", sort: "name" })).toEqual({ key: "name", dir: "asc" });
  });

  it("does not sort All files by 'shared'", () => {
    expect(resolveSort({ ...DEFAULT_QUERY, tab: "all", sort: "shared" }).key).toBe("created");
  });

  it("starts searching at two characters", () => {
    expect(isSearching({ ...DEFAULT_QUERY, q: "a" })).toBe(false);
    expect(isSearching({ ...DEFAULT_QUERY, q: "ab" })).toBe(true);
  });

  it("reads All files for Suggested, and for a widened search from Shared", () => {
    expect(effectiveListTab({ ...DEFAULT_QUERY, tab: "suggested" })).toBe("all");
    expect(effectiveListTab({ ...DEFAULT_QUERY, tab: "shared" })).toBe("shared");
    expect(effectiveListTab({ ...DEFAULT_QUERY, tab: "shared", q: "acme", scope: "all" })).toBe("all");
    expect(effectiveListTab({ ...DEFAULT_QUERY, tab: "shared", q: "a", scope: "all" })).toBe("shared");
  });

  it("counts active filters across both sections", () => {
    expect(activeFilterCount({ ...DEFAULT_QUERY, source: ["uploaded"], type: ["pdfs", "audio"] })).toBe(3);
  });

  it("builds list params with a search only once it is long enough", () => {
    expect(toListParams({ ...DEFAULT_QUERY, tab: "all", q: "a" }).q).toBe("");
    expect(toListParams({ ...DEFAULT_QUERY, tab: "all", q: "ab" })).toMatchObject({ tab: "all", q: "ab", sort: "created", dir: "desc" });
  });

  it("ignores filters while searching and applies them again once the search clears", () => {
    const ticked: LibraryQuery = { ...DEFAULT_QUERY, tab: "all", source: ["generated"], type: ["pdfs"] };
    expect(toListParams({ ...ticked, q: "acme" })).toMatchObject({ sources: [], types: [] });
    expect(appliedFilterCount({ ...ticked, q: "acme" })).toBe(0);
    expect(toListParams(ticked)).toMatchObject({ sources: ["generated"], types: ["pdfs"] });
    expect(appliedFilterCount(ticked)).toBe(2);
  });

  it("orders Shared unread first until a sort is chosen, with no heading marked", () => {
    const shared: LibraryQuery = { ...DEFAULT_QUERY, tab: "shared" };
    expect(isUntouchedSharedOrder(shared)).toBe(true);
    expect(toListParams(shared)).toMatchObject({ sort: "shared", dir: "desc", unreadFirst: true });
    expect(chosenSort(shared).key).toBeNull();
    expect(isUntouchedSharedOrder({ ...shared, sort: "created" })).toBe(true);
    expect(isUntouchedSharedOrder({ ...shared, sort: "shared" })).toBe(false);
    expect(toListParams({ ...shared, sort: "name" }).unreadFirst).toBeUndefined();
    expect(chosenSort({ ...shared, sort: "name" })).toEqual({ key: "name", dir: "asc" });
    expect(chosenSort({ ...DEFAULT_QUERY, tab: "all" })).toEqual({ key: "created", dir: "desc" });
  });

  it("does not let Date shared decide the order or direction of All files", () => {
    expect(resolveSort({ ...DEFAULT_QUERY, tab: "all", sort: "shared", dir: "asc" })).toEqual({ key: "created", dir: "desc" });
  });
});

describe("tabPatch", () => {
  it("carries filter ticks and a shared sort key between tabs", () => {
    const all: LibraryQuery = { ...DEFAULT_QUERY, tab: "all", source: ["uploaded"], type: ["pdfs"], sort: "name", dir: "desc" };
    expect(patchQuery(all, tabPatch(all, "shared"))).toMatchObject({ tab: "shared", source: ["uploaded"], type: ["pdfs"], sort: "name", dir: "desc" });
  });

  it("drops Date shared when leaving Shared", () => {
    const shared: LibraryQuery = { ...DEFAULT_QUERY, tab: "shared", source: ["generated"], sort: "shared", dir: "asc" };
    expect(patchQuery(shared, tabPatch(shared, "all"))).toMatchObject({ tab: "all", source: ["generated"], sort: null, dir: null });
  });
});

describe("sort patches", () => {
  it("leaves the sort out of the URL when it equals the tab's default", () => {
    const all = { ...DEFAULT_QUERY, tab: "all" as const };
    expect(sortPatch(all, "created", "desc")).toEqual({ sort: null, dir: null });
    expect(sortPatch(all, "created", "asc")).toEqual({ sort: "created", dir: "asc" });
    expect(sortPatch(all, "name", "asc")).toEqual({ sort: "name", dir: null });
    expect(sortPatch(all, "name", "desc")).toEqual({ sort: "name", dir: "desc" });
  });

  it("always writes a sort chosen on Shared, since no sort means unread first", () => {
    expect(sortPatch({ ...DEFAULT_QUERY, tab: "shared" }, "shared", "desc")).toEqual({ sort: "shared", dir: null });
    expect(sortPatch({ ...DEFAULT_QUERY, tab: "shared" }, "name", "asc")).toEqual({ sort: "name", dir: null });
  });

  it("starts a heading click on Shared's untouched order at the heading's default direction", () => {
    const shared = { ...DEFAULT_QUERY, tab: "shared" as const };
    expect(toggleSortPatch(shared, "shared")).toEqual({ sort: "shared", dir: null });
    expect(toggleSortPatch({ ...shared, sort: "shared" }, "shared")).toEqual({ sort: "shared", dir: "asc" });
  });

  it("flips direction on the same column and starts a new column at its default direction", () => {
    const all = { ...DEFAULT_QUERY, tab: "all" as const };
    expect(toggleSortPatch(all, "created")).toEqual({ sort: "created", dir: "asc" });
    expect(toggleSortPatch({ ...all, sort: "created", dir: "asc" }, "created")).toEqual({ sort: null, dir: null });
    expect(toggleSortPatch(all, "name")).toEqual({ sort: "name", dir: null });
    expect(toggleSortPatch({ ...all, sort: "name" }, "name")).toEqual({ sort: "name", dir: "desc" });
  });
});
