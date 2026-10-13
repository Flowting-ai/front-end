// The Library page's view state lives in the URL (tab, search, scope, filters, sort), so back/forward
// and shared links work. This is the single codec every consumer uses: bad or unknown values fall
// back to defaults instead of throwing, and defaults and empties are left out of the URL so one view
// has one canonical address.

import { FORMAT_GROUPS, SOURCE_FILTERS, type FormatGroup, type SourceFilter } from "./schemas";

export const LIBRARY_TABS = ["suggested", "all", "shared"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

export const SORT_KEYS = ["name", "created", "shared"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export type SearchScope = "tab" | "all";

export type LibraryQuery = {
  tab: LibraryTab;
  /** Search text, trimmed. Searching starts at MIN_SEARCH_LENGTH characters. */
  q: string;
  scope: SearchScope;
  source: SourceFilter[];
  type: FormatGroup[];
  /** Null means "the tab's default sort". */
  sort: SortKey | null;
  /** Null means "the sort key's default direction". */
  dir: SortDir | null;
};

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;

export const DEFAULT_QUERY: LibraryQuery = {
  tab: "suggested",
  q: "",
  scope: "tab",
  source: [],
  type: [],
  sort: null,
  dir: null,
};

type Readable = Pick<URLSearchParams, "get" | "getAll">;

function pickOne<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Valid values only, de-duplicated, in the canonical order of `allowed` (so ?type=a&type=b equals ?type=b&type=a). */
function pickMany<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set(values);
  return allowed.filter((value) => set.has(value));
}

export function parseLibraryQuery(params: Readable): LibraryQuery {
  const tab = pickOne(params.get("tab"), LIBRARY_TABS) ?? DEFAULT_QUERY.tab;
  const q = (params.get("q") ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const scope: SearchScope = params.get("scope") === "all" ? "all" : "tab";
  const source = pickMany(params.getAll("source"), SOURCE_FILTERS);
  const type = pickMany(params.getAll("type"), FORMAT_GROUPS);
  const sort = pickOne(params.get("sort"), SORT_KEYS);
  const dirParam = params.get("dir");
  const dir: SortDir | null = dirParam === "asc" || dirParam === "desc" ? dirParam : null;
  // A direction without a sort key has nothing to apply to.
  return { tab, q, scope, source, type, sort, dir: sort ? dir : null };
}

/** Only non-default values, in a stable order, so equal views produce equal strings. */
export function toSearchParams(query: LibraryQuery): URLSearchParams {
  const out = new URLSearchParams();
  if (query.tab !== DEFAULT_QUERY.tab) out.set("tab", query.tab);
  if (query.q) out.set("q", query.q);
  if (query.q && query.scope === "all") out.set("scope", "all");
  for (const value of query.source) out.append("source", value);
  for (const value of query.type) out.append("type", value);
  if (query.sort) {
    out.set("sort", query.sort);
    if (query.dir) out.set("dir", query.dir);
  }
  return out;
}

export function toLibraryHref(basePath: string, query: LibraryQuery): string {
  const search = toSearchParams(query).toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** Applies a patch the way the UI does: changing the tab, filters, search or sort never keeps a stale scope or direction. */
export function patchQuery(query: LibraryQuery, patch: Partial<LibraryQuery>): LibraryQuery {
  const next = { ...query, ...patch };
  if (!next.q) next.scope = "tab";
  if (!next.sort) next.dir = null;
  return next;
}

// ── Derived values ───────────────────────────────────────────────────────────

const DEFAULT_SORT_BY_TAB: Record<LibraryTab, SortKey> = { suggested: "created", all: "created", shared: "shared" };

export function defaultSortKey(tab: LibraryTab): SortKey {
  return DEFAULT_SORT_BY_TAB[tab];
}

export function defaultSortDir(key: SortKey): SortDir {
  return key === "name" ? "asc" : "desc";
}

/** The sort keys each list offers (headings and the Sort menu). */
export function sortKeysFor(tab: "all" | "shared"): SortKey[] {
  return tab === "shared" ? ["name", "shared"] : ["name", "created"];
}

/**
 * On Shared, until the person picks a sort, the order is unread first, then newest shared. No heading
 * or Sort menu choice shows as picked in that state (as in the prototype).
 */
export function isUntouchedSharedOrder(query: LibraryQuery): boolean {
  return effectiveListTab(query) === "shared" && (query.sort === null || !sortKeysFor("shared").includes(query.sort));
}

/** The sort the list actually uses. The Shared tab sorts by "Date shared"; a stored "shared" key on All files falls back to Created. */
export function resolveSort(query: LibraryQuery): { key: SortKey; dir: SortDir } {
  const tab = effectiveListTab(query);
  if (isUntouchedSharedOrder(query)) return { key: "shared", dir: "desc" };
  const key = query.sort ?? defaultSortKey(tab);
  // A key that belongs to another tab must not decide this tab's order (nor its direction).
  if (key === "shared" && tab !== "shared") return { key: "created", dir: "desc" };
  return { key, dir: query.dir ?? defaultSortDir(key) };
}

/** The sort the headings and Sort menu mark as chosen: none for Shared's untouched order. */
export function chosenSort(query: LibraryQuery): { key: SortKey | null; dir: SortDir } {
  return isUntouchedSharedOrder(query) ? { key: null, dir: "desc" } : resolveSort(query);
}

/**
 * The URL fields for choosing a sort, left out when it equals the tab's default so the URL stays
 * canonical. On Shared a chosen sort is always written, since leaving it out means "unread first".
 */
export function sortPatch(query: LibraryQuery, key: SortKey, dir: SortDir): Pick<LibraryQuery, "sort" | "dir"> {
  const tab = effectiveListTab(query);
  if (tab !== "shared" && key === defaultSortKey(tab) && dir === defaultSortDir(key)) return { sort: null, dir: null };
  return { sort: key, dir: dir === defaultSortDir(key) ? null : dir };
}

/** A click on a column heading: the same column flips direction, another column starts at its default direction. */
export function toggleSortPatch(query: LibraryQuery, key: SortKey): Pick<LibraryQuery, "sort" | "dir"> {
  const current = chosenSort(query);
  const dir: SortDir = current.key === key ? (current.dir === "asc" ? "desc" : "asc") : defaultSortDir(key);
  return sortPatch(query, key, dir);
}

/**
 * Switching between Suggested, All files and Shared: filter ticks carry over, and so does a sort the
 * new tab also offers. "Date shared" does not carry to All files (it falls back to Created, newest first).
 */
export function tabPatch(query: LibraryQuery, tab: LibraryTab): Partial<LibraryQuery> {
  if (query.sort === "shared" && tab !== "shared") return { tab, sort: null, dir: null };
  return { tab };
}

export function isSearching(query: LibraryQuery): boolean {
  return query.q.length >= MIN_SEARCH_LENGTH;
}

/** Suggested is not a list: lists (and search from Suggested) read All files. A widened search always reads All files. */
export function effectiveListTab(query: LibraryQuery): "all" | "shared" {
  if (isSearching(query) && query.scope === "all") return "all";
  return query.tab === "shared" ? "shared" : "all";
}

export function activeFilterCount(query: LibraryQuery): number {
  return query.source.length + query.type.length;
}

/** What the list request needs. Part of the React Query key, so every field must be a plain value. */
export type ListParams = {
  tab: "all" | "shared";
  q: string;
  sources: SourceFilter[];
  types: FormatGroup[];
  sort: SortKey;
  dir: SortDir;
  /** Shared's untouched order: unread first, then newest shared (sort/dir stay "shared"/"desc"). */
  unreadFirst?: boolean;
};

/** Filters that apply to the list: none while searching (the ticks stay in the URL and apply again once the search clears). */
export function appliedFilterCount(query: LibraryQuery): number {
  return isSearching(query) ? 0 : activeFilterCount(query);
}

export function toListParams(query: LibraryQuery): ListParams {
  const { key, dir } = resolveSort(query);
  const searching = isSearching(query);
  const params: ListParams = {
    tab: effectiveListTab(query),
    q: searching ? query.q : "",
    sources: searching ? [] : query.source,
    types: searching ? [] : query.type,
    sort: key,
    dir,
  };
  if (isUntouchedSharedOrder(query)) params.unreadFirst = true;
  return params;
}
