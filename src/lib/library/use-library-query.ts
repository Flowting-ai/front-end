"use client";

// The Library page's view state, read from and written to the URL. Components never hold tab,
// search, filters or sort in useState: they read `query` and call `setQuery`. Refinements (search,
// filters, sort) replace the history entry so Back leaves the page; a tab change pushes one.
// Callers must render under <Suspense> (useSearchParams requires it for static shells).
//
// A navigation takes a moment to commit, and two quick changes (ticking two filters) must both
// survive. So a change is applied on top of the latest *requested* query, not the one last rendered,
// and `setQuery` also accepts a function of that latest query for toggles.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { parseLibraryQuery, patchQuery, toLibraryHref, type LibraryQuery } from "./query-params";

export type QueryPatch = Partial<LibraryQuery> | ((current: LibraryQuery) => Partial<LibraryQuery>);
export type SetLibraryQuery = (patch: QueryPatch, mode?: "push" | "replace") => void;

export function useLibraryQuery(): { query: LibraryQuery; setQuery: SetLibraryQuery; isPending: boolean } {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const query = parseLibraryQuery(params);

  // The last query the URL actually shows, and the last one we asked for while a navigation is in flight.
  const committed = useRef(query);
  const requested = useRef<LibraryQuery | null>(null);
  useEffect(() => {
    committed.current = query;
    if (!isPending) requested.current = null;
  }, [query, isPending]);

  const setQuery: SetLibraryQuery = (patch, mode = "replace") => {
    const base = requested.current ?? committed.current;
    const next = patchQuery(base, typeof patch === "function" ? patch(base) : patch);
    requested.current = next;
    const href = toLibraryHref(pathname, next);
    // The transition keeps the current rows on screen (dimmed) while the next view loads.
    startTransition(() => {
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  };

  return { query, setQuery, isPending };
}
