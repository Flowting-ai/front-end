// Starts a file page's two requests (details and preview) before the queries that own them may run.
// Library queries wait for the workspace to load (their keys hold its id), but the Library API itself
// never sends the workspace, so the requests do not have to wait: they start when the file page mounts
// or a row is hovered, and the query functions pick up the request already in flight.
//
// A warmed request only ever answers a query's first load, never a refetch (an invalidation after a
// change must read the server again), and only while fresh. A file's warmed requests are forgotten when
// it changes (rename, trash, share...) and all of them when the workspace changes. Until a request
// settles, every first load that asks shares it: a query aborted and re-run on remount must not fetch
// again. A request that failed is dropped; the query then fetches, unless the API refused (a refusal
// would only be refused again).

import { libraryApi } from "./api";
import { isApiError } from "./errors";
import type { PreviewRequest } from "./schemas";

/** The row window a sheet preview asks for; the file page's first preview request uses it. */
export const PREVIEW_ROW_WINDOW = 100;
export const DEFAULT_PREVIEW_REQUEST: PreviewRequest = { rowStart: 0, rowCount: PREVIEW_ROW_WINDOW };

const FRESH_MS = 20_000;
// An answered request lingers a moment, for a query re-run on remount right after taking it.
const RETIRE_MS = 1_000;

type Entry = { at: number; promise: Promise<unknown>; settled: boolean; taken: boolean };
const warm = new Map<string, Entry>();
// The workspace the warmed requests belong to; a different one clears them.
let scope: string | null = null;

function drop(key: string, entry: Entry): void {
  if (warm.get(key) === entry) warm.delete(key);
}

function later(key: string, entry: Entry, ms: number): void {
  setTimeout(() => drop(key, entry), ms);
}

const detailKey = (id: string) => `file:${id}`;
const previewKey = (id: string, request: PreviewRequest) =>
  `preview:${id}:${request.sheet ?? ""}:${request.rowStart ?? ""}:${request.rowCount ?? ""}`;

function start(key: string, run: () => Promise<unknown>): void {
  const existing = warm.get(key);
  if (existing && Date.now() - existing.at < FRESH_MS) return;
  const promise = run();
  const entry: Entry = { at: Date.now(), promise, settled: false, taken: false };
  const settle = (failed: boolean) => {
    entry.settled = true;
    if (failed) drop(key, entry);
    else if (entry.taken) later(key, entry, RETIRE_MS);
    // Hovered and never opened: let it go once it is no longer fresh.
    else later(key, entry, FRESH_MS);
  };
  promise.then(() => settle(false), () => settle(true));
  warm.set(key, entry);
}

function take<T>(key: string, firstLoad: boolean, run: () => Promise<T>): Promise<T> {
  const entry = warm.get(key);
  if (!entry || !firstLoad || Date.now() - entry.at >= FRESH_MS) {
    if (entry) warm.delete(key);
    return run();
  }
  if (entry.settled && !entry.taken) later(key, entry, RETIRE_MS);
  entry.taken = true;
  // A network failure is worth one more try; an API refusal (gone, locked) is the answer.
  return (entry.promise as Promise<T>).catch((error: unknown) => {
    if (isApiError(error)) throw error;
    return run();
  });
}

/** Starts the details and the first preview of a file. `preview: false` when the page will ask for another window. */
export function warmFile(id: string, { preview = true }: { preview?: boolean } = {}): void {
  start(detailKey(id), () => libraryApi.getFile(id));
  if (preview) start(previewKey(id, DEFAULT_PREVIEW_REQUEST), () => libraryApi.getPreview(id, DEFAULT_PREVIEW_REQUEST));
}

/** Forgets a file's warmed requests: it changed, so they no longer describe it. */
export function forgetWarmFile(id: string): void {
  for (const key of [...warm.keys()]) {
    if (key === detailKey(id) || key.startsWith(`preview:${id}:`)) warm.delete(key);
  }
}

/** Ties the warmed requests to a workspace (its query-key segment); a different one clears them. */
export function syncWarmScope(orgKey: string): void {
  if (scope !== null && scope !== orgKey) warm.clear();
  scope = orgKey;
}

/** `firstLoad`: the query has no data yet. A refetch (after a change) always reads the server. */
export const takeWarmFile = (id: string, firstLoad: boolean, signal?: AbortSignal) =>
  take(detailKey(id), firstLoad, () => libraryApi.getFile(id, signal));

export const takeWarmPreview = (id: string, request: PreviewRequest, firstLoad: boolean, signal?: AbortSignal) =>
  take(previewKey(id, request), firstLoad, () => libraryApi.getPreview(id, request, signal));
