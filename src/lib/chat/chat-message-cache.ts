"use client";

/**
 * Per-chat message-history cache.
 *
 * Without this, every navigation to a chat refetched its whole history and
 * showed the skeleton again, so switching A → B → A cost three round trips.
 * Entries live in the shared React Query cache (so `qc.clear()` on logout wipes
 * them with everything else), but they are read and written imperatively rather
 * than through `useQuery`: the streaming hook owns `messages` as React state
 * and commits to it many times per reply, which is not something a query's data
 * can model. The cache is a side store that the owner writes back into.
 *
 * Eviction is ours, not React Query's. `setQueryData` does not reschedule a
 * query's gc timer (query-core only calls `scheduleGc()` on construction, on
 * losing the last observer, and after a fetch), and these queries never have an
 * observer, so a finite `gcTime` would drop entries a fixed time after they were
 * first written no matter how recently they were read. `gcTime: Infinity` plus
 * the LRU trim and absolute age check below gives a predictable policy instead.
 */

import type { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { STALE_DEFAULT_MS } from "@/lib/query-policy";
import type { UIMessage } from "@/types/chat";

/** How long a cached history is served without a background refresh. */
export const HISTORY_STALE_MS = STALE_DEFAULT_MS;
/** Beyond this, an entry is treated as a miss: a full skeleton load is honest. */
const MAX_AGE_MS = 30 * 60_000;
/** Message arrays are large; keep only the chats the user is moving between. */
const MAX_CACHED_CHATS = 20;

export interface CachedChatHistory {
  messages: UIMessage[];
  hasMore: boolean;
  /** Cursor for the next (older) page, from the last page fetched. */
  cursor: string | undefined;
  /** Pages pulled so far. >1 means the user paged into older history. */
  pages: number;
  /** When the server was last read. 0 for a history built only from a stream. */
  fetchedAt: number;
  /** Last read or write — the LRU ordering key. */
  touchedAt: number;
}

const configured = new WeakSet<QueryClient>();

function client(): QueryClient {
  const qc = getQueryClient();
  if (!configured.has(qc)) {
    configured.add(qc);
    // Never stale (freshness is `fetchedAt`, since there is no queryFn to
    // refetch) and never gc'd (see the note at the top; trim() evicts instead).
    qc.setQueryDefaults(queryKeys.chats.messages(), { staleTime: Infinity, gcTime: Infinity });
  }
  return qc;
}

function entries(qc: QueryClient): Array<{ key: readonly unknown[]; value: CachedChatHistory }> {
  return qc
    .getQueryCache()
    .findAll({ queryKey: queryKeys.chats.messages() })
    .flatMap((q) => {
      const value = q.state.data as CachedChatHistory | undefined;
      return value ? [{ key: q.queryKey, value }] : [];
    });
}

/** Drops the least-recently-touched entries past MAX_CACHED_CHATS. */
function trim(qc: QueryClient): void {
  const all = entries(qc);
  if (all.length <= MAX_CACHED_CHATS) return;
  all
    .sort((a, b) => a.value.touchedAt - b.value.touchedAt)
    .slice(0, all.length - MAX_CACHED_CHATS)
    .forEach(({ key }) => qc.removeQueries({ queryKey: key, exact: true }));
}

/**
 * The cached history for `chatId`, or undefined if there is none (or it has
 * aged out). Reading marks the entry as recently used.
 */
export function readChatHistory(chatId: string): CachedChatHistory | undefined {
  const qc = client();
  const key = queryKeys.chats.messages(chatId);
  const entry = qc.getQueryData<CachedChatHistory>(key);
  if (!entry) return undefined;

  if (Date.now() - entry.touchedAt > MAX_AGE_MS) {
    qc.removeQueries({ queryKey: key, exact: true });
    return undefined;
  }

  qc.setQueryData<CachedChatHistory>(key, { ...entry, touchedAt: Date.now() });
  return entry;
}

/** True when a cached history should be refreshed in the background. */
export function isHistoryStale(entry: CachedChatHistory): boolean {
  return Date.now() - entry.fetchedAt > HISTORY_STALE_MS;
}

/** Records a history that came from the server. Resets freshness. */
export function saveChatHistory(
  chatId: string,
  history: Pick<CachedChatHistory, "messages" | "hasMore" | "cursor" | "pages">,
): void {
  const qc = client();
  const now = Date.now();
  qc.setQueryData<CachedChatHistory>(queryKeys.chats.messages(chatId), {
    ...history,
    fetchedAt: now,
    touchedAt: now,
  });
  trim(qc);
}

/**
 * Write-back of locally-held messages (a finished reply, an edit, a deleted
 * message). Freshness is deliberately not reset: these messages came from this
 * tab, not from a server read, so the next visit should still revalidate.
 */
export function updateCachedMessages(
  chatId: string,
  messages: UIMessage[],
  meta: Pick<CachedChatHistory, "hasMore" | "cursor" | "pages">,
): void {
  const qc = client();
  const key = queryKeys.chats.messages(chatId);
  const previous = qc.getQueryData<CachedChatHistory>(key);
  qc.setQueryData<CachedChatHistory>(key, {
    ...meta,
    messages,
    fetchedAt: previous?.fetchedAt ?? 0,
    touchedAt: Date.now(),
  });
  trim(qc);
}

/** Forgets one chat's history — on delete, or when its messages are cleared. */
export function dropChatHistory(chatId: string): void {
  client().removeQueries({ queryKey: queryKeys.chats.messages(chatId), exact: true });
}

/** Forgets every cached history. Used by tests and by wholesale cache resets. */
export function clearChatHistories(): void {
  const qc = client();
  entries(qc).forEach(({ key }) => qc.removeQueries({ queryKey: key, exact: true }));
}
