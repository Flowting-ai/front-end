import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Named invalidations: what to refetch when something happens. Feature code calls
 * these instead of firing window events, so each event's blast radius lives in one place.
 * Named events are also forwarded to other tabs (see startCrossTabInvalidation).
 */

export type InvalidationEvent = "credits" | "models" | "me";

const CHANNEL = "query-invalidate";

/** Credit balance changed (top-up, plan change, a metered call): profile, billing, org pool. */
function invalidateCreditsLocal(qc: QueryClient): void {
  // The profile is read imperatively (lib/api/current-user.ts) and followed by
  // AuthProvider, so it has no observers: refetch it even when inactive.
  void qc.invalidateQueries({ queryKey: queryKeys.me(), refetchType: "all" });
  void qc.invalidateQueries({ queryKey: ["billing"] });
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "org" && (q.queryKey[2] === "plan" || q.queryKey[2] === "usage") });
}

const LOCAL: Record<InvalidationEvent, (qc: QueryClient) => void> = {
  credits: invalidateCreditsLocal,
  models: (qc) => void qc.invalidateQueries({ queryKey: queryKeys.models.all() }),
  me: (qc) => void qc.invalidateQueries({ queryKey: queryKeys.me(), refetchType: "all" }),
};

let channel: BroadcastChannel | null | undefined;
function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  }
  return channel;
}

/** Invalidate in this tab and tell other tabs to do the same. */
export function invalidate(qc: QueryClient, event: InvalidationEvent): void {
  LOCAL[event](qc);
  try {
    getChannel()?.postMessage({ type: event });
  } catch {
    // A closed channel only costs cross-tab freshness.
  }
}

export const invalidateCredits = (qc: QueryClient) => invalidate(qc, "credits");
export const invalidateModels = (qc: QueryClient) => invalidate(qc, "models");
export const invalidateMe = (qc: QueryClient) => invalidate(qc, "me");

/** Listen for invalidations from other tabs. Returns a cleanup function. */
export function startCrossTabInvalidation(qc: QueryClient): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const listener = new BroadcastChannel(CHANNEL);
  listener.onmessage = (event: MessageEvent) => {
    const type = event.data?.type as InvalidationEvent | undefined;
    if (type && type in LOCAL) LOCAL[type](qc);
  };
  return () => listener.close();
}

/** Drop every per-user and per-workspace query (logout, cross-tab logout). */
export function clearUserScopedCache(qc: QueryClient): void {
  qc.cancelQueries().catch(() => {});
  qc.clear();
  qc.getMutationCache().clear();
}

/** Org switch: drop the old workspace's data but keep user-level queries. */
export function clearOrgScopedCache(qc: QueryClient, previousOrg: string): void {
  qc.removeQueries({ predicate: (q) => q.queryKey[1] === previousOrg && q.queryKey[0] !== "me" });
}

/**
 * Optimistic cache write: cancels in-flight fetches for `key` (so a late
 * response can't overwrite the change), applies `update`, and returns a
 * rollback that restores the snapshot. The rollback restores the whole key, so
 * for a list with concurrent per-item edits roll back just the item instead.
 * Never use for payments.
 */
export async function optimisticUpdate<T>(qc: QueryClient, key: QueryKey, update: (prev: T | undefined) => T): Promise<() => void> {
  await qc.cancelQueries({ queryKey: key, exact: true });
  const snapshot = qc.getQueryData<T>(key);
  qc.setQueryData<T>(key, update);
  return () => qc.setQueryData<T>(key, snapshot);
}
