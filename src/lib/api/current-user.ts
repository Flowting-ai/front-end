"use client";

import { fetchCurrentUser, type UserProfile } from "./user";

/** Window in which a cached profile is served without touching the network. */
export const CURRENT_USER_CACHE_TTL = 30_000;

/**
 * Single owner of the GET /users/me profile on the client.
 *
 * Every consumer previously called `fetchCurrentUser()` directly, so concurrent
 * callers each opened their own request. This class adds the same two guards
 * `fetchPersonas()` already has — a TTL cache and in-flight dedupe — so all
 * callers share one request. Mirrors that module's shape deliberately.
 */
class CurrentUser {
  private profile: UserProfile | null = null;
  private fetchedAt = 0;
  private inFlight: Promise<UserProfile | null> | null = null;

  /** Last known profile without triggering a fetch. Null before the first load. */
  peek(): UserProfile | null {
    return this.profile;
  }

  isFresh(ttl = CURRENT_USER_CACHE_TTL): boolean {
    return this.profile !== null && Date.now() - this.fetchedAt < ttl;
  }

  /** Cached read. Serves the TTL cache, then joins any in-flight request. */
  load(): Promise<UserProfile | null> {
    if (this.isFresh()) return Promise.resolve(this.profile);
    return this.fetch();
  }

  /**
   * Force a re-read, bypassing the TTL — but still joining an in-flight
   * request, which is what collapses the bursts (`credits:updated` and chat
   * `onStreamDone` land together, as do the post-checkout confirmation pages
   * and the billing page's `reload()`).
   *
   * Deliberately no time-based coalescing here: the onboarding pages call
   * `refreshUser()` immediately after a PATCH /users/me, and any window at all
   * could hand them the pre-PATCH profile.
   */
  refresh(): Promise<UserProfile | null> {
    return this.fetch();
  }

  /** Seed the cache from a profile obtained elsewhere (e.g. a PATCH response). */
  set(profile: UserProfile | null): void {
    this.profile = profile;
    this.fetchedAt = profile ? Date.now() : 0;
  }

  /** Drop everything. Called on logout / clearAuth so the next user starts clean. */
  clear(): void {
    this.profile = null;
    this.fetchedAt = 0;
    this.inFlight = null;
  }

  private fetch(): Promise<UserProfile | null> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = fetchCurrentUser()
      .then((profile) => {
        // A null profile means a non-ok response — keep the last good profile
        // rather than blanking the app out on a transient failure.
        if (profile) this.set(profile);
        return profile;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }
}

export const currentUser = new CurrentUser();
