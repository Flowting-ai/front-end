"use client";

import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { fetchCurrentUser, type UserProfile } from "./user";

/** Window in which a cached profile is served without touching the network. */
export const CURRENT_USER_CACHE_TTL = 30_000;

/**
 * Single owner of the GET /users/me profile on the client: the ["me"] React
 * Query entry. All callers share one request (in-flight dedupe) and a 30 s
 * cache; AuthProvider follows the entry, so a refetch from anywhere — including
 * `invalidateCredits` after a top-up, in this tab or another — updates the
 * signed-in user. Logout clears it with the rest of the cache.
 */
class CurrentUser {
  private get qc() {
    return getQueryClient();
  }

  /** Last known profile without triggering a fetch. Null before the first load. */
  peek(): UserProfile | null {
    return this.qc.getQueryData<UserProfile | null>(queryKeys.me()) ?? null;
  }

  isFresh(ttl = CURRENT_USER_CACHE_TTL): boolean {
    const state = this.qc.getQueryState(queryKeys.me());
    return !!state?.data && !state.isInvalidated && Date.now() - state.dataUpdatedAt < ttl;
  }

  /** Cached read. Serves the TTL cache, then joins any in-flight request. */
  load(): Promise<UserProfile | null> {
    return this.qc.fetchQuery(this.options(CURRENT_USER_CACHE_TTL));
  }

  /**
   * Force a re-read, bypassing the TTL — but still joining an in-flight
   * request, which is what collapses the bursts (a credits invalidation and
   * chat `onStreamDone` land together, as do the post-checkout confirmation
   * pages and the billing page's `reload()`).
   *
   * Deliberately no time-based coalescing here: the onboarding pages call
   * `refreshUser()` immediately after a PATCH /users/me, and any window at all
   * could hand them the pre-PATCH profile.
   */
  refresh(): Promise<UserProfile | null> {
    return this.qc.fetchQuery(this.options(0));
  }

  /** Seed the cache from a profile obtained elsewhere (e.g. a PATCH response). */
  set(profile: UserProfile | null): void {
    if (profile) this.qc.setQueryData(queryKeys.me(), profile);
    else this.clear();
  }

  /** Drop the profile. Called on logout / clearAuth so the next user starts clean. */
  clear(): void {
    this.qc.removeQueries({ queryKey: queryKeys.me(), exact: true });
  }

  private options(staleTime: number) {
    return {
      queryKey: queryKeys.me(),
      queryFn: async (): Promise<UserProfile | null> => {
        const profile = await fetchCurrentUser();
        // A null profile means a non-ok response — keep the last good profile
        // rather than blanking the app out on a transient failure.
        return profile ?? this.peek();
      },
      staleTime,
    };
  }
}

export const currentUser = new CurrentUser();
