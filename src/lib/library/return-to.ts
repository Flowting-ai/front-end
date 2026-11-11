// Where Close (and a delete) on the file page goes back to: the Library list the person came from,
// with its tab, search and filters. Lists remember their URL here when a file is opened from them, and a
// link may also carry it as `?from=`. Anything that is not a Library list URL falls back to /library.

import { LIBRARY_ROUTE } from "@/lib/routes";

const KEY = "library:return-to";

/** A same-origin Library list path (the lists or Trash), never a file page or another site. */
export function isLibraryListUrl(value: string | null | undefined): boolean {
  if (!value || value.length > 2000) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  const path = value.split(/[?#]/)[0];
  return path === LIBRARY_ROUTE || path === `${LIBRARY_ROUTE}/trash`;
}

/** Remembers the list URL a file is being opened from. Storage may be blocked: then nothing is kept. */
export function rememberLibraryReturn(url: string): void {
  if (!isLibraryListUrl(url)) return;
  try {
    window.sessionStorage.setItem(KEY, url);
  } catch {
    // Private mode or blocked storage: Close falls back to /library.
  }
}

const TABS = ["suggested", "all", "shared"] as const;

/** `?from=` may be a list URL or just a tab name ("all", "shared", "trash"). */
function fromParam(from: string | null | undefined): string | null {
  if (!from) return null;
  if (isLibraryListUrl(from)) return from;
  if (from === "trash") return `${LIBRARY_ROUTE}/trash`;
  if (from && (TABS as readonly string[]).includes(from)) return from === "suggested" ? LIBRARY_ROUTE : `${LIBRARY_ROUTE}?tab=${from}`;
  return null;
}

let watching = false;

/**
 * Remembers the current list URL whenever a link to a file page is clicked on it. Installed once, by the
 * first list that renders a file menu, so every row, card and tile link is covered without each one opting in.
 */
export function watchLibraryFileLinks(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (href.startsWith(`${LIBRARY_ROUTE}/files/`)) rememberLibraryReturn(`${window.location.pathname}${window.location.search}`);
    },
    { capture: true },
  );
}

/** The list to go back to: `?from=` when valid, then the remembered list, then /library. */
export function libraryReturnUrl(from?: string | null): string {
  const given = fromParam(from);
  if (given) return given;
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored && isLibraryListUrl(stored)) return stored;
  } catch {
    // Fall through.
  }
  return LIBRARY_ROUTE;
}
