// Product analytics for Library, through the app's typed helpers (never mixpanel-browser directly).
// One feature name ("library", registered in docs/analytics/mixpanel-setup-notion.txt) and a closed
// set of actions. Properties are enums and buckets only: never a file name, title, search text or URL.

import { trackFeature } from "@/lib/analytics/events";

export type LibraryAction =
  | "open_tab"
  | "open_file"
  | "search"
  | "filter"
  | "sort"
  | "share"
  | "revoke"
  | "trash"
  | "restore"
  | "delete_forever"
  | "empty_trash"
  | "rename"
  | "download"
  | "ask_about"
  | "pick_from_library"
  | "request_access"
  | "upload_started"
  | "upload_completed"
  | "upload_failed"
  | "preview_rendered"
  | "citation_opened"
  | "web_vital";

export type LibraryEventProps = {
  tab?: "suggested" | "all" | "shared" | "trash";
  format?: string;
  source?: "uploaded" | "generated";
  scope?: "tab" | "all";
  sizeBucket?: string;
  durationBucket?: string;
  reason?: string;
  /** A small count (filters in use, results bucket), never an exact size. */
  count?: number;
  value?: string;
  /** web_vital only: which Core Web Vital, its rating, and which Library page it was measured on. */
  metric?: LibraryVital;
  rating?: "good" | "needs-improvement" | "poor";
  page?: LibraryPage;
};

export type LibraryVital = "LCP" | "CLS" | "INP";
export type LibraryPage = "list" | "trash" | "file";

/** Which Library page a path is, for web_vital events; null outside Library. */
export function libraryPageOf(pathname: string): LibraryPage | null {
  if (pathname === "/library") return "list";
  if (pathname === "/library/trash") return "trash";
  if (pathname.startsWith("/library/files/")) return "file";
  return null;
}

const VITALS: readonly string[] = ["LCP", "CLS", "INP"];
export function isLibraryVital(name: string): name is LibraryVital {
  return VITALS.includes(name);
}

export function trackLibrary(action: LibraryAction, props: LibraryEventProps = {}): void {
  trackFeature("library", { action, ...props });
}

/** Search events carry the length class and a result bucket, never the text. */
export function lengthBucket(length: number): "short" | "medium" | "long" {
  if (length < 5) return "short";
  if (length < 15) return "medium";
  return "long";
}

export function resultBucket(count: number): "0" | "1-9" | "10+" {
  if (count === 0) return "0";
  return count < 10 ? "1-9" : "10+";
}
