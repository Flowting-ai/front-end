import { SIDEBAR_COLLAPSED_KEY, parseSidebarCollapsed } from "@/lib/storage-keys";

// -- Collapse state persistence ------------------------------------------------

// The initial state comes from the `sidebar_collapsed` cookie, read on the
// server by the (app) layout and passed down as `defaultCollapsed`, so the
// server render and the client's first render agree (no localStorage read
// during render — that's what caused the 294px-vs-48px hydration mismatch).

export const SIDEBAR_COLLAPSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// The latest toggle in this page session. The (app) layout isn't re-rendered
// on client navigation, so its cookie-derived prop goes stale; a sidebar that
// remounts (e.g. coming back from Settings) must start from this instead.
let sessionCollapsed: boolean | undefined;

export function getSessionCollapsed(): boolean | undefined {
  return sessionCollapsed;
}

export function writeCollapsedCookie(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${collapsed}; path=/; max-age=${SIDEBAR_COLLAPSED_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function writeCollapsed(collapsed: boolean) {
  sessionCollapsed = collapsed;
  writeCollapsedCookie(collapsed);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

// One-time migration: the preference used to live only in localStorage. Copy
// it into the cookie so the next page load renders it on the server.
export function migrateCollapsedCookie() {
  const hasCookie = document.cookie.split("; ").some((c) => c.startsWith(`${SIDEBAR_COLLAPSED_KEY}=`));
  if (hasCookie) return;
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  if (stored !== null) writeCollapsedCookie(parseSidebarCollapsed(stored));
}
